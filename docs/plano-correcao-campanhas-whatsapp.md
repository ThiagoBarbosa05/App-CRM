# Correção de bugs críticos no fluxo de campanhas WhatsApp

## Context

Estamos migrando do Umbler Talk para uma solução própria de campanhas WhatsApp. A análise completa do fluxo (criação → enfileiramento → disparo via cron → webhooks de entrega) revelou bugs reais no motor de disparo que causam: campanhas fantasma reprocessadas para sempre, pause/cancel sendo sobrescritos, estatísticas de entrega estruturalmente zeradas em canais Evolution/Baileys, vazamento de reservas de dedupe que bloqueia campanhas futuras, e retry quebrado. Esta rodada corrige **apenas os bugs críticos**; as funcionalidades de paridade com o Umbler (prévia de audiência, envio de teste, throttling por campanha, janela de envio) ficam registradas como roadmap ao final.

### Arquitetura relevante (verificada)
- `campaigns` (definição, [shared/schema.ts:4871](shared/schema.ts:4871)) e `whatsapp_campaigns` (estado de disparo, [shared/schema.ts:3915](shared/schema.ts:3915)) compartilham o **mesmo PK**. Mensagens por destinatário em `whatsapp_campaign_messages`; reservas de dedupe em `whatsapp_campaign_impacts`. Statuses são colunas `text` (sem CHECK constraint) — mudanças de semântica não exigem migração.
- Dispatcher: [server/jobs/whatsapp-campaign-dispatcher.ts](server/jobs/whatsapp-campaign-dispatcher.ts) — cron 1/min, advisory lock, batch de 25, `finalizeIfDone`.
- Motor: [server/services/whatsapp-campaign.service.ts](server/services/whatsapp-campaign.service.ts) — `executeCampaign`, `handleSendFailure` (backoff só p/ 429), caminho bot (`startBotSession`) e template (Meta Cloud API).
- Enfileiramento: `POST /api/whatsapp/campaigns` em [server/routes/whatsapp.routes.ts:183](server/routes/whatsapp.routes.ts:183); dedupe em [server/services/whatsapp-campaign-dedupe.service.ts:231](server/services/whatsapp-campaign-dedupe.service.ts:231).
- Status de entrega: só via webhook Meta ([server/routes/whatsapp-webhook.routes.ts:241](server/routes/whatsapp-webhook.routes.ts:241)); eventos Evolution/Baileys convergem em `handleMessagesUpdate` ([server/services/whatsapp-baileys-events.service.ts:286](server/services/whatsapp-baileys-events.service.ts:286)) mas nunca tocam `whatsapp_campaign_messages`.

### Restrições do projeto
- **Nunca `npm run db:push`** — dados corrigidos via script `.mjs` (padrão `scripts/create-reactions-table.mjs`), com `--dry-run`.
- Testes: `npx vitest run --project unit`; testes de rota com `createRouteTestApp()` de `server/test/create-route-test-app.ts`; extrair lógica pura quando possível. Confirmar com `npx vitest list --project unit` que arquivos novos são coletados (globs fechados).
- TypeScript strict, sem `any`. `npm run check` pode OOM — usar tsconfig temporário na raiz incluindo `server/types/express.d.ts` + arquivos tocados.

---

## Passos (um commit por passo, suíte verde entre eles)

### 1. Classificação de erros retryable (Bug G)
**Novo** `server/services/whatsapp-campaign-retry.ts` (puro, sem import de db):
- `classifySendError(err: unknown): "retryable" | "permanent"` — `WhatsAppApiError` com `status === 429 || status >= 500` → retryable; outros 4xx → permanent; erros de rede (`TypeError` do fetch/undici, `code` em `ECONNRESET/ECONNREFUSED/ETIMEDOUT/EPIPE/EAI_AGAIN/UND_ERR_*`, `AbortError`/`TimeoutError`) → retryable; default permanent. Narrowing via type guard, sem `any`.
- Mover `computeBackoffMs` (service :41) para cá.
- Em `handleSendFailure` (service :53): trocar `isRateLimited` por `classifySendError(err) === "retryable"`; mensagem "Erro transitório — nova tentativa agendada (n/5): ...".

**Teste:** `server/services/__tests__/whatsapp-campaign-retry.unit.test.ts` — 429/500/503 retryable, 400/404 permanent, `{code:"ECONNRESET"}` retryable, `Error("boom")` permanent, backoff monotônico com teto 300s.

