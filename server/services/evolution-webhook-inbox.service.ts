import { createHash } from "node:crypto";
import { db, pool } from "../db";
import { evolutionWebhookInbox, whatsappChannels } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getChannelByEvolutionInstance } from "./whatsapp-channels.service";
import { applyChannelConnectionStatus } from "./baileys/connection-status.service";
import { saveInboundMessage } from "./whatsapp-conversations.service";
import { evolutionApi, normalizeEvolutionQrData } from "../integrations/evolution-api";
import { handleQrcodeUpdated, handleMessagesUpsert, handleMessagesUpdate, handleMessagesDelete } from "./whatsapp-baileys-events.service";
import { uploadWhatsappMedia } from "../lib/r2";

export { normalizeEvolutionQrData };

export type EvolutionWebhookEvent = "QRCODE_UPDATED" | "CONNECTION_UPDATE" | "MESSAGES_SET" | "MESSAGES_UPSERT" | "MESSAGES_UPDATE" | "MESSAGES_DELETE" | "SEND_MESSAGE";
export interface EvolutionWebhookEnvelope { event: string; instance: string; data: unknown; raw?: EvolutionWebhookInput; }
export interface EvolutionWebhookInput { event?: unknown; instance?: unknown; data?: unknown; [key: string]: unknown; }

export function normalizeEvolutionEventName(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().replace(/[.-]/g, "_").toUpperCase();
  return normalized;
}

export function normalizeEvolutionWebhook(input: EvolutionWebhookInput): EvolutionWebhookEnvelope & { raw: EvolutionWebhookInput } {
  const event = normalizeEvolutionEventName(input.event);
  if (!event) throw new Error("Evento Evolution inválido");
  if (typeof input.instance !== "string" || !input.instance.trim()) throw new Error("Instância Evolution inválida");
  if (!("data" in input)) throw new Error("Dados do evento Evolution ausentes");
  return { event, instance: input.instance.trim(), data: input.data, raw: input };
}

export async function enqueueEvolutionWebhook(eventId: string, envelope: EvolutionWebhookEnvelope): Promise<"created" | "duplicate"> {
  const channel = await getChannelByEvolutionInstance(envelope.instance);
  const inserted = await db.insert(evolutionWebhookInbox).values({ eventId, eventName: envelope.event, instanceName: envelope.instance, channelId: channel?.id ?? null, payload: envelope }).onConflictDoNothing().returning({ eventId: evolutionWebhookInbox.eventId });
  return inserted.length ? "created" : "duplicate";
}

function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function messages(data: unknown): Record<string, unknown>[] {
  const root = record(data); const list = Array.isArray(root?.messages) ? root.messages : Array.isArray(data) ? data : [data];
  return list.map(record).filter((value): value is Record<string, unknown> => value !== null);
}

/** Converts Evolution's Baileys-shaped payload into the application's
 * provider-neutral Baileys event contract. Kept pure so fixtures can cover
 * provider drift without a database or network dependency. */
