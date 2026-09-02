import { pool } from "../server/db";
import { evolutionApi } from "../server/integrations/evolution-api";
import { uploadWhatsappMedia } from "../server/lib/r2";

const apply = process.argv.includes("--apply");
const diagnose = process.argv.includes("--diagnose");
const CONCURRENCY = 3;

interface Candidate {
  message_id: string;
  wa_message_id: string | null;
  instance_name: string;
  raw_payload: unknown;
}

interface MediaMetadata {
  mimetype: string | null;
  fileName: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findMediaMetadata(rawPayload: unknown): MediaMetadata | null {
  const message = record(record(rawPayload)?.message);
  if (!message) return null;
  for (const key of ["imageMessage", "videoMessage", "audioMessage", "pttMessage", "documentMessage", "stickerMessage"]) {
    const media = record(message[key]);
    if (media) {
      return {
        mimetype: typeof media.mimetype === "string" ? media.mimetype : null,
        fileName: typeof media.fileName === "string" ? media.fileName : null,
      };
    }
  }
  return null;
}

function decodeBase64(value: string): Buffer | null {
  const raw = value.trim().replace(/^data:[^;]+;base64,/, "");
  if (!raw) return null;
  const buffer = Buffer.from(raw, "base64");
  return buffer.length ? buffer : null;
}

async function repairCandidate(candidate: Candidate): Promise<"repaired" | "unavailable" | "already_repaired"> {
  const payload = record(candidate.raw_payload);
  const metadata = findMediaMetadata(payload);
  if (!payload || !metadata) return "unavailable";

  const fetched = await evolutionApi.getMediaBase64(candidate.instance_name, payload);
  const buffer = typeof fetched.base64 === "string" ? decodeBase64(fetched.base64) : null;
  if (!buffer) return "unavailable";

  const mimeType = fetched.mimetype ?? metadata.mimetype ?? "application/octet-stream";
  const storageKey = await uploadWhatsappMedia(buffer, mimeType);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM whatsapp_messages WHERE id = $1 FOR UPDATE", [candidate.message_id]);
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM whatsapp_media WHERE message_id = $1",
      [candidate.message_id],
    );
    if (existing.rows.length) {
      await client.query("COMMIT");
      return "already_repaired";
    }
    await client.query(
      `INSERT INTO whatsapp_media (message_id, storage_key, mime_type, filename, size)
       VALUES ($1, $2, $3, $4, $5)`,
      [candidate.message_id, storageKey, mimeType, fetched.fileName ?? metadata.fileName, buffer.length],
    );
    await client.query("COMMIT");
    return "repaired";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const { rows } = await pool.query<Candidate>(
  `SELECT m.id AS message_id, m.wa_message_id, c.evolution_instance_name AS instance_name, m.raw_payload
     FROM whatsapp_messages m
     INNER JOIN whatsapp_channels c ON c.id = m.channel_id
     LEFT JOIN whatsapp_media media ON media.message_id = m.id
    WHERE c.provider = 'evolution'
      AND c.qr_backend = 'evolution_api'
      AND c.evolution_instance_name IS NOT NULL
      AND m.type IN ('image', 'audio', 'video', 'document', 'sticker')
      AND m.raw_payload IS NOT NULL
      AND media.id IS NULL
    ORDER BY m.created_at ASC`,
);

console.log(`Encontradas ${rows.length} mensagens Evolution sem mídia persistida.`);
if (diagnose) {
  for (const candidate of rows.slice(0, 10)) {
    console.log(`${candidate.message_id}: instância=${candidate.instance_name}; waMessageId=${candidate.wa_message_id}; mídia=${findMediaMetadata(candidate.raw_payload) ? "sim" : "não"}`);
  }
}

if (!apply) {
  console.log("Prévia somente. Use --apply para tentar recuperar as mídias.");
  await pool.end();
  process.exit(0);
}

let cursor = 0;
let repaired = 0;
let unavailable = 0;
let alreadyRepaired = 0;
let failed = 0;

async function worker(): Promise<void> {
  while (cursor < rows.length) {
    const candidate = rows[cursor];
    cursor += 1;
    if (!candidate) continue;
    try {
      const result = await repairCandidate(candidate);
      if (result === "repaired") repaired += 1;
      else if (result === "already_repaired") alreadyRepaired += 1;
      else unavailable += 1;
    } catch (error) {
      failed += 1;
      console.error(`[repair-evolution-missing-media] ${candidate.message_id}:`, error instanceof Error ? error.message : error);
    }
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()));
  console.log(`Concluído: recuperadas=${repaired}; indisponíveis=${unavailable}; já recuperadas=${alreadyRepaired}; falhas=${failed}.`);
} finally {
  await pool.end();
}
