# API do Baileys Gateway

**Versão do contrato: 2.0.** O contrato 2.0 adiciona citação em mídia,
figurinha nativa, envio de reação, preservação de `contextInfo` e o evento
`messages.reaction`. Gateway e CRM devem ser publicados de forma coordenada.

Documentação de integração para o App-CRM. Cobre autenticação, o fluxo de conexão de canais via QR code, envio de mensagens e o contrato dos webhooks.

Base URL: valor de `GATEWAY_URL` (ex.: `https://seu-gateway.replit.app`).

---

## 1. Autenticação

Todas as rotas sob `/v1` exigem o header:

```
Authorization: Bearer <GATEWAY_API_KEY>
```

Sem o header correto → `401 {"message":"Não autorizado"}`.

As rotas `/health/live`, `/health/ready` e `/metrics` são **públicas** (sem auth) — não exponha o gateway na internet aberta sem uma camada de rede na frente, ou aceite que essas três rotas fiquem visíveis.

### Rate limit

120 requisições por minuto **por IP**, contando todas as rotas (inclusive health). Excedeu → `429 {"message":"Muitas requisições"}`. A janela é de 60s, fixa a partir da primeira requisição.

Para o CRM isso é folgado, mas atenção ao polling de QR: 1 requisição a cada 2s = 30/min por canal em conexão. Conectando 4+ canais simultaneamente com polling agressivo você chega perto do limite.

---

## 2. Conceitos

Um **canal** do CRM = uma **instância** do gateway, identificada por um `name`.

O `name` deve casar com `^[a-z0-9][a-z0-9-]{0,49}$` — minúsculas, dígitos e hífen, começando por letra/dígito, até 50 caracteres. Qualquer outro formato retorna `400`.

Cada instância tem dois estados persistidos:

| Campo            | Valores                                         | Significado                                                                                                                                       |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desired_state`  | `running`, `stopped`                            | O que o operador pediu. `connect` seta `running`, `logout` seta `stopped`. É o que faz a instância reconectar sozinha após um restart do gateway. |
| `observed_state` | `connecting`, `qr`, `connected`, `disconnected` | O que o socket realmente está fazendo agora.                                                                                                      |

O CRM deve tratar `observed_state` como a verdade para exibir status ao usuário, e `desired_state` para saber se o canal está "ligado" conceitualmente.

---

## 3. Fluxo de conexão via QR code

Este é o fluxo principal. Resumo:

```
POST /v1/instances                      → cria o registro do canal (idempotente)
POST /v1/instances/:name/connect        → abre o socket e devolve o 1º QR (aguarda até 30s)
GET  /v1/instances/:name/qr             → devolve o QR atual (para renovação/polling)
   ...usuário escaneia no celular...
webhook connection.update state=open    → conectado; ou GET /v1/instances/:name → observed_state=connected
```

### 3.1 Criar a instância

```http
POST /v1/instances
Authorization: Bearer <API_KEY>
Content-Type: application/json

