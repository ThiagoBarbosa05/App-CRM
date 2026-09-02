import { db, pool } from "../db";
import { sql } from "drizzle-orm";
import { getChannelByEvolutionInstance } from "./whatsapp-channels.service";

export type GatewayMessageKey = {
  remoteJid: string; remoteJidAlt?: string; participant?: string; participantAlt?: string;
  addressingMode?: string; fromMe: boolean; id: string;
};
export type DecryptionStatus = "pending" | "recovered" | "recovered_late" | "failed";

export function normalizeGatewayMessageKey(value: unknown): GatewayMessageKey {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    remoteJid: typeof input.remoteJid === "string" ? input.remoteJid : "",
    ...(typeof input.remoteJidAlt === "string" ? { remoteJidAlt: input.remoteJidAlt } : {}),
    ...(typeof input.participant === "string" ? { participant: input.participant } : {}),
    ...(typeof input.participantAlt === "string" ? { participantAlt: input.participantAlt } : {}),
    ...(typeof input.addressingMode === "string" ? { addressingMode: input.addressingMode } : {}),
    fromMe: input.fromMe === true,
    id: typeof input.id === "string" ? input.id : "",
  };
}

function jidValue(jid: string | undefined, suffix: string): string | null {
  if (!jid || !jid.endsWith(suffix)) return null;
  return jid.slice(0, -suffix.length) || null;
}

export function resolveStatusAuthor(key: GatewayMessageKey): { phone: string | null; lid: string | null } {
  const candidates = [key.participantAlt, key.remoteJidAlt, key.participant];
  const phone = candidates.map((value) => jidValue(value, "@s.whatsapp.net")).find(Boolean) ?? null;
  const lid = candidates.map((value) => jidValue(value, "@lid")).find(Boolean) ?? null;
  return { phone, lid };
}

const transitions: Record<DecryptionStatus, DecryptionStatus[]> = {
  pending: ["pending", "recovered", "failed"], recovered: ["recovered"],
  recovered_late: ["recovered_late", "recovered"], failed: ["failed", "recovered_late"],
};
export function nextDecryptionStatus(current: DecryptionStatus, incoming: DecryptionStatus): DecryptionStatus {
  return transitions[current].includes(incoming) ? incoming : current;
}

export async function auditStatus(instanceName: string, data: unknown): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (!channel) { console.warn(`[Baileys Audit] Instância sem canal: ${instanceName}`); return; }
  const input = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
  const key = normalizeGatewayMessageKey(input.key);
  const author = resolveStatusAuthor(key);
  const message = typeof input.message === "object" && input.message !== null ? input.message : {};
  await db.execute(sql`
    INSERT INTO whatsapp_status_audit (
      channel_id, instance_name, message_id, remote_jid, remote_jid_alt,
      participant, participant_alt, addressing_mode, from_me, author_phone,
      author_lid, message_type, message_payload, raw_payload, message_timestamp
    ) VALUES (
      ${channel.id}, ${instanceName}, ${key.id}, ${key.remoteJid}, ${key.remoteJidAlt ?? null},
      ${key.participant ?? null}, ${key.participantAlt ?? null}, ${key.addressingMode ?? null},
      ${key.fromMe}, ${author.phone}, ${author.lid},
      ${typeof input.messageType === "string" ? input.messageType : "unknown"},
      ${JSON.stringify(message)}, ${JSON.stringify(data)},
      to_timestamp(${typeof input.messageTimestamp === "number" ? input.messageTimestamp : null})
    )
    ON CONFLICT (channel_id, message_id) DO UPDATE SET
      updated_at = now(),
      raw_payload = EXCLUDED.raw_payload,
      message_payload = EXCLUDED.message_payload
  `);
}

export async function auditDecryption(instanceName: string, data: unknown): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (!channel) { console.warn(`[Baileys Audit] Instância sem canal: ${instanceName}`); return; }
  const input = data as Record<string, unknown>;
  const key = normalizeGatewayMessageKey(input.key);
  const status = input.status as DecryptionStatus;
  const reason = typeof input.reason === "string" ? input.reason : "unknown";
  await pool.query(`INSERT INTO whatsapp_decryption_incidents (channel_id, instance_name, remote_jid, remote_jid_alt, participant, participant_alt, addressing_mode, from_me, message_id, status, reason, attempts, retrying, gateway_payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (instance_name, remote_jid, COALESCE(participant, ''), message_id) DO UPDATE SET status=CASE WHEN whatsapp_decryption_incidents.status='recovered' THEN 'recovered' ELSE CASE WHEN $10 IN ('recovered','recovered_late','failed') THEN $10 ELSE whatsapp_decryption_incidents.status END END, reason=$11, attempts=GREATEST(whatsapp_decryption_incidents.attempts,$12), retrying=$13, gateway_payload=$14, last_received_at=now(), updated_at=now()`, [channel.id, instanceName, key.remoteJid, key.remoteJidAlt ?? null, key.participant ?? null, key.participantAlt ?? null, key.addressingMode ?? null, key.fromMe, key.id, status, reason, typeof input.attempts === "number" ? input.attempts : 0, input.retrying === true, input]);
}
