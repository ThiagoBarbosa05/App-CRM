import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  console.log("Criando tabela whatsapp_baileys_auth...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_baileys_auth (
      instance_name TEXT NOT NULL,
      data_key      TEXT NOT NULL,
      data_value    JSONB NOT NULL,
      PRIMARY KEY (instance_name, data_key)
    )
  `);
  console.log("✓ Tabela criada com sucesso.");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