{ "name": "canal-piloto" }
```

`201 Created`:

```json
{
  "name": "canal-piloto",
  "desired_state": "stopped",
  "observed_state": "disconnected",
  "connected_phone": null,
  "last_error": null,
  "created_at": "2026-07-29T12:00:00.000Z",
  "updated_at": "2026-07-29T12:00:00.000Z"
}
```

É idempotente por natureza (`ON CONFLICT DO NOTHING`): chamar de novo com o mesmo nome retorna `201` com a linha existente, sem apagar nada. Seguro para retry.

### 3.2 Conectar e obter o QR

```http
POST /v1/instances/canal-piloto/connect
Authorization: Bearer <API_KEY>
```

Esta rota **bloqueia por até 30 segundos** esperando o primeiro QR ser emitido pelo WhatsApp. Configure o timeout do cliente HTTP do CRM para algo acima disso (35–40s).

Três respostas possíveis — todas `200`, diferenciadas pelo corpo:

**a) QR disponível** (caso normal para um canal novo):

```json
{
  "code": "2@AbC...",
  "base64": "data:image/png;base64,iVBORw0KG...",
  "connectionStatus": "qr"
}
```

`base64` é um data URL PNG de 300px, pronto para `<img src="...">`. `code` é o payload bruto, caso você prefira renderizar o QR no front-end.

> `base64` pode vir `undefined` se a geração da imagem falhar — o `code` sempre vem. Trate esse caso renderizando a partir do `code`.

**b) Já estava conectado** (credenciais válidas no banco, nenhum QR necessário):

```json
{ "code": "", "connectionStatus": "connected" }
```

**c) Timeout de 30s sem QR**:

```json
{ "code": "" }
```

Note a ausência de `connectionStatus`. Isso não é necessariamente um erro — a instância pode ter credenciais salvas e estar no meio de um handshake de reconexão. **Ação recomendada:** consultar `GET /v1/instances/:name` e reagir ao `observed_state`; se ficar em `connecting`/`disconnected` por muito tempo, chamar `connect` de novo.

A regra de discriminação no CRM deve ser: `connectionStatus === "qr"` → mostrar QR; `=== "connected"` → canal pronto; ausente → estado indeterminado, cair para polling.

**Falha por memória:** se o RSS do processo estiver ≥ 1,65 GB a rota retorna `503 {"message":"Memória acima do limite seguro"}` e **não** abre o socket. O gateway está protegendo o limite de 2 GB da VM. Trate como "tente mais tarde" e alerte a operação — provavelmente é hora de migrar para uma VM de 4 GB.

Chamar `connect` repetidamente é seguro: se já existe uma sessão em andamento, não abre uma segunda, apenas aguarda o próximo QR.

### 3.3 Renovação do QR

O QR do WhatsApp expira em poucos segundos e o Baileys emite um novo automaticamente enquanto ninguém escaneia. Duas formas de acompanhar:

**Polling** (mais simples, recomendado para começar):

```http
GET /v1/instances/canal-piloto/qr
Authorization: Bearer <API_KEY>
```

`200`:

```json
{ "code": "2@AbC...", "base64": "data:image/png;base64,..." }
```

`404` (sem corpo) quando **não há QR pendente**. Isso acontece em três situações distintas que o CRM precisa distinguir consultando `GET /v1/instances/:name`:

- a sessão conectou (QR foi consumido) → `observed_state: "connected"` ✅
- a sessão ainda não abriu / caiu → `observed_state: "connecting"` ou `"disconnected"`
- a instância nunca foi conectada

Cadência sugerida: a cada 2–3 segundos, com teto de ~2 minutos de tela de QR aberta.

**Webhook** (tempo real, sem polling): cada novo QR dispara o evento `qrcode.updated` (ver seção 6). Se o CRM já consome os webhooks, dá para empurrar o QR novo direto para a tela via SSE/WebSocket e dispensar o polling.

### 3.4 Detectar a conexão

Assim que o usuário escaneia:

- webhook `connection.update` com `data.state === "open"` e `data.phone` (o número conectado);
- `GET /v1/instances/:name` passa a retornar `observed_state: "connected"` e `connected_phone` preenchido;
- `GET /v1/instances/:name/qr` passa a retornar `404`.

Qualquer um dos três serve como sinal de sucesso. O webhook é o mais rápido; o polling do `/qr` retornando 404 + `observed_state=connected` é o mais simples de implementar.

### 3.5 Reconexão automática

Depois de conectado uma vez, **o canal não precisa de novo QR**. As credenciais ficam no Postgres (`baileys_gateway_auth`) e:

- quedas de rede reconectam sozinhas com backoff exponencial (5s, 10s, 20s… até 60s, com jitter);
- um restart/deploy do gateway reabre automaticamente todas as instâncias com `desired_state='running'`.

Novo QR só é exigido quando o WhatsApp encerra a sessão (`loggedOut` — usuário desvinculou o aparelho, ou ban). Nesse caso o gateway limpa as credenciais e seta `desired_state='stopped'`; o CRM detecta pelo `connection.update` com `state="close"` seguido de `observed_state=disconnected` + `desired_state=stopped`, e deve oferecer "reconectar" (= `POST /connect` de novo).

---

## 4. Gerenciamento de instâncias

### `GET /v1/instances`

Lista todas as instâncias, ordenadas por nome. Retorna um array dos objetos descritos em 3.1. Útil para a tela de canais do CRM.

### `GET /v1/instances/:name`

Uma instância. `404` (sem corpo) se não existir.

### `POST /v1/instances/:name/logout`

Desvincula o aparelho no WhatsApp, apaga as credenciais do banco e seta `desired_state='stopped'`. Retorna `200 {"success": true}`.

**Exige novo QR** para reconectar. Não use para "pausar" um canal.

### `DELETE /v1/instances/:name`

Faz o logout e remove a instância do banco (auth em cascata). `204 No Content`. Irreversível.

---

## 5. Envio de mensagens

### 5.1 Idempotência

Ambas as rotas de envio aceitam o header opcional — e **fortemente recomendado**:

```
Idempotency-Key: <chave única por mensagem do CRM>
```

Comportamento:

- Primeira chamada com a chave: executa o envio e guarda a resposta por 24h.
- Repetição com a **mesma chave e mesmo payload**, já concluída: retorna a resposta original, sem reenviar.
- Repetição enquanto a primeira ainda está em andamento: `409 {"message":"Requisição idempotente ainda em processamento"}`.
- Mesma chave com **payload diferente**: `409 {"message":"Idempotency-Key reutilizada com outro payload"}`.

Sem o header, todo retry vira uma mensagem duplicada no WhatsApp do cliente. Use o ID da mensagem no banco do CRM como chave.

> O hash do payload é calculado sobre o JSON do corpo já validado. Mantenha a serialização estável entre tentativas (mesmos campos, mesma ordem) para não cair no 409 de payload divergente.

### 5.2 Texto

```http
POST /v1/instances/canal-piloto/messages/text
Authorization: Bearer <API_KEY>
Idempotency-Key: msg-9f3c1a
Content-Type: application/json

