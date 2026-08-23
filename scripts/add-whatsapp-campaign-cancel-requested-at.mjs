import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não configurada");
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(`
    ALTER TABLE whatsapp_campaigns
    ADD COLUMN IF NOT EXISTS cancel_requested_at timestamp;
  `);
  console.log("Coluna whatsapp_campaigns.cancel_requested_at pronta.");
} finally {
  await client.end();
}
