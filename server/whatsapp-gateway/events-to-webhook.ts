import QRCode from "qrcode";

function crmWebhookUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL não definido");
  return `${url.replace(/\/$/, "")}/evolution/webhook`;
}

async function post(body: unknown) {
  try {
    await fetch(crmWebhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiKey: process.env.GATEWAY_API_KEY ?? "",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[Gateway → CRM] Falha ao enviar webhook:", err);
  }
}

export async function sendConnectionUpdate(instanceName: string, state: string) {
  await post({ event: "connection.update", instance: instanceName, data: { state } });
}

export async function sendQrUpdated(instanceName: string, qrString: string) {
  let base64: string | null = null;
  try {
    const buffer = await QRCode.toBuffer(qrString, { type: "png", width: 300 });
    base64 = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    // best-effort — a UI também recebe o qrCode raw string via SSE
  }
  await post({
    event: "qrcode.updated",
    instance: instanceName,
    data: { qrcode: { base64, code: qrString } },
  });
}

export async function sendMessagesUpsert(instanceName: string, msgData: unknown) {
  await post({ event: "messages.upsert", instance: instanceName, data: msgData });
}

export async function sendMessagesUpdate(instanceName: string, updates: unknown[]) {
  await post({ event: "messages.update", instance: instanceName, data: updates });
}

// Mapeia o enum numérico do Baileys (proto.WebMessageInfo.Status) para string
const BAILEYS_STATUS: Record<number, string> = {
  0: "error",
  1: "pending",
  2: "server_ack",
  3: "delivery_ack",
  4: "read",
  5: "played",
};

export function mapBaileysStatus(status: number | string | null | undefined): string {
  if (typeof status === "number") return BAILEYS_STATUS[status] ?? "pending";
  return String(status ?? "pending").toLowerCase();
}
