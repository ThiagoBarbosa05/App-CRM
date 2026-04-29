# Plano de Migração: Twilio + ElevenLabs para CRM B2C

## Contexto

O projeto atual (`Call-Center-Grand`) foi construído como sandbox para validar o fluxo de discagem outbound com IA via ElevenLabs e WebRTC via Twilio Voice SDK. Tudo já está funcional:

- **Discador WebRTC** (`discador.tsx`) — operador humano fala pelo navegador via Twilio Device.
- **Teste ElevenLabs** (`teste-elevenlabs.tsx`) — dispara uma chamada IA pontual ou conversa via WebRTC direto com o agente.
- **Campanhas** (`campanhas.tsx`) — cria campanha tipo `humano` ou `ia`, dispara em massa para todos os leads `novo`, monitora status, configura gatilhos de palavra-chave.

O objetivo agora é portar **somente a engine de chamadas** (Twilio + ElevenLabs) para um CRM B2C novo, descartando OpenAI Whisper. A transcrição passará a vir exclusivamente de **ElevenLabs (post-call webhook + sync API)** e, opcionalmente, **Twilio Voice Intelligence** para chamadas humanas.

Resultado esperado: o novo CRM terá página de discador, página de teste de agente IA, e capacidade de criar campanhas IA que disparam chamadas em lote, capturam decisão (`sim`/`nao`/`sem_resposta`) do lead e atualizam status automaticamente.

---

## 1. Arquitetura — visão geral do que migrar

### 1.1 Fluxo "Operador → cliente" (WebRTC humano)
```
Browser (Twilio Device) ─token JWT─> Twilio
       │                                │
       │ device.connect({To, callerId}) │
       ▼                                ▼
   /api/twilio/token        TwiML App ──> POST /api/twilio/voice
                                              │ (campaignType=humano)
                                              ▼
                                          <Dial callerId> + record
                                              │
                                              ▼
                                       cliente atende
```

### 1.2 Fluxo "Campanha IA → cliente"
```
POST /api/campaigns/:id/dispatch
   │ (loop nos leads status=novo, 200ms entre cada)
   ▼
Twilio.calls.create({To, From, Url=/api/twilio/voice?...})
   │
   ▼
Twilio liga p/ cliente; cliente atende; Twilio busca TwiML
   │
   ▼
POST /api/twilio/voice (campaignType=ia&agentId=...&voiceId=...)
   │
   ├─> POST elevenlabs/twilio/inbound_call ─> retorna TwiML stream
   │   (extrai conversation_id e salva no callRecord)
   ▼
ElevenLabs ↔ cliente (audio bidirecional via WebSocket Twilio Stream)
   │
   ├─> Tool call mid-chamada: POST /api/elevenlabs/decision
   │   (sim/nao/sem_resposta → atualiza lead.status + call.outcome)
   │
   └─> Pós-chamada: POST /api/elevenlabs/webhook
       (transcript + summary; varre triggers; cria notifications)

Twilio paralelamente envia:
  ├─> POST /api/calls/twilio-status (a cada mudança de estado)
  └─> POST /api/calls/recording-status (quando gravação fica pronta)
       └─> opcional: triggerTwilioIntelligence(recordingSid)
            └─> POST /api/calls/twilio-transcription (resultado)
```

### 1.3 Fluxo "Teste de agente no navegador" (sem telefonia)
```
Browser (@elevenlabs/react ConversationProvider)
   │
   ▼ navigator.getUserMedia({audio})
conversation.startSession({agentId, connectionType:"webrtc"})
   │
   ▼
ElevenLabs SDK abre WebRTC direto com o agente
(zero custo de telefonia, zero backend envolvido)
```

---

## 2. Schema de banco (Drizzle ORM / PostgreSQL)

Replicar 4 tabelas + 1 store de configuração no novo CRM. Ajustar nomes de FK conforme as tabelas de `customers`/`users` já existentes lá.

