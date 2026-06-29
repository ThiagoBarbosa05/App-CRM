# Plano: Implementar nós faltantes do bot de WhatsApp (TDD)

## Context

O editor de fluxo dos bots (`client/src/components/whatsapp-bot/nodes.tsx`, `client/src/pages/whatsapp/bot-editor.tsx`) permite criar **14 tipos de nó**, e todos são aceitos pelo schema (`shared/schema.ts:3372`) e pela rota de salvamento (`server/routes/whatsapp-bots.routes.ts:56`). Porém a engine de execução (`server/services/whatsapp-bot-engine.service.ts`, função `executeNode`, linhas 291–636) só implementa **8** deles. O `switch (node.type)` **não tem `default`**, então ao chegar num tipo não tratado o fluxo simplesmente **morre em silêncio** — o usuário monta o fluxo no editor, mas o bot trava nesse ponto em produção.

**6 tipos de nó sem execução no backend** (renderizam no editor, salvam no banco, mas não rodam):
`edit_tags`, `end_conversation` (como nó próprio), `distribute_flow`, `send_template`, `transfer_agent`, `trigger_flow`.

Objetivo: implementar a execução desses 6 nós e suas configurações, garantindo funcionalidade total, **via TDD** (teste e2e/unit primeiro, vê falhar, implementa o mínimo, vê passar).

### Decisões de escopo (confirmadas com o usuário)
- **Implementar os 6 nós.**
- **`send_template`: completo** — envio + ramificação por botão clicado + `invalid_response` + `no_response` (timer/job) + `not_delivered` (webhook de status de entrega).
- **`transfer_agent`: degradado sem presença** — não existe conceito online/disponível no schema; `any_available`/`random` sorteiam entre usuários atendentes.
- **`trigger_flow`: sequencial** — o modelo é 1 sessão ativa por telefone (`getActiveSession`); `executeParallel` será tratado como sequencial e documentado como limitação conhecida (encerra a sessão atual e inicia o bot-alvo).

## Padrão de teste existente (reusar)

- **e2e com banco real**: `server/services/__tests__/whatsapp-bot-engine.e2e.test.ts`. Mocka fronteiras externas (WhatsApp, Evolution, R2, SSE, IA) e usa banco real via `TEST_DATABASE_URL`. Pulado se a env não existir (`describeBotE2E`).
- **Fixtures**: `server/test/bot-fixtures.ts` — `createBot`, `createUser`, `createClient`, `createTag`, `attachTag`, `addNode`, `addEdge`, `openCustomerWindow`, `getSession`, `getOutboundMessages`, `resetBotTables`.
- **Unit puro**: `server/services/__tests__/whatsapp-bot-engine.unit.test.ts` (ex.: `resolveMenuHandle`, `interpolate`, `validateAnswer`).
- **Toolchain** (memória `project_test_toolchain`): usar **pnpm**, nunca npm. O commit recente `d7ca060` rebaixou vitest para 3.2.6 — confirmar que a suíte sobe rodando os testes existentes antes de começar. Rodar: `pnpm vitest run server/services/__tests__/whatsapp-bot-engine.e2e.test.ts` com `TEST_DATABASE_URL` setado.
- **Migração de schema** (CLAUDE.md + memória `feedback_db_migrations`): **nunca `db:push`**. Alterações de coluna via script `.mjs` com SQL direto (modelo: `scripts/create-reactions-table.mjs`).

## Helpers reutilizáveis já existentes na engine

`getNextNode(botId, nodeId, handle?)`, `getNode(nodeId)`, `getActiveSession(phone)`, `updateSession(sessionId, {...})`, `findOrCreateConversation(phone)`, `addContactTags(clientId, ids)`, `removeContactTags(clientId, ids)`, `interpolate(text, vars)`, `persistBotMessage(...)`, e o bloco de envio de template do `send_message` (linhas 309–363, a extrair).

---

## Alteração de schema (1 migração manual)

`send_template` precisa rastrear, por sessão, a mensagem de template pendente (para `not_delivered`) e o prazo de resposta (para `no_response`). Adicionar a `whatsapp_bot_sessions`:

- `pending_message_id varchar` — `waMessageId` do template aguardando entrega/resposta.
- `response_deadline_at timestamp` — quando o handle `no_response` deve disparar.