{
  "to": "5511999999999",
  "text": "Olá",
  "quotedMsgId": "3EB0..."
}
```

| Campo         | Obrigatório | Regras                                                                                                                                                                  |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `to`          | sim         | mín. 10 caracteres. Número só com dígitos (o gateway remove `+`, espaços, parênteses e hífens) ou JID completo se contiver `@`. Após limpeza precisa ter 10–15 dígitos. |
| `text`        | sim         | 1 a 65.536 caracteres                                                                                                                                                   |
| `quotedMsgId` | não         | ID de uma mensagem anterior, para responder citando                                                                                                                     |

`200`:

```json
{
  "key": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": true,
    "id": "3EB0C767D..."
  },
  "status": "sent"
}
```

Guarde `key.id` — é ele que aparece nos eventos `messages.update` de entrega/leitura.

### 5.3 Mídia

```http
POST /v1/instances/canal-piloto/messages/media
Authorization: Bearer <API_KEY>
Idempotency-Key: msg-9f3c1b
Content-Type: application/json

{
  "to": "5511999999999",
  "type": "image",
  "url": "https://cdn.exemplo.com/foto.jpg",
  "caption": "Segue a foto",
  "mimetype": "image/jpeg"
}
```

| Campo      | Obrigatório | Regras                                                 |
| ---------- | ----------- | ------------------------------------------------------ |
| `to`       | sim         | igual ao texto                                         |
| `type`     | sim         | `image` \| `video` \| `audio` \| `document` \| `sticker` |
| `url`      | exclusivo   | URL do objeto que o gateway vai ler (ver abaixo)       |
| `base64`   | exclusivo   | conteúdo inline, com ou sem prefixo `data:...;base64,` |
| `caption`  | não         | até 4096 caracteres. Ignorado em `type=audio` e `type=sticker` |
| `filename` | não         | até 255 caracteres. Usado apenas em `type=document`    |
| `mimetype` | não         | até 128 caracteres. Default `application/octet-stream`. Ignorado em `type=sticker` |
| `quotedMsgId` | não      | `key.id` da mensagem que está sendo respondida         |

`url` e `base64` são **mutuamente exclusivos e obrigatórios**: exatamente um dos dois. Informar os dois ou nenhum → `400` com a mensagem `"Informe exatamente um entre url e base64"`.

**Prefira `url`.** O payload em base64 passa inteiro pela memória do processo, que tem orçamento apertado. Limites:

- corpo da requisição: `BODY_LIMIT` (default `12mb`) — excedeu, o Express rejeita;
- conteúdo decodificado do base64: `MAX_BASE64_BYTES` (default 8 MiB) → `413 {"message":"Base64 excede o limite"}`.
- arquivo obtido por `url`: `MAX_OUTBOUND_MEDIA_BYTES` (default 16 MiB), com timeout `OUTBOUND_MEDIA_TIMEOUT_MS` (default 20 s).

**Como o gateway lê a `url`.** Se ela estiver dentro de `R2_PUBLIC_URL`, o gateway
deriva a chave do objeto e busca o conteúdo pela **API S3 do R2**, com as próprias
credenciais — não há GET anônimo, então nada passa pelo edge da Cloudflare e o
bucket não precisa ser publicamente legível. Use `getPublicR2Url(storageKey)`
(`server/lib/r2.ts`) normalmente: a URL continua sendo o identificador do objeto.
Chave inexistente no bucket → `404`; falha de leitura → `502`; timeout → `504`.
URLs fora de `R2_PUBLIC_URL` continuam sendo baixadas por HTTPS, sem redirects.

Passe `mimetype` sempre que souber — sem ele o WhatsApp recebe `application/octet-stream` e pode não renderizar a mídia inline. Áudio é enviado como arquivo de áudio comum, não como PTT (mensagem de voz).

Resposta: mesmo formato do envio de texto.

### 5.4 Reação

```http
POST /v1/instances/canal-piloto/messages/reaction
Authorization: Bearer <API_KEY>
Idempotency-Key: reaction-message-id-outbound
Content-Type: application/json

