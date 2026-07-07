/**
 * Cria as tabelas sms_campaigns e sms_campaign_messages, usadas pela aba SMS
 * da página Marketing (envio de SMS via Twilio). Também garante as chaves de
 * configuração do SendGrid em system_settings, usadas pela aba Email.
 *
 * Uso:
 *   node scripts/create-marketing-sms-tables.mjs
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
  CREATE TABLE IF NOT EXISTS sms_campaigns (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    message text NOT NULL,
    target_type text NOT NULL,
    target_criteria text,
    status text NOT NULL DEFAULT 'draft',
    scheduled_at timestamp,
    sent_at timestamp,
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    created_by varchar NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS sms_campaign_messages (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id varchar NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
    client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    phone text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    twilio_sid text,
    error_message text,
    sent_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  INSERT INTO system_settings (key, value, description)
  VALUES
    ('sendgrid_api_key', '', 'API key do SendGrid para envio de email marketing'),
    ('sendgrid_from_email', '', 'E-mail remetente verificado no SendGrid'),
    ('sendgrid_from_name', '', 'Nome do remetente exibido nos e-mails')
  ON CONFLICT (key) DO NOTHING
`;

console.log("[migration] Tabelas sms_campaigns e sms_campaign_messages criadas (ou já existentes).");
console.log("[migration] Chaves sendgrid_* garantidas em system_settings.");