### 2. Pause/cancel vencem o batch em andamento (Bug B)
**Arquivos:** dispatcher, service, **novo** `server/services/whatsapp-campaign-finalize.ts` (puro).
- Extrair `decideFinalization(counts)` pura decidindo `completed | failed | não-terminal` (consome também o Bug H, passo 8).
- Em `finalizeIfDone`: adicionar `eq(whatsappCampaigns.status, "in_progress")` ao WHERE de **ambos** os UPDATEs (:54-63 e :66-74) — campanha pausada/cancelada nunca é ressuscitada. Não incluir `paused` no filtro.
- Em `executeCampaign`: antes de cada mensagem (loops bot e template), helper `isCampaignHalted(campaignId)` (select por PK) — se status ≠ `in_progress`, `break` e retornar `halted: true`. Dispatcher pula `finalizeIfDone` quando `halted`.

**Testes:** unit de `decideFinalization` (todas as combinações de contagem); unit de `executeCampaign` early-exit com db mockado (estilo `whatsapp-baileys-events.unit.test.ts`).

### 3. Campanhas órfãs param de dead-loopar (Bug A)
- No `runTick` (dispatcher :94-97): trocar o select de ativas por `innerJoin(campaigns, eq(campaigns.id, whatsappCampaigns.id))` — linhas legadas do Umbler (sem `campaigns`) nunca entram no loop. Não filtrar `deletedAt` (campanha soft-deletada em voo deve finalizar).
- **Novo** `scripts/fix-wa-campaign-orphans-and-stale-impacts.mjs` (com `--dry-run`):
  - `UPDATE whatsapp_campaigns wc SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE wc.status IN ('created','in_progress') AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = wc.id);`
  - + limpeza de impacts órfãos (passo 4).
- Em `executeCampaign` :144: lançar `CampaignConfigError` tipado; dispatcher loga como warning sem stack.

### 4. Reserva de dedupe só quando a mensagem realmente insere (Bug D)
**Arquivo:** [whatsapp-campaign-dedupe.service.ts:250](server/services/whatsapp-campaign-dedupe.service.ts:250).
- Insert da mensagem com `.onConflictDoNothing().returning({ id })` → `inserted = rows.length > 0`.
- Só inserir o impact quando `inserted && !conflict`.
- Retorno vira `{ queued: inserted && !conflict, alreadyExisted: !inserted, conflict }`. No consumidor (routes :428-452), `alreadyExisted` conta como `skippedAlreadyQueued` — corrige também inflação de contadores em re-submit.
- Script do passo 3 libera impacts presos: `UPDATE whatsapp_campaign_impacts SET status='released' WHERE status='reserved' AND EXISTS (mensagem correspondente em failed/cancelled/suppressed)`.

**Testes:** unit com tx mockada — conflito de insert → sem impact, `alreadyExisted=true`; insert limpo → impact criado; conflito de dedupe → suprimido sem impact.

### 5. Retry-failed reseta estado e restaura reservas (Bug E)
**Arquivos:** routes :520-546 → nova função de serviço `requeueFailedMessages(campaignId)` (transação única):
1. `UPDATE whatsapp_campaign_messages SET status='scheduled', error_message=NULL, attempts=0, next_attempt_at=NULL WHERE campaign_id=? AND status='failed' RETURNING id`.
2. `UPDATE whatsapp_campaign_impacts SET status='reserved', scheduled_for=NOW(), sent_at=NULL WHERE campaign_message_id IN (ids) AND status='released'` (a linha existe — `releaseImpact` é UPDATE). Sem re-rodar `findConflict` (retry é decisão explícita do operador; comentar).
3. Campanha: só voltar a `in_progress` se status atual ∈ `(completed, failed, in_progress)`; se `cancelled` → 409.

**Testes de rota** (`createRouteTestApp` + mock db): reset de attempts/nextAttemptAt; impacts released→reserved; cancelada → 409; zero failed → `requeued: 0`.

### 6. Enfileiramento idempotente e totais honestos (Bug F)
**Arquivo:** routes :183-514.
- Antes do upsert (:355), ler a linha existente de `whatsappCampaigns`: `in_progress`/`paused` → 409; `completed`/`failed`/`cancelled` → 409 sugerindo retry-failed; sem linha ou `created` → prossegue (reagendar campanha não iniciada continua legítimo).
- Substituir a aritmética final (:475-484) por recount agrupado no DB (`GROUP BY status` sobre `whatsapp_campaign_messages`): `totalContacts` = total de linhas, `scheduledMessages`/`sentMessages`/`failedMessages` do recount; status `completed` só quando `scheduled === 0`.
- Incluir `skippedAlreadyQueued` (do passo 4) na resposta 202.

**Testes de rota:** in_progress → 409 sem writes; cancelled → 409; created → permitido com startDate atualizado; totais = recount (semear linha suppressed pré-existente e conferir `totalContacts`).