Refletir no `pgTable whatsappBotSessions` (`shared/schema.ts:3394`) e aplicar via novo script `scripts/add-bot-session-template-cols.mjs` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`). Estender o tipo aceito por `updateSession` (linha 194) com esses campos.

---

## Implementação por nó (cada um em ciclo Red→Green→Refactor)

Cada `case` novo entra no `switch` de `executeNode` (`whatsapp-bot-engine.service.ts:300`). Ordem sugerida: do mais simples ao mais complexo.

### 1. `edit_tags` — baixa
Dados: `EditTagsNodeData { mode: "add"|"remove", tagIds: string[] }`.
- **RED** (e2e): fluxo `start → edit_tags(add, [tagA]) → end`; após rodar, o cliente tem `tagA` em `contact_tags`; sessão `completed`. Segundo teste para `mode: "remove"`.
- **GREEN**: `case "edit_tags"`: resolve conversa→clientId; `mode === "add"` → `addContactTags`, senão `removeContactTags`; segue `getNextNode`.

### 2. `end_conversation` (nó próprio) — baixa
Dados: `EndConversationNodeData { closedBy?: "owner"|"agent"|<agentId> }`.
- **RED** (e2e): `start → send_message → end_conversation`; sessão `completed` **e** `whatsapp_conversations.status === "closed"`; registra nota de sistema (reusar inserção em `whatsapp_messages` type `"system"`). Nó terminal (sem aresta de saída).
- **GREEN**: `case "end_conversation"`: marca sessão `completed`; atualiza conversa `status: "closed"`; se `closedBy` for agentId, registra na nota quem encerrou. (Diferente do `actionType: end_conversation` do nó `action`, que só encerra a sessão sem fechar a conversa.)

### 3. `distribute_flow` (A/B) — baixa
Dados: `DistributeFlowNodeData { outputs: [{ handle, percentage, locked? }] }`.
- **RED** (unit): extrair função pura `pickDistributeHandle(outputs, rng: () => number): string`. Testes: `rng=0` → primeiro bucket; `rng→0.99` → último; normaliza quando soma ≠ 100; lista vazia → `null`.
- **RED** (e2e): dois outputs 50/50, **stub `Math.random`** (vi.spyOn) → roteia para o handle esperado e segue `getNextNode(botId, nodeId, handle)`; conclui.
- **GREEN**: `case "distribute_flow"`: chama `pickDistributeHandle(d.outputs, Math.random)`; `getNextNode` com o handle; segue. Continua imediatamente (sem pausa).

### 4. `send_template` (completo) — média/alta
Dados: `SendTemplateNodeData { metaTemplateName, metaTemplateLanguage, templateHeaderMedia?, templateParams?, buttonHandles[], invalidResponseHandle?, noResponseHandle?, notDeliveredHandle? }`.

**4a. Refactor (verde-para-verde)**: extrair o envio de template do `send_message` (linhas 309–363) para `sendTemplateForNode(phone, { metaTemplateName, language, params, headerMedia }, vars): Promise<waMessageId | null>`. Manter os testes de template do `send_message` passando.

**4b. Envio + pausa** — RED (e2e): `start → send_template → ...`; chama `sendTemplateMessage`; sessão pausa em `currentNodeId === node.id`, grava `pending_message_id` e (se `noResponseHandle`) `response_deadline_at`. GREEN: `case "send_template"` envia via `sendTemplateForNode`, `updateSession` com pendências.

**4c. Ramificação por botão** — RED: unit `resolveTemplateButtonHandle(node, replyId, text): string|null` (casa `replyId` com `buttonHandles[].handle`); e2e: clique no botão → `handleIncomingMessage(phone, label, replyId)` roteia para o branch do botão e conclui. GREEN: adicionar ramo `currentNode.type === "send_template"` em `handleIncomingMessage` (linha 825+), análogo ao `menu`.

**4d. `invalid_response`** — RED (e2e): resposta sem match + `invalidResponseHandle` ativo → roteia para handle `invalid_response`. GREEN: no ramo do 4c, fallback para o handle de inválido (se habilitado); senão reenvia/ignora.

**4e. `no_response` (timer)** — RED (e2e): seta `response_deadline_at` no passado; chama nova função `processTemplateTimeouts()` → roteia para handle `no_response` e limpa pendências. GREEN: implementar `processTemplateTimeouts()` (varre sessões ativas em nó `send_template` com `response_deadline_at <= now`); registrar job `start...Job` em `server/index.ts` ao lado de `startResumeBotSessionsJob`.

**4f. `not_delivered` (webhook)** — RED (e2e): chama nova função `handleTemplateDeliveryFailure(waMessageId)` para uma sessão pausada cujo `pending_message_id` casa → roteia para handle `not_delivered`. GREEN: implementar a função na engine; **wire** no webhook `handleMessageStatus` (`server/routes/whatsapp-webhook.routes.ts:146`) chamando-a quando `status === "failed"`.

Convenção de handles: os handles dos botões vêm de `buttonHandles[].handle`; os de sistema usam ids fixos `"invalid_response"`, `"no_response"`, `"not_delivered"` (alinhar com o `sourceHandle` que o editor grava nas arestas — conferir em `bot-editor.tsx` ~linhas 2264–2399).

### 5. `transfer_agent` (degradado) — alta
Dados: `TransferAgentNodeData { rule, agentId?, onlyIfCurrentHasPermission?, activateFlowIfFailed? }`. Papéis de usuário: `admin|gerente|vendedor` (`schema.ts:38`); atendentes = `vendedor` (e `gerente`) — confirmar na implementação.
- **RED** (unit): `resolveTransferAgent(rule, data, ctx): Promise<agentId|null>`:
  - `specific` → `data.agentId`;
  - `previous_conversation` → último `assignedAgentId` de conversa anterior do cliente;
  - `previous_same_conversation` → `assignedAgentId` atual da conversa;
  - `any_available`/`random` → sorteio entre usuários atendentes (stub rng).
- **RED** (e2e): `specific` → `conversation.assignedAgentId` setado, nota de sistema criada, sessão `completed` (entregue ao humano). Segundo e2e: agente não resolvido + `activateFlowIfFailed: true` → segue para o handle de falha / próximo nó em vez de encerrar.
- **GREEN**: `case "transfer_agent"`: resolve agente; valida `onlyIfCurrentHasPermission` (se sem permissão → falha); sucesso → atribui + nota + encerra sessão; falha → se `activateFlowIfFailed` segue fluxo, senão encerra.

### 6. `trigger_flow` (sequencial) — alta
Dados: `TriggerFlowNodeData { targetBotId?, targetNodeId?, executeOnCurrentChannel?, scheduleExecution?, executeParallel? }`.
- **Refactor**: generalizar `startBotSession(botId, phone)` (linha 732) para aceitar `startNodeId?` opcional (inicia no nó indicado em vez do `start`). Manter testes atuais passando.
- **RED** (e2e): `start → trigger_flow(targetBotId=B)`; após rodar, sessão do bot atual `completed` e **nova sessão** do bot B criada e executada (envia a 1ª mensagem de B). Segundo e2e: `targetNodeId` definido → nova sessão começa naquele nó.
- **GREEN**: `case "trigger_flow"`: encerra a sessão atual (`completed`); se `targetBotId`, chama `startBotSession(targetBotId, phone, targetNodeId)`. `executeParallel`/`scheduleExecution` documentados como tratados sequencial/imediato (limitação conhecida); `targetBotId` ausente → encerra sem erro.

---

## Wiring / integração (resumo)

| Ponto | Arquivo | Mudança |
|---|---|---|
| Novos `case` no dispatcher | `whatsapp-bot-engine.service.ts:300` | 6 ramos novos |
| Respostas a `send_template` | `whatsapp-bot-engine.service.ts:825` (`handleIncomingMessage`) | ramo `send_template` (botão/inválido) |
| Falha de entrega de template | `whatsapp-webhook.routes.ts:146` (`handleMessageStatus`) | chamar `handleTemplateDeliveryFailure` em `failed` |
| Timer `no_response` | novo job + `server/index.ts:12-13` | registrar ao lado dos jobs de bot |
| Colunas de sessão | `shared/schema.ts:3394` + `scripts/add-bot-session-template-cols.mjs` | 2 colunas novas (SQL manual) |

## Verificação end-to-end

1. **Testes**: `TEST_DATABASE_URL=... pnpm vitest run server/services/__tests__/whatsapp-bot-engine.e2e.test.ts server/services/__tests__/whatsapp-bot-engine.unit.test.ts` — todos os ciclos TDD novos verdes, sem quebrar os existentes. Confirmar primeiro que a suíte sobe (toolchain).
2. **Type check**: `npm run check` (regra do CLAUDE.md — rodar antes de concluir).
3. **Migração**: rodar `node scripts/add-bot-session-template-cols.mjs` no banco de dev e conferir as colunas.
4. **Manual (opcional)**: no editor, montar um fluxo curto com cada nó novo, disparar o bot numa conversa e validar etiquetas aplicadas, distribuição A/B, template com botões e transferência.

## Riscos / pontos a confirmar na implementação
- Nomes exatos dos `sourceHandle` que o editor grava para `send_template` (`invalid_response`/`no_response`/`not_delivered`) e `distribute_flow` — alinhar engine ↔ editor lendo `bot-editor.tsx`.
- Valor de `whatsapp_conversations.status` para "fechado" (coluna é texto livre, default `open`) — usar `"closed"` e checar se a UI já reconhece.
- Definição de "atendente" para `transfer_agent` (papéis `vendedor`/`gerente`).
- `executeParallel` de `trigger_flow` é limitação conhecida (modelo de sessão única) — validar com o usuário se sequencial é aceitável na prática.