### 2.1 `calls` — registro de cada ligação
```ts
id              serial PK
leadId          int FK -> customers (renomear conforme schema do CRM)
operatorId      int FK -> users (NOT NULL)
campaignId      int FK -> campaigns (nullable p/ ligações do discador)
twilioCallSid   text
elevenLabsConversationId text
status          enum('iniciando','em_andamento','encerrada','nao_atendeu','ocupado','falhou','caixa_postal')
outcome         enum('atendeu','nao_atendeu','ocupado','caixa_postal','numero_invalido','convertido','reagendado')
duration        int (segundos)
notes           text
recordingUrl    text
recordingSid    text
transcription   text          -- vem do ElevenLabs post-call webhook
twilioTranscription text      -- opcional, do Twilio Intelligence
summary         text          -- vem do ElevenLabs analysis (não OpenAI)
sentiment       enum('positivo','neutro','negativo')
aiDecision      enum('sim','nao','sem_resposta')
nextStep        text
startedAt       timestamp
endedAt         timestamp
createdAt       timestamp default now()
```

### 2.2 `campaigns`
```ts
id                  serial PK
name                text NOT NULL
description         text
status              enum('rascunho','ativa','pausada','encerrada')
type                enum('humano','ia')
elevenLabsAgentId   text          -- obrigatório se type=ia
elevenLabsVoiceId   text          -- override opcional do voice global
startDate, endDate  timestamp
createdAt, updatedAt timestamp
```

### 2.3 `campaign_triggers` — palavras-chave que notificam o operador/supervisor
```ts
id            serial PK
campaignId    int FK NOT NULL
keyword       text NOT NULL
instruction   text          -- mensagem opcional p/ exibir
createdAt     timestamp
```

### 2.4 `notifications` — gerada por triggers e por decisão IA
```ts
id          serial PK
userId      int FK NOT NULL
callId      int FK
leadId      int FK
triggerId   int FK
message     text
excerpt     text
readAt      timestamp nullable
createdAt   timestamp
```

### 2.5 `settings` — key-value para credenciais editáveis em runtime
```ts
key         varchar(100) PK
value       text NOT NULL
updatedAt   timestamp
updatedBy   varchar(100)
```
Chaves usadas:
- `twilio_account_sid`, `twilio_auth_token`, `twilio_from_number`, `twilio_status_callback_url`
- `twilio_api_key`, `twilio_api_secret`, `twilio_twiml_app_sid`
- `twilio_intelligence_service_sid` (opcional, só para humano)
- `twilio_record_calls` ("true"/"false")
- `twilio_from_numbers` (JSON array `[{label, number}]` — múltiplos canais)
- `elevenlabs_api_key`, `elevenlabs_voice_id`
- `server_base_url`

### 2.6 Ajustes ao schema de `leads/customers` do CRM B2C
Adicionar (se ainda não houver) o status para fluxo de campanha:
```ts
status enum(... existing,
  'novo','contactado','nao_atendeu','ocupado','caixa_postal',
  'convite_aceito','convite_recusado','convertido','desqualificado')
campaignId int FK nullable -> campaigns
```

---

## 3. Variáveis de ambiente (configuração)

Todas as chaves caem em **fallback** se ausentes do banco (precedência: `settings` → `process.env.*`).

| Variável | Onde obter | Quando obrigatória |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | console.twilio.com | sempre |
| `TWILIO_AUTH_TOKEN` | console.twilio.com (revelar token) | sempre |
| `TWILIO_FROM_NUMBER` | número comprado (E.164) | se não houver `twilio_from_numbers` |
| `TWILIO_STATUS_CALLBACK_URL` | sua URL pública + `/api/calls/twilio-status` | recomendada |
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | console → API Keys → Standard | discador WebRTC |
| `TWILIO_TWIML_APP_SID` | console → TwiML Apps (Voice URL aponta para `/api/twilio/voice`) | discador WebRTC |
| `TWILIO_INTELLIGENCE_SERVICE_SID` | console → Voice Intelligence (pt-BR) | opcional, apenas chamadas humano |
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API Keys | campanhas IA |
| `ELEVENLABS_VOICE_ID` | elevenlabs.io → Voices → Voice Lab | opcional global |
| `SERVER_BASE_URL` | URL pública do backend, **sem barra final** | sempre (webhooks) |
| `DATABASE_URL` | Postgres connection string | sempre |
| `SESSION_SECRET` | string aleatória 32+ chars | sempre |

**Importante**: `SERVER_BASE_URL` precisa estar acessível pela internet — em dev use ngrok, cloudflared ou Tailscale Funnel. Twilio e ElevenLabs precisam alcançar `/api/twilio/voice`, `/api/calls/twilio-status`, `/api/calls/recording-status`, `/api/calls/twilio-transcription`, `/api/elevenlabs/decision`, `/api/elevenlabs/webhook`.