### 7. Status de entrega para Evolution/Baileys + messageId do bot (Bug C)
- **Novo** `server/services/whatsapp-campaign-status.service.ts`: extrair `updateCampaignMessageStatus` do webhook (:241) como `applyCampaignDeliveryStatus(waMessageId, status, { eventAt, errorMessage? })`, levando `STATUS_RANK` (monotônico). Webhook Meta passa a chamar o serviço.
- **Fallback de matching:** se nenhum `whatsapp_campaign_messages.messageId` bate, buscar `whatsappMessages` por `waMessageId` e seguir o FK `campaignMessageId` (gravado por `persistCampaignMessageToConversation`) — resiliente a `messageId` nulo no caminho bot.
- Em `handleMessagesUpdate` ([whatsapp-baileys-events.service.ts:286](server/services/whatsapp-baileys-events.service.ts:286)), após o update de `whatsappMessages` (:316-345), chamar `applyCampaignDeliveryStatus(...)` fire-and-forget com `.catch` (mesmo estilo do webhook :200). Cobre Evolution e Baileys direto.
- Bot engine: nos retornos recursivos de `executeNode` que sobrescrevem `lastMessageId` com null, aplicar `const tail = await executeNode(...); if (tail) lastMessageId = tail;` — último id não-nulo vence.
- **Não** liberar impact em failed vindo de webhook (a mensagem saiu de fato) — documentar.

**Testes:** unit de `applyCampaignDeliveryStatus` (match direto; fallback via FK; downgrade de rank ignorado; failed grava errorMessage); estender `whatsapp-baileys-events.unit.test.ts` para afirmar a chamada.

### 8. Status honesto para campanha toda suprimida (Bug H)
- Sem novo valor de status. Em `decideFinalization` (passo 2): `remaining=0, sent=0, failed=0` → `completed` com contadores zerados.
- Frontend: em [campaign-details.tsx](client/src/pages/whatsapp/campaign-details.tsx), se `status === "completed" && stats.total > 0 && stats.suppressed === stats.total`, badge "Concluída — todos os contatos suprimidos".

### 9. `already_active` vira retry, não falha instantânea (Bug I)
**Arquivo:** service :291-305 — separar o branch combinado:
- `no_start_node`: continua `failed` permanente (erro de config).
- `already_active`: reagendar com o backoff do passo 1 (`scheduled`, `attempts+1`, `nextAttemptAt`), mensagem "Contato com sessão de bot ativa — nova tentativa agendada (n/5)"; esgotadas as tentativas → `failed` com mensagem autoexplicativa + `releaseImpact`. Impact fica `reserved` até terminal (envio ainda é pretendido).

**Testes:** unit com `startBotSession` mockado — attempts<max → reagendado, impact intacto; attempts no max → failed + released.

### 10. (Stretch) Motivos de supressão estáveis compartilhados
- **Novo** `shared/whatsapp-campaign-reasons.ts` com as strings PT exatas como `const` + `classifySuppressionReason(reason)` pura (fallback `other` p/ strings legadas). Substituir literais em routes :323/:331/:338, audience service :67-72, dedupe :262, e o substring-matching em `campaign-details.tsx:237-249`.
- `suppressionReasonCode` estruturado no DB fica como follow-up (exigiria migração + backfill).

---

## Verificação
- Após cada passo: `npx vitest run --project unit` (+ conferir coleta com `npx vitest list --project unit` para arquivos novos).
- Typecheck dos arquivos tocados via `tsconfig.tmp.json` na raiz (incluindo `server/types/express.d.ts`), pois `npm run check` completo pode OOM.
- Script `.mjs` (passos 3/4): rodar manualmente com `--dry-run` primeiro, depois efetivo. Nunca `db:push`.
- Sem verificação visual em navegador (regra do projeto) — mudança de badge do passo 8 valida por leitura de código.

---

## Roadmap de paridade Umbler Talk (próxima rodada — todas priorizadas pelo usuário)
1. **Tela de prévia da audiência** — a API `POST /api/whatsapp/campaigns/preview` já retorna `optedOut/invalidPhone/duplicatePhone/conflicts`, mas o front descarta ([use-whatsapp.ts:525-547](client/src/hooks/use-whatsapp.ts)); adicionar etapa de confirmação no wizard mostrando o breakdown antes do disparo.
2. **Envio de teste** — endpoint + botão "enviar teste" para número avulso no passo 3 do wizard (hoje inexistente em back e front).
3. **Throttling por campanha** — expor `intervalSeconds` (existe no schema, hardcoded em `1` em routes :368) no wizard e usá-lo em `executeCampaign` no lugar do setting global `wa_message_delay_ms`.
4. **Janela de envio / horário comercial** — campos de janela (ex. 9h–18h, `America/Sao_Paulo`) na campanha; dispatcher pula ticks fora da janela sem marcar como pausada.

Outras dívidas anotadas (não nesta rodada): paginação real da lista de campanhas (backend capa em 50 e o front não pagina), pause/cancel sem checagem de ownership/role, N+1 no preview e no `getCampaignStats`, canal hardcoded na tela de detalhes, endpoint `retry-tags` sem UI.
