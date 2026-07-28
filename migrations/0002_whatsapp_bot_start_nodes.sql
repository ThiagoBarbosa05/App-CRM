UPDATE whatsapp_bot_nodes
SET
  type = 'start_manual',
  label = CASE WHEN label = 'Início' THEN 'Iniciar manualmente' ELSE label END,
  data = COALESCE(data, '{}'::jsonb) || '{"unlisted": false}'::jsonb,
  updated_at = NOW()
WHERE type = 'start';
