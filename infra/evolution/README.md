# Evolution API (WhatsApp via QR Code / Baileys)

Stack self-hosted da Evolution API v2 para conectar números de WhatsApp por QR Code
(protocolo multi-dispositivo), permitindo que vendedores mantenham o número no celular.

> ⚠️ Conexão não-oficial (contra os ToS do WhatsApp). Há risco de banimento do número.
> Use números dedicados, com aquecimento gradual e `delay` entre envios. Não usar para
> campanhas/broadcast em massa — isso permanece na Cloud API oficial.

Postgres e Redis aqui são **exclusivos da Evolution**, isolados do banco do CRM.

## Subir

```bash
cd infra/evolution
cp .env.example .env      # edite AUTHENTICATION_API_KEY e POSTGRES_PASSWORD
docker compose up -d
```

- API/Manager: http://localhost:8080/manager (login com `AUTHENTICATION_API_KEY`)
- A porta 8080 pode conflitar com outros serviços locais — ajuste no compose se preciso.

## Produção

- `SERVER_URL` deve ser o domínio público (atrás de HTTPS/reverse proxy).
- O webhook configurado em cada instância precisa apontar para o CRM por URL pública.
- Em dev, exponha o webhook do CRM via túnel (ngrok/cloudflared).

## Integração com o CRM

No `.env` do CRM, defina:

```
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=<o mesmo valor de AUTHENTICATION_API_KEY>
```
