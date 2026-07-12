/**
 * Cria as tabelas de setores de atendimento do WhatsApp:
 * - whatsapp_sectors: setores (departamentos) que agrupam atendentes/canais
 * - whatsapp_sector_members: vínculo muitos-para-muitos usuário <-> setor
 *
 * Também reaponta a FK whatsapp_conversations.sector_id, que hoje referencia
 * a tabela `sectors` (classificação de empresas, sem relação com atendentes),
 * para passar a referenciar `whatsapp_sectors`. A coluna não é lida em nenhum
 * lugar do código hoje, então o retarget é seguro mesmo com dados existentes.
 *
 * Uso:
 *   node scripts/create-whatsapp-sectors.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS whatsapp_sectors (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    color text NOT NULL DEFAULT '#3B82F6',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
console.log("[migration] Tabela whatsapp_sectors criada (ou já existente).");

await sql`
  CREATE TABLE IF NOT EXISTS whatsapp_sector_members (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id varchar NOT NULL REFERENCES whatsapp_sectors(id) ON DELETE CASCADE,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (sector_id, user_id)
  )
`;
console.log("[migration] Tabela whatsapp_sector_members criada (ou já existente).");

// Reaponta a FK de whatsapp_conversations.sector_id para whatsapp_sectors.
// Descobre o nome real da constraint em vez de assumir o padrão de nomenclatura do Drizzle.
const [existingFk] = await sql`
  SELECT tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'whatsapp_conversations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'sector_id'
    AND ccu.table_name = 'sectors'
`;

if (existingFk) {
  await sql.query(
    `ALTER TABLE whatsapp_conversations DROP CONSTRAINT "${existingFk.constraint_name}"`,
  );
  console.log(
    `[migration] Constraint antiga removida: ${existingFk.constraint_name} (whatsapp_conversations.sector_id -> sectors).`,
  );
} else {
  console.log(
    "[migration] Nenhuma FK de whatsapp_conversations.sector_id -> sectors encontrada (já migrada ou nunca existiu).",
  );
}

const [existingNewFk] = await sql`
  SELECT tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'whatsapp_conversations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'sector_id'
    AND ccu.table_name = 'whatsapp_sectors'
`;

if (!existingNewFk) {
  // Valores antigos de sector_id apontavam para `sectors` (setor de empresa) e não
  // existem em `whatsapp_sectors` — precisam ser zerados antes de criar a nova FK,
  // senão a constraint falha para qualquer linha com sector_id preenchido.
  const { rowCount: orphaned } = await sql.query(`
    UPDATE whatsapp_conversations
    SET sector_id = NULL
    WHERE sector_id IS NOT NULL
      AND sector_id NOT IN (SELECT id FROM whatsapp_sectors)
  `);
  if (orphaned) {
    console.log(`[migration] ${orphaned} conversa(s) com sector_id órfão zerado(s).`);
  }

  await sql`
    ALTER TABLE whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_sector_id_whatsapp_sectors_id_fk
    FOREIGN KEY (sector_id) REFERENCES whatsapp_sectors(id)
  `;
  console.log("[migration] Nova FK criada: whatsapp_conversations.sector_id -> whatsapp_sectors.");
} else {
  console.log("[migration] FK whatsapp_conversations.sector_id -> whatsapp_sectors já existe.");
}

console.log("[migration] Concluído.");
