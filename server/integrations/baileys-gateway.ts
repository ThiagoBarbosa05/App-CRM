const DEFAULT_TIMEOUT_MS = 40_000;

export type GatewayObservedState =
  | "connecting"
  | "qr"
  | "connected"
  | "disconnected"
  | "lock_wait"
  | "failed";
export type GatewayDesiredState = "running" | "stopped";

export interface GatewayInstance {
  name: string;
  desired_state: GatewayDesiredState;
  observed_state: GatewayObservedState;
  connected_phone: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface GatewayQr {
  code: string;
  base64?: string;
  connectionStatus: GatewayObservedState;
  errorCode?: string;
  lastError?: string;
}

export interface GatewaySendResult {
  key: { remoteJid: string; fromMe: boolean; id: string };
  status: string;
}

export type GatewayErrorCode =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "idempotency_conflict"
  | "payload_too_large"
  | "rate_limited"
  | "overloaded"
  | "channel_offline"
  | "unavailable"
  | "unexpected";

export class BaileysGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: GatewayErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BaileysGatewayError";
  }
}

const REQUIRED_GATEWAY_ENV = [
  "GATEWAY_URL",
  "GATEWAY_API_KEY",
  "WEBHOOK_SIGNING_SECRET",
] as const;

export function getGatewayConfigurationStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing = REQUIRED_GATEWAY_ENV.filter(
    (name) => !process.env[name]?.trim(),
  );
  return { configured: missing.length === 0, missing: [...missing] };
}

export function assertGatewayConfiguration(): void {
  const status = getGatewayConfigurationStatus();
  if (!status.configured) {
    throw new BaileysGatewayError(
      `Configuração obrigatória do Baileys Gateway ausente: ${status.missing.join(", ")}`,
      "not_configured",
    );
  }
}

function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.GATEWAY_URL?.replace(/\/+$/, "");
  const apiKey = process.env.GATEWAY_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new BaileysGatewayError(
      "Baileys Gateway não configurado",
      "not_configured",
    );
  }
  return { baseUrl, apiKey };
}

async function gatewayRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { baseUrl, apiKey } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "falha de rede";
    throw new BaileysGatewayError(
      `Baileys Gateway indisponível: ${message}`,
      "unavailable",
    );
  });

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  const message = body?.message ?? `Baileys Gateway retornou ${response.status}`;
  const code: GatewayErrorCode =
    response.status === 401
      ? "unauthorized"
      : response.status === 404
        ? "not_found"
        : response.status === 409
          ? "idempotency_conflict"
          : response.status === 413
            ? "payload_too_large"
            : response.status === 429
              ? "rate_limited"
              : response.status === 503
                ? "overloaded"
                : response.status === 500 &&
                    message.toLocaleLowerCase("pt-BR").includes("desconectada")
                  ? "channel_offline"
                  : "unexpected";
  throw new BaileysGatewayError(message, code, response.status);
}

function instancePath(instanceName: string): string {
  return `/v1/instances/${encodeURIComponent(instanceName)}`;
}

export const baileysGateway = {
  createInstance(instanceName: string): Promise<GatewayInstance> {
    return gatewayRequest("/v1/instances", {
      method: "POST",
      body: JSON.stringify({ name: instanceName }),
    });
  },

  getInstance(instanceName: string): Promise<GatewayInstance> {
    return gatewayRequest(instancePath(instanceName));
  },

  connect(
    instanceName: string,
    forceNewPairing = false,
  ): Promise<GatewayQr> {
    return gatewayRequest(`${instancePath(instanceName)}/connect`, {
      method: "POST",
      body: JSON.stringify({ forceNewPairing }),
    });
  },

  getQr(instanceName: string): Promise<GatewayQr> {
    return gatewayRequest(`${instancePath(instanceName)}/qr`, {}, 10_000);
  },

  logout(instanceName: string): Promise<{ success: true }> {
    return gatewayRequest(`${instancePath(instanceName)}/logout`, {
      method: "POST",
    });
  },

  deleteInstance(instanceName: string): Promise<void> {
    return gatewayRequest(instancePath(instanceName), { method: "DELETE" });
  },

  sendText(
    instanceName: string,
    body: { to: string; text: string; quotedMsgId?: string },
    idempotencyKey: string,
  ): Promise<GatewaySendResult> {
    return gatewayRequest(`${instancePath(instanceName)}/messages/text`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  },

  sendMedia(
    instanceName: string,
    body: {
      to: string;
      type: "image" | "video" | "audio" | "document";
      url?: string;
      base64?: string;
      caption?: string;
      filename?: string;
      mimetype?: string;
    },
    idempotencyKey: string,
  ): Promise<GatewaySendResult> {
    return gatewayRequest(`${instancePath(instanceName)}/messages/media`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  },

  async getProfilePicture(
    instanceName: string,
    phone: string,
  ): Promise<string | null> {
    const result = await gatewayRequest<{ url: string | null }>(
      `${instancePath(instanceName)}/profile-picture?phone=${encodeURIComponent(phone)}`,
      {},
      10_000,
    );
    return result.url;
  },
};