---

## 4. Backend — rotas a portar

Pasta-alvo no novo CRM: `<api-server>/src/routes/`. Manter todas sob prefixo `/api`.

### 4.1 `routes/twilio.ts`
- `GET /api/twilio/token` → JWT do Voice SDK; identidade `operator_<userId>`. Usa `requireAuth`.
- `GET /api/twilio/voice-sdk-status` → `{configured: bool}`.
- `GET /api/twilio/channels` → lista de números cadastrados (JSON em settings).
- `POST /api/twilio/voice` → TwiML (sem auth, **com validação de assinatura**). Lógica:
  - Se `campaignType=ia`: chama `https://api.elevenlabs.io/v1/convai/twilio/inbound_call` com `agent_id`, `agent_phone_number_id` e `conversation_config_override.tts.voice_id` opcional. Extrai `conversation_id` do TwiML retornado, persiste em `calls.elevenLabsConversationId`. Repassa o TwiML cru para o Twilio.
  - Caso contrário: gera `<Response><Dial callerId=...><Number>{to}</Number></Dial></Response>` com `record="record-from-answer-dual"` se `twilio_record_calls=true`.
- `POST /api/twilio/test-call` → cria call record + dispara `twilio.calls.create` com `Url=<SERVER_BASE_URL>/api/twilio/voice?callRecordId=...&elevenlabsAgentId=...&elevenLabsVoiceId=...&campaignType=ia`. Retorna `{callSid, callRecordId, status, to}`.
- `GET /api/twilio/test-call/:callSid/status` → polling do estado.
- `DELETE /api/twilio/test-call/:callSid` → encerra via Twilio API.
- `POST /api/twilio/configure-voice-url` → admin atualiza Voice URL do TwiML App apontando para `/api/twilio/voice` deste servidor.
- `GET /api/twilio/recording/:callId?token=...` → proxy autenticado do MP3 (Twilio exige basic auth).

### 4.2 `routes/calls.ts`
- `GET /api/calls` paginação + filtros (status, campaignId, leadId, operatorId).
- `POST /api/calls`, `GET/PUT /api/calls/:id`, `POST /api/calls/:id/end`.
- `POST /api/calls/twilio-status` (sem auth, **assinatura validada**) — atualiza `status`, `duration`, `recordingUrl`. Mapeia `CallStatus` → enum interno.
- `POST /api/calls/recording-status` (sem auth, assinatura validada) — salva `recordingSid` + `recordingUrl`. Se `twilio_intelligence_service_sid` existir e for chamada humano, dispara Voice Intelligence.
- `POST /api/calls/twilio-transcription` — recebe resultado do Voice Intelligence e grava em `twilioTranscription`.
- `POST /api/calls/:id/sync-transcript` (auth) — busca direto na ElevenLabs API conversação `conversationId` e atualiza transcript/summary/sentiment/aiDecision. **Substitui o caminho do Whisper.**
- ❌ **Remover** `POST /api/calls/:id/transcribe` (era OpenAI Whisper).

### 4.3 `routes/campaigns.ts`
- CRUD padrão de campanhas.
- `POST /api/campaigns/:id/dispatch` (admin/supervisor) — itera leads `status=novo`, cria call record, chama Twilio com URL TwiML construída. **Loop com `await new Promise(r => setTimeout(r, 200))` entre cada lead** para não estourar rate limit. Retorna `{dispatched, total, calls: [{leadId, leadName, callSid, callRecordId, status}]}`.
- `GET/POST/DELETE /api/campaigns/:id/triggers` — gerencia palavras-chave.

### 4.4 `routes/elevenlabs.ts`
- `POST /api/elevenlabs/decision` (sem auth — chamado pelo agente como _tool_) — body: `{conversation_id, decision: "sim"|"nao"|"sem_resposta", reason?}`. Atualiza `call.outcome`, `call.aiDecision`, `lead.status` (`convite_aceito`/`convite_recusado`/`nao_atendeu`). Cria notifications p/ operadores da campanha.
- `POST /api/elevenlabs/webhook` (sem auth — post-call) — body: `{conversation_id, transcript, analysis: {summary, evaluation, sentiment}, status}`. Persiste transcript completo e summary. Varre `campaign_triggers`: se `keyword` aparece no transcript, cria `notification` com excerpt (50 chars antes/depois).
- `GET /api/elevenlabs/conversation/:id/fetch` (auth) — chamada manual: busca em `https://api.elevenlabs.io/v1/convai/conversations/{id}` e sincroniza no DB. Endpoint usado pelo botão "Buscar Transcrição" em `teste-elevenlabs.tsx`.