{"to":"5511999999999","messageId":"3EB0...","emoji":"👍"}
```

| Campo       | Obrigatório | Regras                                          |
| ----------- | ----------- | ----------------------------------------------- |
| `to`        | sim         | igual ao texto                                  |
| `messageId` | sim         | `key.id` da mensagem que está sendo reagida     |
| `emoji`     | sim         | até 16 caracteres                               |

Um `emoji` vazio remove a reação do próprio canal. A `key.id` devolvida é a da
reação, não a da mensagem alvo.

### 5.5 Foto de perfil

```http
GET /v1/instances/canal-piloto/profile-picture?phone=5511999999999
Authorization: Bearer <API_KEY>
```

`200 {"url": "https://pps.whatsapp.net/..."}` ou `{"url": null}` se não houver foto, o contato não permitir, ou qualquer falha (a rota nunca propaga erro do WhatsApp). Exige a instância conectada.

---

## 6. Webhooks

O gateway entrega eventos via `POST` para `CRM_WEBHOOK_URL`. O formato do corpo é o **formato Evolution**, o mesmo que o CRM já aceita hoje.

### 6.1 Envelope

```json
{
  "event": "messages.upsert",
  "instance": "canal-piloto",
  "data": {}
}
```

### 6.2 Headers e verificação de assinatura

| Header                | Conteúdo                                                          |
| --------------------- | ----------------------------------------------------------------- |
| `x-gateway-event-id`  | UUID do evento. Estável entre retries — **use para deduplicação** |
| `x-gateway-timestamp` | epoch em milissegundos, como string                               |
| `x-gateway-signature` | HMAC-SHA256 em hex                                                |

A assinatura é calculada sobre `` `${timestamp}.${eventId}.${body}` `` com `WEBHOOK_SIGNING_SECRET`:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verificar(rawBody, headers, secret) {
  const esperado = createHmac("sha256", secret)
    .update(
      `${headers["x-gateway-timestamp"]}.${headers["x-gateway-event-id"]}.${rawBody}`,
    )
    .digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(headers["x-gateway-signature"] ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

> **Crítico:** use o corpo **cru** (string exata recebida), não o resultado de `JSON.parse` + `JSON.stringify`. No Express, capture com `express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); } })`.

Valide também o `x-gateway-timestamp` contra uma janela (ex.: 5 minutos) para rejeitar replays.

### 6.3 Entrega, retry e ordenação

A entrega usa outbox transacional com garantia **at-least-once**:

- timeout de 10s por tentativa;
- qualquer status HTTP fora de 2xx conta como falha;
- retry com backoff exponencial: ~2s, 4s, 8s… até o teto de 300s, com jitter;
- **retentativas são infinitas** — o evento fica na fila até ser aceito. Um endpoint quebrado acumula backlog no banco indefinidamente.

Consequências para o CRM:

1. **Deduplique por `x-gateway-event-id`.** O mesmo evento pode chegar duas vezes (ex.: sua resposta 200 se perdeu).
2. **Não assuma ordem.** A entrega é concorrente (`WEBHOOK_CONCURRENCY`, default 4) e retries reordenam. Use `messageTimestamp` para ordenar mensagens.
3. **Responda 2xx rápido.** Processe de forma assíncrona; segurar a resposta por mais de 10s causa timeout e retry.

### 6.4 Eventos

#### `qrcode.updated`

Novo QR disponível para escaneamento. Emitido a cada rotação enquanto ninguém escaneia.

```json
{
  "event": "qrcode.updated",
  "instance": "canal-piloto",
  "data": {
    "qrcode": { "base64": "data:image/png;base64,...", "code": "2@AbC..." }
  }
}
```

`base64` pode ser `null` se a renderização da imagem falhar.

#### `connection.update`

Mudança de estado do socket. Dois formatos.

Conectado:

```json
{
  "event": "connection.update",
  "instance": "canal-piloto",
  "data": { "state": "open", "phone": "5511999999999" }
}
```

Desconectado:

```json
{
  "event": "connection.update",
  "instance": "canal-piloto",
  "data": {
    "state": "close",
    "reasonCode": "401",
    "reasonLabel": "Baileys disconnect 401",
    "logEvent": true
  }
}
```

`logEvent: false` indica um `restartRequired` — desconexão rotineira do protocolo, com reconexão imediata. **Não alerte o usuário nesses casos**; use o campo exatamente para isso.

`reasonCode` `"401"` (loggedOut) é o caso terminal: credenciais apagadas, `desired_state='stopped'`, novo QR obrigatório.

#### `messages.upsert`

Mensagem recebida (ou enviada por outro dispositivo do mesmo número).

```json
{
  "event": "messages.upsert",
  "instance": "canal-piloto",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0..."
    },
    "message": { "conversation": "Olá, tudo bem?" },
    "messageTimestamp": 1753790400,
    "pushName": "João",
    "_baileysMedia": {
      "storageKey": "whatsapp-media/9f3c1a2b-...",
      "mimeType": "image/jpeg",
      "filename": null,
      "size": 184320
    }
  }
}
```

`message` contém apenas o tipo presente, entre: `conversation`, `extendedTextMessage`, `imageMessage`, `audioMessage`, `pttMessage`, `videoMessage`, `documentMessage`, `stickerMessage`, `reactionMessage`. Mensagens sem nenhum tipo reconhecido não geram evento.

Todo nó de conteúdo — exceto `conversation` e `reactionMessage` — carrega um
`contextInfo`, consumido por `whatsapp-baileys-events.service.ts` para preencher
`replyToWaMessageId`, os snapshots da citação e `isForwarded`:

```json
"contextInfo": {
  "stanzaId": "3EB0CITADA",
  "participant": "5511999999999@s.whatsapp.net",
  "quotedMessage": { "conversation": "mensagem original" },
  "isForwarded": false,
  "forwardingScore": 0
}
```

`quotedMessage` é só um **resumo** da mensagem citada, com um único tipo entre
`conversation`, `extendedTextMessage` (`text`), `imageMessage`/`videoMessage`
(`caption`), `audioMessage` (`ptt`), `documentMessage` (`caption`, `fileName`) e
`stickerMessage` (objeto vazio) — nunca binário. Sem `contextInfo` no WhatsApp, o
campo é omitido.

`_baileysMedia` só aparece quando há mídia. O binário **já foi baixado e enviado ao Cloudflare R2** pelo gateway; `storageKey` é a chave do objeto no bucket. Monte a URL pública concatenando com `R2_PUBLIC_URL`, ou gere uma URL assinada — o CRM não precisa (e não deve) baixar do WhatsApp.

Não são entregues: `status@broadcast`, listas de transmissão (`@broadcast`) e newsletters (`@newsletter`) — filtrados na origem.

#### `messages.update`

Atualizações de status. **`data` é um array**, não um objeto:

```json
{
  "event": "messages.update",
  "instance": "canal-piloto",
  "data": [
    {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": true,
        "id": "3EB0..."
      },
      "update": { "status": "delivery_ack", "messageStubParameters": null }
    }
  ]
}
```

`status` vem em minúsculas (`pending`, `server_ack`, `delivery_ack`, `read`, `played`). Case o `key.id` com o `key.id` devolvido no envio.

---

## 7. Erros

| Status | Quando                                         | Corpo                                                                                                            |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `400`  | Validação de schema falhou                     | `{"message":"Requisição inválida","issues":[...]}` — `issues` é o array do Zod, com `path` e `message` por campo |
| `401`  | Bearer ausente ou incorreto                    | `{"message":"Não autorizado"}`                                                                                   |
| `404`  | Instância inexistente; ou `url` de mídia cuja chave não existe no bucket | Sem corpo em `GET /v1/instances/:name` e `GET .../qr`; `{"message":"Instância não encontrada"}` nas demais; `{"message":"Mídia não encontrada no armazenamento"}` no envio de mídia |
| `409`  | Conflito de `Idempotency-Key`                  | `{"message":"..."}` (ver 5.1)                                                                                    |
| `413`  | Base64 ou arquivo remoto acima do limite       | `{"message":"...excede o limite..."}`                                                                            |
| `429`  | Rate limit                                     | `{"message":"Muitas requisições"}`                                                                               |
| `502`  | Falha ao obter a mídia da `url`                | `{"message":"Não foi possível ler a mídia do armazenamento (<erro>)"}` no R2; `{"message":"Não foi possível baixar a mídia (HTTP <status>)"}` por HTTPS |
| `503`  | RSS acima do limite seguro, em `POST /connect` | `{"message":"Memória acima do limite seguro"}`                                                                   |
| `504`  | Timeout ao obter a mídia da `url`              | `{"message":"Tempo esgotado ao baixar a mídia"}`                                                                 |
| `500`  | Demais falhas                                  | `{"message":"<mensagem do erro>"}`                                                                               |

### Armadilha: instância desconectada retorna 500

Enviar mensagem para uma instância que existe mas não está conectada retorna **`500`** com `{"message":"Instância \"canal-piloto\" desconectada"}` — e não `409`/`503` como seria esperado.

O CRM não deve tratar todo `500` como bug do gateway. Sugestão: antes de enviar, verificar `observed_state === "connected"`; e no tratamento de erro, detectar a substring `"desconectada"` na mensagem para classificar como "canal offline, reconectar" em vez de "erro interno".

---

## 8. Health e observabilidade

| Rota                | Uso                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /health/live`  | `200 {"status":"ok"}` — processo vivo. Use como liveness probe                                             |
| `GET /health/ready` | `200 {"status":"ready","rss":<bytes>}` ou `503 {"status":"overloaded","rss":<bytes>}` quando RSS ≥ 1,65 GB |
| `GET /metrics`      | Métricas no formato texto do Prometheus                                                                    |