export function normalizeEvolutionMessage(raw: Record<string, unknown>): Record<string, unknown> | null {
  const key = record(raw.key) ?? record(record(raw.message)?.key);
  const serializedMessage = typeof raw.message === "string"
    ? (() => { try { const parsed: unknown = JSON.parse(raw.message); return record(parsed); } catch { return null; } })()
    : null;
  const source = record(raw.message) ?? serializedMessage ?? raw;
  const remoteJid = typeof key?.remoteJid === "string" ? key.remoteJid : typeof raw.number === "string" ? raw.number : null;
  const id = typeof key?.id === "string" ? key.id : typeof raw.id === "string" ? raw.id : null;
  if (!remoteJid || !id) return null;
  const fromMe = key?.fromMe === true;
  const message: Record<string, unknown> = { ...source };
  const messageType = typeof raw.messageType === "string" ? raw.messageType : "";
  const aliases: Record<string, string> = {
    contactMessage: "contactMessage", contactsArrayMessage: "contactsArrayMessage", imageMessage: "imageMessage",
    videoMessage: "videoMessage", audioMessage: "audioMessage", pttMessage: "pttMessage", documentMessage: "documentMessage",
    stickerMessage: "stickerMessage", locationMessage: "locationMessage", liveLocationMessage: "liveLocationMessage",
    pollCreationMessage: "pollCreationMessage", pollUpdateMessage: "pollUpdateMessage", reactionMessage: "reactionMessage",
    extendedTextMessage: "extendedTextMessage",
  };
  if (messageType && !Object.keys(message).some((name) => name in aliases && message[name] !== undefined)) {
    const payload = record(raw.message) ?? record(raw.messageData) ?? null;
    if (payload) message[aliases[messageType] ?? messageType] = payload;
  }
  const timestamp = typeof raw.messageTimestamp === "number" ? raw.messageTimestamp : typeof raw.timestamp === "number" ? raw.timestamp : undefined;
  const node = record(message.extendedTextMessage) ?? record(message.imageMessage) ?? record(message.videoMessage) ?? record(message.audioMessage) ?? record(message.documentMessage) ?? record(message.stickerMessage);
  const context = record(raw.contextInfo) ?? record(node?.contextInfo);
  const quoted = record(context?.quotedMessage);
  const quotedNode = quoted ? Object.values(quoted).find((value) => record(value) !== null) : undefined;
  const quotedRecord = record(quotedNode);
  const quotedType = quoted?.conversation !== undefined ? "text" : quoted?.extendedTextMessage ? "text" : quoted?.imageMessage ? "image" : quoted?.videoMessage ? "video" : quoted?.audioMessage ? "audio" : quoted?.documentMessage ? "document" : quoted?.stickerMessage ? "sticker" : undefined;
  const quotedContent = typeof quoted?.conversation === "string" ? quoted.conversation : typeof record(quoted?.extendedTextMessage)?.text === "string" ? record(quoted?.extendedTextMessage)?.text : typeof quotedRecord?.caption === "string" ? quotedRecord.caption : typeof quotedRecord?.fileName === "string" ? quotedRecord.fileName : quoted ? "" : undefined;
  const contactNode = record(message.contactMessage) ?? record(message.contactsArrayMessage);
  const contactName = typeof contactNode?.displayName === "string" ? contactNode.displayName : undefined;
  const rawContacts = Array.isArray(contactNode?.contacts) ? contactNode.contacts : contactNode ? [contactNode] : [];
  const contacts = rawContacts.map((value) => { const contact = record(value) ?? {}; const name = typeof contact.displayName === "string" ? contact.displayName : undefined; return { ...(name ? { name: { formatted_name: name } } : {}), ...contact }; });
  const structuredContent = contactNode ? { kind: "contacts", contacts } : undefined;
  const normalizedType = contactNode
    ? "contacts"
    : typeof message.conversation === "string" || message.extendedTextMessage
      ? "text"
      : undefined;
  return {
    key: { ...key, remoteJid, id, fromMe }, message, messageType: raw.messageType,
    messageTimestamp: timestamp, pushName: raw.pushName,
    ...(context ? { contextInfo: context } : {}),
    ...(normalizedType ? { type: normalizedType } : {}),
    ...(contactName ? { content: contactName } : {}),
    ...(structuredContent ? { structuredContent } : {}),
    ...(context?.stanzaId ? { replyToWaMessageId: context.stanzaId, replyToContentSnapshot: quotedContent ?? null, replyToTypeSnapshot: quotedType } : {}),
    ...(message.reactionMessage ? { reaction: { waMessageId: record(message.reactionMessage)?.key && record(record(message.reactionMessage)?.key)?.id, emoji: record(message.reactionMessage)?.text ?? "" } } : {}),
    ...(record(message.imageMessage) || record(message.videoMessage) || record(message.audioMessage) || record(message.pttMessage) || record(message.documentMessage) || record(message.stickerMessage) ? { _evolutionMedia: true } : {}),
  };
}

export async function prepareEvolutionMedia(instanceName: string, message: Record<string, unknown>): Promise<Record<string, unknown>> {
  const node = ["imageMessage", "videoMessage", "audioMessage", "pttMessage", "documentMessage", "stickerMessage"]
    .map((key) => ({ key, value: record(record(message.message)?.[key]) }))
    .find((entry) => entry.value !== null);
  let mediaNode = node?.value;
  if (!node || !mediaNode) return message;
  if (typeof mediaNode.base64 !== "string" || !mediaNode.base64.trim()) {
    const fetched = await evolutionApi.getMediaBase64(instanceName, message);
    if (typeof fetched.base64 !== "string" || !fetched.base64.trim()) {
      throw new Error(`Evolution não retornou mídia para a mensagem ${String(record(message.key)?.id ?? "desconhecida")}`);
    }
    mediaNode = { ...mediaNode, base64: fetched.base64, mimetype: fetched.mimetype ?? mediaNode.mimetype, fileName: fetched.fileName ?? mediaNode.fileName };
  }
  const base64 = typeof mediaNode.base64 === "string" ? mediaNode.base64.trim() : "";
  if (!base64) throw new Error(`Mídia Evolution vazia para a mensagem ${String(record(message.key)?.id ?? "desconhecida")}`);
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new Error(`Base64 inválido ou vazio para a mensagem Evolution ${String(record(message.key)?.id ?? "desconhecida")}`);
  const mimeType = typeof mediaNode.mimetype === "string" ? mediaNode.mimetype : "application/octet-stream";
  const storageKey = await uploadWhatsappMedia(buffer, mimeType);
  const { base64: _base64, ...safeNode } = mediaNode;
  return { ...message, message: { ...record(message.message), [node.key]: safeNode }, _baileysMedia: { storageKey, mimeType, filename: typeof mediaNode.fileName === "string" ? mediaNode.fileName : null, size: buffer.length } };
}