### 4.5 Helpers — `lib/twilio-config.ts`
Funções a portar 1:1: `getTwilioConfig()`, `getTwilioVoiceSdkConfig()`, `getTwilioChannels()`, `getElevenLabsKey()`, `getElevenLabsVoiceId()`, `isRecordCallsEnabled()`, `getServerBaseUrl()`, `getTwilioIntelligenceServiceSid()`, `toE164Brazil()`. Cada uma lê DB primeiro, depois `process.env`.

### 4.6 Auth middleware
Reutilizar o middleware do CRM B2C existente. Ao migrar, **só** preservar `requireAuth` + `requireRole(['administrador','supervisor'])` em endpoints privilegiados (dispatch, configurar voice URL, settings).

### 4.7 Validação de assinatura Twilio
Em todos os webhooks do Twilio:
```ts
const valid = twilio.validateRequest(authToken, signatureHeader, fullUrl, req.body);
if (!valid && process.env.NODE_ENV === 'production') return res.sendStatus(403);
```

### 4.8 Validação ElevenLabs
ElevenLabs hoje usa apenas o segredo na URL ou um header HMAC opcional. Recomendado: adicionar um path-prefix com token (`/api/elevenlabs/webhook/:secret`) e validar `secret === process.env.ELEVENLABS_WEBHOOK_SECRET`. **Ponto novo no CRM B2C.**

---

## 5. Frontend — páginas e hooks a portar

Pasta-alvo: `<crm-b2c>/src/pages/` + `src/hooks/`.

### 5.1 Hook `use-twilio-device.ts`
Portar integralmente. Dependências: `@twilio/voice-sdk`. Faz fetch em `/api/twilio/token`, registra Device, expõe `connect`, `disconnect`, `isMuted`, `toggleMute`, `deviceStatus`, `callStatus`, `errorMessage`.

### 5.2 Página `discador` (1:1 do `discador.tsx`)
- Teclado numérico, formatador BR (`toE164Brazil`).
- Seletor de canal de saída (lista de `/api/twilio/channels`).
- Status do device + botão Mute + Encerrar.
- Fallback `tel:` link se Voice SDK não configurado.

### 5.3 Página `teste-agente-ia` (1:1 do `teste-elevenlabs.tsx`)
- Aba **Browser**: usa `@elevenlabs/react` `ConversationProvider` + `useConversation` para WebRTC direto, **sem backend**. Pede mic, chama `startSession({agentId, connectionType:'webrtc'})`.
- Aba **Phone**: usa `/api/twilio/test-call` com seletor de canal, lead, voice ID, agent ID. Polling de status. Após terminar, polling de transcript via `/api/calls/:id` → após 2 retries cai em `/api/calls/:id/sync-transcript`.

### 5.4 Página `campanhas` (1:1 do `campanhas.tsx`)
- CRUD com Dialog + react-hook-form + zod.
- Dialog "Gerenciar": adicionar/remover leads, configurar gatilhos (apenas se `type=ia`).
- Dialog "Pré-disparo": seletor de canal + contagem de leads `novo` + botão Confirmar Disparo.
- Dialog "Monitor": tabela com `leadName + callSid`, badge de status, polling 3s em `/api/twilio/test-call/:sid/status` por chamada não-terminal, barra de progresso `done/total`.

### 5.5 Página `configuracoes` (resumida)
Formulário admin: campos para todas as chaves de `settings` da seção 2.5. Botão "Configurar Voice URL automaticamente" → `POST /api/twilio/configure-voice-url`. Endpoint `/api/integrations/status` mostra ✅/❌ por integração.

---

## 6. Configuração externa (Twilio + ElevenLabs)

