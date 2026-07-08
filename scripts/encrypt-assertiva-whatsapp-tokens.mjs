/**
 * Criptografa em repouso os tokens de terceiros hoje armazenados em texto plano:
 *   - assertiva_tokens.access_token
 *   - whatsapp_channels.access_token
 *
 * Replica o padrão AES-256-GCM de server/lib/token-crypto.ts (chave derivada de
 * BLING_TOKEN_ENCRYPTION_KEY via SHA-256; payload "iv:authTag:encrypted" em base64).
 * Não importa o módulo TS diretamente (script .mjs plano) — a lógica é duplicada aqui
 * de propósito, mantendo o mesmo formato para que server/lib/token-crypto.ts
 * consiga decifrar o resultado.
 *
 * Passos (idempotente, seguro para reexecutar):
 *   1. Adiciona a coluna access_token_encrypted (se não existir) nas duas tabelas.
 *   2. Para cada linha com access_token em texto plano e access_token_encrypted vazio,
 *      criptografa e grava na nova coluna.
 *   3. Verifica round-trip (decrypt(encrypt(valor)) === valor original) antes de dropar
 *      a coluna antiga — aborta sem alterar o schema se qualquer verificação falhar.
 *   4. Remove a coluna access_token em texto plano.
 *
 * Uso:
 *   node scripts/encrypt-assertiva-whatsapp-tokens.mjs
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const secret = process.env.BLING_TOKEN_ENCRYPTION_KEY;
if (!secret) {
  console.error("Defina BLING_TOKEN_ENCRYPTION_KEY no .env");
  process.exit(1);
}

const sql = neon(dbUrl);

function getEncryptionKey() {
  return createHash("sha256").update(secret).digest();
}

function encryptToken(value) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptToken(payload) {
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split(":");
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Token criptografado invalido");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function migrateTable({ table, idColumn }) {
  await sql.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS access_token_encrypted text`,
  );

  const rows = await sql.query(
    `SELECT ${idColumn} AS id, access_token FROM ${table}
     WHERE access_token IS NOT NULL AND access_token_encrypted IS NULL`,
  );

  console.log(`[migration] ${table}: ${rows.length} linha(s) com token em texto plano a migrar.`);

  for (const row of rows) {
    const encrypted = encryptToken(row.access_token);

    // Verificação de round-trip antes de gravar — aborta a linha (não o processo)
    // em caso de falha, para investigação manual.
    const roundTrip = decryptToken(encrypted);
    if (roundTrip !== row.access_token) {
      throw new Error(
        `[migration] Round-trip falhou para ${table}.${idColumn}=${row.id} — abortando sem alterar o schema.`,
      );
    }

    await sql.query(
      `UPDATE ${table} SET access_token_encrypted = $1 WHERE ${idColumn} = $2`,
      [encrypted, row.id],
    );
  }

  const [{ remaining }] = await sql.query(
    `SELECT count(*)::int AS remaining FROM ${table}
     WHERE access_token IS NOT NULL AND access_token_encrypted IS NULL`,
  );

  if (remaining > 0) {
    throw new Error(
      `[migration] ${table}: ${remaining} linha(s) ainda sem access_token_encrypted — abortando antes de dropar a coluna antiga.`,
    );
  }

  await sql.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS access_token`);
  console.log(`[migration] ${table}: coluna access_token (texto plano) removida.`);
}

await migrateTable({ table: "assertiva_tokens", idColumn: "id" });
await migrateTable({ table: "whatsapp_channels", idColumn: "id" });

console.log("[migration] Concluído.");