Métricas expostas: `baileys_gateway_connected`, `baileys_gateway_sessions`, `process_resident_memory_bytes`, `nodejs_heap_size_used_bytes`, `baileys_gateway_connections_opened_total`, `baileys_gateway_webhooks_delivered_total`, `baileys_gateway_webhooks_failed_total`, `baileys_gateway_lid_resolution_failures_total`.

Sinais de alerta para a operação:

- RSS sustentado acima de 1,5 GB → migrar para VM de 4 GB;
- `webhooks_failed_total` crescendo continuamente → endpoint do CRM rejeitando eventos, backlog acumulando no banco;
- `lid_resolution_failures_total` crescendo → mensagens recebidas sendo **descartadas** por não ser possível resolver o identificador `@lid` do WhatsApp para um número. Perda silenciosa de mensagens; investigar.

---

## 9. Checklist de integração

1. Guardar `GATEWAY_URL` e `GATEWAY_API_KEY` nos secrets do CRM.
2. Expor o endpoint de webhook e configurá-lo em `CRM_WEBHOOK_URL` no gateway.
3. Implementar a verificação de assinatura HMAC com o corpo cru, e a validação de janela de tempo.
4. Deduplicar eventos por `x-gateway-event-id`; responder 2xx em menos de 10s e processar assíncrono.
5. Na tela de canais: `POST /v1/instances` → `POST /connect` → renderizar `base64` → polling de `GET /qr` a cada 2–3s (ou consumir `qrcode.updated`) → sucesso quando `observed_state=connected`.
6. Em todo envio, mandar `Idempotency-Key` derivado do ID da mensagem no CRM.
7. Para mídia de saída, usar `url` em vez de `base64` sempre que possível, com `mimetype` explícito.
8. Para mídia de entrada, ler `_baileysMedia.storageKey` do R2 — nunca baixar do WhatsApp.
9. Tratar `500` com `"desconectada"` na mensagem como canal offline, não como erro interno.
10. Migrar **um canal por vez**, validando texto, mídia, recebimento e restart antes de avançar.