### 6.1 Twilio — passos manuais no console
1. **Comprar número** com capacidade de Voice (e SMS opcional). Anotar em E.164.
2. **API Key** (Account → API Keys → Create Standard) → copiar SID + Secret.
3. **TwiML App** (Voice → TwiML Apps → Create):
   - Voice Request URL: `https://<SERVER_BASE_URL>/api/twilio/voice` (POST)
   - Voice Status Callback: `https://<SERVER_BASE_URL>/api/calls/twilio-status` (POST)
4. **Voice Intelligence Service** (opcional, só humano): criar Service em pt-BR → copiar SID.
5. **Recording callbacks**: configurados via parâmetros do `<Dial record="...">` no TwiML, apontando para `/api/calls/recording-status`.

### 6.2 ElevenLabs — passos no painel
1. **Criar Agent** em Conversational AI → copiar `agent_id`.
2. **Configurar voz** do agente (clonada ou pré-set) → copiar `voice_id` (ou deixar campanha-level).
3. **Tools customizadas** no agente:
   - Tool `decisao`: webhook `POST <SERVER_BASE_URL>/api/elevenlabs/decision` com `{decision: 'sim'|'nao'|'sem_resposta', reason?}`. Descrição: "Use quando o lead aceitar, recusar, ou ficar sem resposta sobre o convite/oferta."
4. **Post-call webhook** (Settings → Webhooks): `POST <SERVER_BASE_URL>/api/elevenlabs/webhook`. Habilitar transcript + analysis + audio metadata.
5. **Conectar número Twilio** (Phone Numbers tab): adicionar com Twilio SID + auth token, ou usar SIP trunk. Anotar `agent_phone_number_id` — o backend usa em `register-call`.

---

## 7. Implementação — passo a passo

### Etapa 1 — Schema (1-2h)
1. No projeto B2C, criar arquivos em `lib/db/src/schema/`: `calls.ts`, `campaigns.ts`, `campaign_triggers.ts`, `notifications.ts`, `settings.ts`. Copiar de `Call-Center-Grand` ajustando FKs ao nome correto da tabela de clientes do B2C.
2. Adicionar enums novos a `customers.status` (ou criar tabela `customer_call_status` se preferir não tocar enum existente).
3. `pnpm push` (Drizzle).
4. Smoke: `psql` confirmar tabelas criadas.

### Etapa 2 — Configuração e helpers (1h)
5. Criar `lib/twilio-config.ts` (porta 1:1).
6. Criar rota `GET/POST /api/settings` para CRUD do key-value.
7. Adicionar variáveis ao `.env` e ao `.env.example`.

### Etapa 3 — Rotas Twilio (3-4h)
8. Portar `routes/twilio.ts`. Validar com `curl` + `ngrok`:
   - `GET /api/twilio/token` retorna JWT.
   - `POST /api/twilio/test-call` com agent_id real cria chamada visível no console Twilio.
9. Portar `routes/calls.ts` **sem o handler `/transcribe` (Whisper)**. Validar webhooks com tunnel ativo.

### Etapa 4 — Rotas ElevenLabs (2h)
10. Portar `routes/elevenlabs.ts`. Adicionar validação por path-secret.
11. Configurar agent + tool + post-call webhook no painel ElevenLabs apontando para o tunnel.
12. Smoke: chamada IA real → verificar `aiDecision` populado em DB.

### Etapa 5 — Rotas Campanhas (2h)
13. Portar `routes/campaigns.ts` incluindo dispatch e triggers.
14. Smoke: criar campanha IA com 2 leads de teste, disparar, observar logs.

### Etapa 6 — Frontend hooks + páginas (4-5h)
15. Instalar deps: `@twilio/voice-sdk`, `@elevenlabs/react`.
16. Portar `hooks/use-twilio-device.ts`.
17. Portar `pages/discador.tsx` adaptando layout ao Layout do B2C.
18. Portar `pages/teste-agente-ia.tsx`.
19. Portar `pages/campanhas.tsx`.
20. Adicionar entradas no router (provavelmente React Router no B2C, **não wouter** — adaptar imports).
21. Adicionar entradas no menu lateral, com guard de role admin/supervisor.

### Etapa 7 — Configurações UI (2h)
22. Portar `pages/configuracoes.tsx` ou integrar campos numa seção "Telefonia & IA" da tela de settings existente do B2C.
23. Botão "Configurar Voice URL" + indicador de status das integrações.

