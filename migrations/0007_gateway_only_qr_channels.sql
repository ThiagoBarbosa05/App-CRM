UPDATE whatsapp_channels
   SET qr_backend = 'gateway',
       connection_status = CASE
         WHEN provider = 'evolution' AND qr_backend IS DISTINCT FROM 'gateway'
           THEN 'disconnected'
         ELSE connection_status
       END
 WHERE provider = 'evolution' OR qr_backend IS DISTINCT FROM 'gateway';

ALTER TABLE whatsapp_channels
  ALTER COLUMN qr_backend SET DEFAULT 'gateway';

ALTER TABLE whatsapp_channels
  DROP CONSTRAINT IF EXISTS whatsapp_channels_qr_backend_gateway_only;

ALTER TABLE whatsapp_channels
  ADD CONSTRAINT whatsapp_channels_qr_backend_gateway_only
  CHECK (qr_backend = 'gateway');
