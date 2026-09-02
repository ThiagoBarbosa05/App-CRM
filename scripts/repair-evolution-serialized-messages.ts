import { pool } from "../server/db";
import { extractEvolutionSerializedConversation } from "../server/lib/evolution-message-content";

interface Candidate { id: string; content: string; raw_payload: unknown; }

function payloadContainsSerializedConversation(value: unknown, serialized: string): boolean {
  if (Array.isArray(value)) return value.some((item) => payloadContainsSerializedConversation(item, serialized));
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(([key, item]) =>
    ((key === "conversation" || key === "message") &&
      (item === serialized || (typeof item === "object" && item !== null && JSON.stringify(item) === serialized))) ||
    payloadContainsSerializedConversation(item, serialized),
  );
}

const apply = process.argv.includes("--apply");
const diagnose = process.argv.includes("--diagnose");
const client = await pool.connect();
try {
  const result = await client.query<Candidate>(
    `SELECT id, content, raw_payload
       FROM whatsapp_messages
      WHERE type = 'text'
        AND content IS NOT NULL
        AND content LIKE '{"conversation"%'
      ORDER BY created_at DESC`,
  );
  const repairs = result.rows.flatMap((row) => {
    const raw = row.raw_payload as { message?: { conversation?: unknown } } | null;
    const text = extractEvolutionSerializedConversation(raw?.message?.conversation);
    return text === null || text === row.content || !payloadContainsSerializedConversation(row.raw_payload, row.content)
      ? []
      : [{ id: row.id, before: row.content, after: text }];
  });
  console.log(`Encontradas ${repairs.length} mensagens para reparo.`);
  if (diagnose) {
    console.log(`Candidatas pelo conteúdo: ${result.rows.length}.`);
    for (const row of result.rows.slice(0, 5)) {
      const raw = row.raw_payload as Record<string, unknown> | null;
      console.log(`${row.id}: rawPayload=${raw === null ? "null" : Object.keys(raw).join(",")}; message=${JSON.stringify(raw?.message)}`);
    }
  }
  for (const repair of repairs.slice(0, 20)) console.log(`${repair.id}: ${JSON.stringify(repair.before)} -> ${JSON.stringify(repair.after)}`);
  if (apply && repairs.length) {
    await client.query("BEGIN");
    for (const repair of repairs) await client.query("UPDATE whatsapp_messages SET content = $2 WHERE id = $1", [repair.id, repair.after]);
    await client.query("COMMIT");
    console.log(`Aplicado reparo em ${repairs.length} mensagens.`);
  } else if (!apply && repairs.length) {
    console.log("Prévia apenas: use --apply para persistir as alterações.");
  }
} finally {
  client.release();
  await pool.end();
}
