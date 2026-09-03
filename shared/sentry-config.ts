export interface SentryEnvironment {
  readonly [key: string]: string | boolean | undefined;
}

interface SentryRuntimeConfigKeys {
  dsnKey: string;
  environmentKey?: string;
  releaseKey?: string;
  tracesSampleRateKey: string;
  profilesSampleRateKey?: string;
  defaultTracesSampleRate: number;
  defaultProfilesSampleRate?: number;
}

export interface SentryRuntimeConfig {
  enabled: boolean;
  dsn: string | undefined;
  environment: string | undefined;
  release: string | undefined;
  tracesSampleRate: number;
  profilesSampleRate?: number;
}

interface SentryRequestLike {
  url?: string;
  headers?: Record<string, unknown>;
  cookies?: Record<string, string>;
  data?: unknown;
  [key: string]: unknown;
}

interface SentryUserLike {
  id?: string;
  [key: string]: unknown;
}

export interface SentryEventLike {
  request?: SentryRequestLike;
  user?: SentryUserLike;
  [key: string]: unknown;
}

const SENSITIVE_QUERY_KEY =
  /^(?:access_token|auth|authorization|code|cookie|cpf|email|password|phone|refresh_token|secret|token)$/i;
const SENSITIVE_HEADER =
  /^(?:authorization|cookie|proxy-authorization|set-cookie|x-api-key)$/i;

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

function readString(
  environment: SentryEnvironment,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  const value = environment[key];
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export function buildSentryRuntimeConfig(
  environment: SentryEnvironment,
  keys: SentryRuntimeConfigKeys,
): SentryRuntimeConfig {
  const dsn = readString(environment, keys.dsnKey);
  const config: SentryRuntimeConfig = {
    enabled: dsn !== undefined,
    dsn,
    environment: readString(environment, keys.environmentKey),
    release: readString(environment, keys.releaseKey),
    tracesSampleRate: parseSampleRate(
      readString(environment, keys.tracesSampleRateKey),
      keys.defaultTracesSampleRate,
    ),
  };

  if (keys.profilesSampleRateKey && keys.defaultProfilesSampleRate !== undefined) {
    config.profilesSampleRate = parseSampleRate(
      readString(environment, keys.profilesSampleRateKey),
      keys.defaultProfilesSampleRate,
    );
  }

  return config;
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const queryKeys: string[] = [];
    parsed.searchParams.forEach((_value, key) => queryKeys.push(key));
    for (const key of queryKeys) {
      if (SENSITIVE_QUERY_KEY.test(key)) {
        parsed.searchParams.set(key, "[Filtered]");
      }
    }
    return parsed.toString();
  } catch {
    return url.split("?", 1)[0];
  }
}

export function sanitizeSentryEvent<T extends object>(event: T): T {
  const source = event as T & SentryEventLike;
  const sanitized: SentryEventLike = { ...source };

  if (source.request) {
    const headers = Object.fromEntries(
      Object.entries(source.request.headers ?? {}).filter(
        ([name]) => !SENSITIVE_HEADER.test(name),
      ),
    );
    const { cookies: _cookies, data: _data, ...safeRequest } = source.request;
    sanitized.request = {
      ...safeRequest,
      ...(source.request.url ? { url: sanitizeUrl(source.request.url) } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }

  if (source.user) {
    sanitized.user = source.user.id ? { id: source.user.id } : undefined;
  }

  return sanitized as T;
}