### Etapa 8 — Validação ponta-a-ponta (2h)
24. Testar discador WebRTC com número real.
25. Testar conversa via browser na aba "No Navegador" do teste de agente.
26. Testar chamada IA pontual com lead real, verificar:
    - Status flui `iniciando → em_andamento → encerrada`.
    - `elevenLabsConversationId` populado.
    - Após desligar, transcript + summary + aiDecision aparecem em até 30s.
    - Lead muda para `convite_aceito`/`convite_recusado` se aplicável.
27. Testar disparo de campanha IA com 3 leads. Verificar monitor em tempo real.
28. Testar trigger: incluir palavra-chave que o lead diga; conferir notification criada.

### Etapa 9 — Limpeza e prod (1h)
29. Remover qualquer referência a OpenAI Whisper (rota, env var, chamadas no frontend).
30. Subir `SERVER_BASE_URL` para domínio real (não ngrok).
31. Reconfigurar Voice URL do TwiML App e webhooks ElevenLabs apontando para produção.
32. Rotacionar `TWILIO_AUTH_TOKEN` e `ELEVENLABS_API_KEY` se foram expostas em dev.

---

## 8. Arquivos críticos para portar (referências do projeto fonte)

| Origem (Call-Center-Grand) | Destino (CRM B2C) |
|---|---|
| `lib/db/src/schema/calls.ts` | `lib/db/src/schema/calls.ts` |
| `lib/db/src/schema/campaigns.ts` | `lib/db/src/schema/campaigns.ts` |
| `lib/db/src/schema/settings.ts` | idem |
| `lib/db/src/schema/notifications.ts` | idem |
| `artifacts/api-server/src/lib/twilio-config.ts` | `<api>/src/lib/twilio-config.ts` |
| `artifacts/api-server/src/routes/twilio.ts` | `<api>/src/routes/twilio.ts` |
| `artifacts/api-server/src/routes/calls.ts` | `<api>/src/routes/calls.ts` (sem `/transcribe`) |
| `artifacts/api-server/src/routes/campaigns.ts` | idem |
| `artifacts/api-server/src/routes/elevenlabs.ts` | idem |
| `artifacts/call-center/src/hooks/use-twilio-device.ts` | `<frontend>/src/hooks/use-twilio-device.ts` |
| `artifacts/call-center/src/pages/discador.tsx` | idem |
| `artifacts/call-center/src/pages/teste-elevenlabs.tsx` | renomear `teste-agente-ia.tsx` |
| `artifacts/call-center/src/pages/campanhas.tsx` | idem |
| `artifacts/call-center/src/pages/configuracoes.tsx` | mesclar com settings existente |

---

## 9. O que NÃO migrar

- **OpenAI Whisper**: rota `/api/calls/:id/transcribe`, helper `triggerTranscription()` em `calls.ts`, chave `OPENAI_API_KEY`. A transcrição agora vem 100% do ElevenLabs (`/sync-transcript` + post-call webhook). Twilio Voice Intelligence permanece como opção para chamadas humano.
- Componentes específicos da UI do call-center que não façam sentido no B2C (dashboards de operador, escalação, etc.) — escolher a dedo.

---

## 10. Verificação de fim-a-fim

Cenários a executar no novo CRM antes de considerar feito:

1. **Login admin → Configurações** → preencher creds Twilio + ElevenLabs → `Configurar Voice URL` → status integrações ✅.
2. **Discador** → discar número de celular pessoal → ouvir áudio bidirecional → desligar → registro de call em `/calls` com `recordingUrl` populado em ~10s.
3. **Teste de agente** aba Browser → conversar com agente IA via WebRTC → encerrar; nenhum custo Twilio incorrido.
4. **Teste de agente** aba Phone → discar para celular pessoal → agente IA atende → responder "sim" à pergunta-gatilho → desligar → em ~20s, painel mostra transcript + summary + decisão "sim".
5. **Campanhas** → criar IA com 2 leads → Disparar → monitor mostra ambos passando por ringing → in-progress → completed → após 30s, leads atualizados com `convite_aceito`/`convite_recusado`.
6. **Triggers** → adicionar keyword "preço" → ligação onde lead diga "preço" → notificação criada para operadores da campanha.
7. **Conferir DB**: `select id, twilio_call_sid, eleven_labs_conversation_id, status, ai_decision, summary from calls order by id desc limit 5;` mostra dados consistentes.
