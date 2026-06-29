# Verificação de integridade dos 6 nós do bot WhatsApp — correções

## Context

Os 6 nós novos (`edit_tags`, `end_conversation`, `distribute_flow`, `send_template`, `transfer_agent`, `trigger_flow`) foram implementados via TDD e passam em isolamento (57 testes verdes). Mas uma auditoria cruzada entre o engine, o job de expiração de sessões, o webhook e o editor revelou lacunas de **integração** que os testes unitários/e2e não pegaram porque não exercitam os jobs e o webhook em conjunto:

1. **`no_response` é inalcançável em produção.** Um nó `send_template` pausado grava `responseDeadlineAt` (prazo de 24h) mas **não** grava `resumeAt`. O job `expireInactiveSessions` (varre a cada 1 min) marca como `timed_out` toda sessão `active` com `lastActivityAt < agora-30min` **e** `resumeAt IS NULL`. Resultado: a sessão é morta aos 30 min, muito antes das 24h, e `processTemplateTimeouts` (que exige `status="active"`) nunca dispara o handle `no_response`. O e2e passa só porque chama `processTemplateTimeouts()` direto, sem rodar o job de expiração.

2. **`executeNode` ainda não tem `default`.** Era a motivação original do esforço. Todos os 14 tipos hoje têm `case`, mas um tipo desconhecido (corrupção de dado / tipo futuro) ainda morre em silêncio — sessão presa sem log.

3. **`end_conversation` ignora `closedBy`.** O editor grava o campo; o engine escreve uma nota de sistema genérica sem atribuir quem encerrou.

4. **Roteamento de botão de template é frágil.** Toques em botão de template chegam como `message.button` (type `"button"`) com `replyId = null` (o webhook só extrai id de `interactive.button_reply`/`list_reply`). O engine acerta hoje via fallback por label (`buttonHandles[].label === button.text`, confirmado: o editor grava `label = caption`). Porém, se `replyId` vier preenchido mas não casar com `btn-N`, o engine retorna `invalid_response` sem tentar o label — quebra o caso interativo.

5. **`send_template` sem try/catch no envio.** Diferente do template em `send_message` (linhas ~310-368, que captura e relança erro amigável), uma exceção em `sendTemplateMessage` abandona a sessão `active`.

Itens **fora de escopo** (decisão do usuário): `onlyIfCurrentHasPermission` permanece **no-op documentado** — não há campo de permissão no schema; será apenas comentado como limitação conhecida.

Arquivo único de produção afetado no core: `server/services/whatsapp-bot-engine.service.ts`. Webhook: `server/routes/whatsapp-webhook.routes.ts`. Testes: `server/services/__tests__/whatsapp-bot-engine.{e2e,unit}.test.ts`. Cada correção segue **TDD (Red → Green)** e roda com `TEST_DATABASE_URL` setado via `pnpm vitest run`.

---

## Correções (cada uma em ciclo Red→Green)

### 1. `no_response` inalcançável — guarda no `expireInactiveSessions` (P1)
`server/services/whatsapp-bot-engine.service.ts` (~linha 1169).

- **RED (e2e)**: fluxo `start → send_template(noResponseHandle)`; após pausar, chamar `expireInactiveSessions()` (sem mexer no `responseDeadlineAt`); afirmar que a sessão continua `active` (hoje vira `timed_out`). Em seguida, forçar `responseDeadlineAt` no passado, chamar `processTemplateTimeouts()` e afirmar que roteou para `no_response`.
- **GREEN**: adicionar `isNull(whatsappBotSessions.responseDeadlineAt)` ao `and(...)` do `expireInactiveSessions`, espelhando a guarda já existente de `isNull(resumeAt)`. Sessões com prazo de resposta pendente deixam de ser varridas pela inatividade de 30 min.

### 2. `default` no switch de `executeNode` (P2)
`server/services/whatsapp-bot-engine.service.ts` (fim do `switch`, ~linha 800).

- **GREEN (defensivo)**: adicionar `default:` que faz `console.error("[BotEngine] Tipo de nó não suportado:", node.type)` e completa a sessão (`status: "completed"`) para não prender o contato. Observação: o enum de `type` no banco impede inserir um tipo inválido pelo caminho normal, então este ramo é uma guarda contra corrupção/tipos futuros e não é diretamente testável via DB — entra como hardening, sem teste dedicado (consistente com a exceção de "código defensivo" do TDD).

### 3. `end_conversation` honra `closedBy` (P3)
`server/services/whatsapp-bot-engine.service.ts` (case `end_conversation`, ~linha 804).

