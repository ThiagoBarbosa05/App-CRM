/**
 * Consumidor Final escolhido direto no Bling.
 *
 * Antes a unidade só apontava para um cliente LOCAL (`default_client_id`), o
 * que exigia que o contato já estivesse espelhado em `bling_contact_mappings`.
 * O Consumidor Final é um contato do Bling, não um cliente do CRM — criar um
 * cliente fantasma só para poder apontar para ele sujava a base de clientes.
 *
 * Passa a guardar o id do contato do Bling direto, mais o nome como snapshot
 * para a tela de configuração não precisar bater na API só para exibir o que
 * está selecionado.
 *
 * `default_client_id` continua existindo e sendo lido como fallback — nenhuma
 * unidade perde configuração.
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/add-pdv-unit-default-bling-contact.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

console.log("\nColunas do Consumidor Final em pdv_units\n");

await sql`ALTER TABLE pdv_units ADD COLUMN IF NOT EXISTS default_bling_contact_id text`;
console.log("  + default_bling_contact_id");
await sql`ALTER TABLE pdv_units ADD COLUMN IF NOT EXISTS default_bling_contact_name text`;
console.log("  + default_bling_contact_name");

// Unidade que já tinha Consumidor Final pelo caminho antigo continua valendo:
// copia o contato Bling do mapeamento para o campo novo, para que a tela mostre
// a configuração e o envio use o caminho direto.
const migradas = await sql`
  UPDATE pdv_units u
  SET default_bling_contact_id = m.bling_contact_id,
      default_bling_contact_name = c.name
  FROM bling_contact_mappings m
  JOIN clients c ON c.id = m.client_id
  WHERE u.default_client_id = m.client_id
    AND u.bling_connection_id = m.connection_id
    AND u.default_bling_contact_id IS NULL
  RETURNING u.id
`;
console.log(
  migradas.length > 0
    ? `\n  + ${migradas.length} unidade(s) com Consumidor Final legado migrada(s)`
    : "\n  = nenhuma unidade com Consumidor Final legado a migrar",
);

console.log("\nDiagnóstico\n");
const unidades = await sql`
  SELECT name,
         default_bling_contact_id IS NOT NULL AS tem_contato,
         bling_connection_id IS NOT NULL AS tem_conexao
  FROM pdv_units WHERE is_active ORDER BY name
`;
for (const u of unidades) {
  const estado = !u.tem_conexao
    ? "sem conta Bling"
    : u.tem_contato
      ? "OK"
      : "! SEM Consumidor Final — pedidos não vão ao Bling";
  console.log(`  ${u.name.padEnd(52)} ${estado}`);
}

console.log("\n[migration] Consumidor Final por contato Bling pronto.\n");
