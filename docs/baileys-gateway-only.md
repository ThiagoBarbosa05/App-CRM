# Canais QR exclusivos no Baileys Gateway

O App-CRM não cria sockets WhatsApp e não persiste credenciais Signal. As
rotas públicas que ainda usam o nome `evolution` são mantidas somente por
compatibilidade e delegam todas as operações ao Baileys Gateway dedicado.

## Configuração obrigatória

Configure no ambiente do CRM:

- `GATEWAY_URL`: URL HTTPS pública do gateway, sem rota adicional.
- `GATEWAY_API_KEY`: token Bearer compartilhado com o gateway.
- `WEBHOOK_SIGNING_SECRET`: segredo HMAC igual ao configurado no gateway.

O CRM interrompe o boot quando uma dessas variáveis está ausente. O endpoint
`GET /api/health/gateway` informa apenas se a configuração está completa e
quais nomes de variáveis estão ausentes; valores e segredos nunca são exibidos.

## Ordem de implantação

1. Implantar e validar o gateway.
2. Executar `migrations/0007_gateway_only_qr_channels.sql`.
3. Implantar o CRM.
4. Verificar `/api/health/gateway`.
5. Testar conexão, QR, envio, recebimento e logout em um canal piloto.

A tabela `whatsapp_baileys_auth` permanece vazia por uma versão para rollback.
Ela e os arquivos do runtime embarcado só devem ser excluídos após o período
de estabilidade previsto para a etapa 2.