- **RED (e2e)**: `end_conversation` com `closedBy = <agentId>`; afirmar que a nota de sistema referencia quem encerrou (ex.: inclui o nome/“atendente”/“dono do chat” conforme `owner|agent|agentId`).
- **GREEN**: montar o texto da nota a partir de `d.closedBy` (resolver `owner`/`agent`/agentId → texto), mantendo o default atual quando ausente.

### 4. Hardening do matcher de botão de `send_template`
`server/services/whatsapp-bot-engine.service.ts` (branch `send_template` em `handleIncomingMessage`, ~linha 1095).

- **RED (e2e)**: simular toque com `replyId` preenchido porém **não** correspondente a nenhum `btn-N`, e `messageText` igual ao label de um botão → deve rotear para o botão (hoje cai em `invalid_response`/null).
- **GREEN**: trocar a lógica para tentar **handle por replyId e, se não casar, cair para label**: `const matched = (replyId && byHandle(replyId)) || byLabel(messageText)`. Mantém os casos atuais verdes (replyId nulo → label; interativo → handle). **Não** alterar o webhook para injetar `button.payload` em `replyId` — isso quebraria o fallback por label.

### 5. try/catch no envio de `send_template`
`server/services/whatsapp-bot-engine.service.ts` (case `send_template`, ~linha 703).

- **RED (e2e)**: mock de `sendTemplateMessage` rejeitando → afirmar que o erro é tratado (relançado com mensagem amigável, espelhando o `send_message` template) em vez de deixar a sessão pendurada silenciosamente.
- **GREEN**: envolver o envio em try/catch como em `send_message` (linhas ~310-368), com `console.error` + `throw new Error("Falha ao enviar template ...")`.

### 6. Logs defensivos em skips silenciosos (hardening, sem teste)
`server/services/whatsapp-bot-engine.service.ts`.

- `distribute_flow`: `console.warn` quando `outputs` vazio/ausente (cai em `edges[0]`).
- `send_template`/`handleIncomingMessage`: `console.warn` quando a resposta não casa nenhum botão e `invalidResponseHandle` está desligado (mensagem ignorada de propósito — a expiração de 30 min limpa).
- `edit_tags`: `console.warn` quando `clientId` é nulo (etiqueta não aplicável — sem cliente vinculado). O nó já avança via `getNextNode` fora do `if`.

### 7. Documentar `onlyIfCurrentHasPermission` como no-op
`server/services/whatsapp-bot-engine.service.ts` (case `transfer_agent`) + nota em `docs/plano-nos-bot-whatsapp.md`.

- Comentário explícito de que o campo não tem efeito (sem modelo de permissão no schema) e é limitação conhecida.

---

## Itens auditados e considerados OK (sem ação)

- **`distribute_flow` handles `out-{nanoid}`**: engine é agnóstico ao handle (usa o que estiver em `outputs[].handle` e roteia por `getNextNode(...,handle)`). Consistente editor↔engine.
- **`send_template` booleans vs string ids**: `invalidResponseHandle`/`noResponseHandle`/`notDeliveredHandle` são flags que decidem se o handle fixo (`"invalid_response"` etc.) é renderizado; o engine lê a mesma string fixa. Consistente — não é mismatch.
- **`trigger_flow` "race condition"**: `updateSession(...completed)` é `await`-ado antes de `startBotSession`; `getActiveSession` filtra `status="active"`. Sem corrida real em fluxo sequencial awaited (provado pelos e2e).
- **`not_delivered` via webhook**: `handleMessageStatus` chama `handleTemplateDeliveryFailure(status.id)` em `failed`; `status.id` casa com `pendingMessageId`. OK (falhas chegam em segundos, dentro da janela de 30 min).

---

## Verificação end-to-end

1. **Testes**: `TEST_DATABASE_URL=... pnpm vitest run server/services/__tests__/whatsapp-bot-engine.e2e.test.ts server/services/__tests__/whatsapp-bot-engine.unit.test.ts` — todos os ciclos novos verdes, sem quebrar os 57 existentes. Atenção especial ao novo teste de `expireInactiveSessions` + `processTemplateTimeouts` (correção 1) e ao matcher de botão (correção 4).
2. **Type check**: `npm run check` (regra do CLAUDE.md) — sem novos erros nos arquivos tocados (erros pré-existentes em `storage.ts`, `test-pubsub.ts`, etc. permanecem).
3. **Sanidade do job**: confirmar mentalmente/por log que `expireInactiveSessions` não toca mais sessões com `responseDeadlineAt` pendente e que `processTemplateTimeouts` (cron `*/1`) assume o `no_response`.