async function dispatch(envelope: EvolutionWebhookEnvelope): Promise<"processed" | "ignored"> {
  const channel = await getChannelByEvolutionInstance(envelope.instance);
  if (!channel || channel.qrBackend !== "evolution_api") return "ignored";
  if (envelope.event === "CONNECTION_UPDATE") {
    const state = record(envelope.data); const status = String(state?.state ?? state?.status ?? "").toLowerCase();
    const connected = status === "open" || status === "connected";
    await applyChannelConnectionStatus(channel.id, connected ? "connected" : "disconnected", { source: "webhook", occurredAt: new Date() });
    if (connected && channel.qrMigrationStatus !== "idle") {
      await db.update(whatsappChannels).set({ qrMigrationStatus: "idle", qrMigrationFrom: null, qrMigrationTo: null, qrMigrationError: null }).where(eq(whatsappChannels.id, channel.id));
    } else if (!connected && channel.qrMigrationStatus === "awaiting_qr") {
      await db.update(whatsappChannels).set({ qrMigrationStatus: "connecting" }).where(eq(whatsappChannels.id, channel.id));
    }
    return "processed";
  }
  if (envelope.event === "QRCODE_UPDATED") {
    const qr = normalizeEvolutionQrData(envelope.data);
    if (!qr.code && !qr.base64) return "ignored";
    await handleQrcodeUpdated(envelope.instance, {
      qrcode: { code: qr.code ?? undefined, base64: qr.base64 ?? undefined },
    });
    return "processed";
  }
  if (envelope.event === "MESSAGES_UPSERT" || envelope.event === "SEND_MESSAGE") {
    for (const raw of messages(envelope.data)) { const normalized = normalizeEvolutionMessage(raw); if (normalized) await handleMessagesUpsert(envelope.instance, await prepareEvolutionMedia(envelope.instance, normalized)); }
    return "processed";
  }
  if (envelope.event === "MESSAGES_UPDATE") { const payload = Array.isArray(envelope.data) ? envelope.data : [envelope.data]; await handleMessagesUpdate(payload); return "processed"; }
  if (envelope.event === "MESSAGES_DELETE") { const payload = record(envelope.data); await handleMessagesDelete(payload?.keys ? envelope.data : { keys: Array.isArray(envelope.data) ? envelope.data : [envelope.data] }); return "processed"; }
  if (envelope.event === "MESSAGES_SET") { for (const raw of messages(envelope.data)) { const normalized = normalizeEvolutionMessage(raw); if (normalized) await handleMessagesUpsert(envelope.instance, await prepareEvolutionMedia(envelope.instance, normalized)); } return "processed"; }
  console.info(`[Evolution Inbox] Evento não suportado ignorado: ${envelope.event} (${envelope.instance})`);
  return "ignored";
}

interface Claimed { event_id: string; payload: EvolutionWebhookEnvelope; attempts: number; }
async function claimOne(): Promise<Claimed | null> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await client.query<Claimed>("SELECT event_id, payload, attempts FROM evolution_webhook_inbox WHERE status IN ('pending','failed') AND next_attempt_at <= now() ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1"); const row = result.rows[0]; if (!row) { await client.query("COMMIT"); return null; } await client.query("UPDATE evolution_webhook_inbox SET status='processing', attempts=attempts+1 WHERE event_id=$1", [row.event_id]); await client.query("COMMIT"); return row; } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

export async function processEvolutionWebhookInboxBatch(limit = 10): Promise<number> {
  let processed = 0;
  for (let index = 0; index < limit; index += 1) { const event = await claimOne(); if (!event) break; try { const result = await dispatch(event.payload); await pool.query("UPDATE evolution_webhook_inbox SET status=$2, processed_at=now(), last_error=NULL WHERE event_id=$1", [event.event_id, result === "ignored" ? "ignored" : "processed"]); } catch (error) { const attempts = event.attempts + 1; const terminal = attempts >= 10; await pool.query("UPDATE evolution_webhook_inbox SET status=$2, last_error=$3, next_attempt_at=now() + ($4::text || ' seconds')::interval WHERE event_id=$1", [event.event_id, terminal ? "dead_letter" : "failed", error instanceof Error ? error.message.slice(0, 4000) : String(error), Math.min(300, 2 ** Math.min(attempts, 8))]); } processed += 1; }
  return processed;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startEvolutionWebhookInboxWorker(): void { if (timer) return; pool.query("UPDATE evolution_webhook_inbox SET status='failed', next_attempt_at=now() WHERE status='processing'").catch((error) => console.error("[Evolution Inbox] recovery failed", error)); timer = setInterval(() => { processEvolutionWebhookInboxBatch().catch((error) => console.error("[Evolution Inbox] worker failed", error)); }, 2_000); timer.unref(); }

export function deterministicEvolutionEventId(instance: string, event: string, payload: unknown): string { return createHash("sha256").update(`${instance}:${event}:${JSON.stringify(payload)}`).digest("hex"); }
