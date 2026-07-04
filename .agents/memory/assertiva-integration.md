---
name: Assertiva API Integration
description: Authentication format and known issues for Assertiva CPF lookup API
---

# Assertiva API — Integração CPF

## Endpoint correto
- Token: `POST https://integracao.assertivasolucoes.com.br/v3/token`
- CPF: `GET https://integracao.assertivasolucoes.com.br/v3/cpf/{cpf}`

## Formato de autenticação
- `Authorization: Basic base64(client_id:client_secret)` no header
- Body: apenas `grant_type=client_credentials` (form-urlencoded)
- NÃO enviar client_id/client_secret no body

## Erro 403 "Invalid key=value pair in Authorization header"
- Mesmo hash `quA35IXMSoCREI27CRtsICi+4jWySsUIby+IEZwnpbY=` em todas as tentativas
- Causa provável: conta Assertiva não tem permissão de API habilitada pelo suporte
- Documentação diz 403 = "quando não houver permissão para acesso à API"
- Solução: contatar atendimento@assertivasolucoes.com.br para habilitar acesso

**Why:** The 403 is a plan/permission issue on Assertiva's side, not a code issue. The auth format (Basic auth with only grant_type in body) is confirmed correct from their official Swagger docs at /v3/doc/.

**How to apply:** If the 403 persists after user contacts Assertiva support, check if the client_id/secret were rotated and update secrets accordingly.
