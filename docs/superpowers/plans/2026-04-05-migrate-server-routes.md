# Server Routes Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** migrar todas as rotas ainda ativas em `server/routes.ts` para o padrao modular ja usado em `server/routes/`, preservando 100% da logica e cobrindo cada migracao com testes de rota.

**Architecture:** manter `server/routes.ts` apenas como ponto de bootstrap de infraestrutura e registro de routers. Cada grupo de rotas deve ir para um arquivo `*.routes.ts`, com controladores/servicos extraidos apenas quando necessario para reduzir tamanho e facilitar testes, sem alterar contratos HTTP, payloads, headers esperados ou ordem sensivel de rotas.

**Tech Stack:** Express 4, TypeScript, Zod, Drizzle ORM, Vitest, Supertest.

---

## Diagnostico

- O padrao atual esta centralizado em `server/routes/index.ts`, com routers por dominio como `clients.routes.ts`, `companies.routes.ts`, `deals.routes.ts`, `users.routes.ts` e `sales.routes.ts`.
- `server/routes.ts` ainda concentra dezenas de rotas ativas, principalmente em Umbler, auth, arquivos, acompanhamento, products, events, trainings, reports, dashboard, goals/stats e endpoints administrativos.
- Nao existe infraestrutura de testes hoje:
- `package.json` nao tem `vitest`, `supertest` nem script de teste.
- Nao ha `*.test.ts` ou `*.spec.ts`.
- `tsconfig.json` ja exclui `*.test.ts`, entao os testes nao impactam `npm run check`.
- Ha casos especiais que precisam ser preservados no desenho:
- rotas publicas fora de `/api` (`/public-objects/*`, `/objects/*`);
- ordem sensivel em Umbler, especialmente `/:contactId/cashback-field`;
- rotas com `multer`, S3 e `rawBody`;
- rotas que hoje misturam `db`, `storage`, integracoes externas e imports dinamicos.

## Estrutura Alvo

- `server/routes.ts`
- manter apenas `registerRoutes(app)`, instanciacao compartilhada (`multer`, `S3Client`, `ObjectStorageService`) e mounts finais.
- `server/routes/index.ts`
- registrar todos os routers sob `/api`.
- novos routers dedicados:
- `server/routes/auth.routes.ts`
- `server/routes/files.routes.ts`
- `server/routes/acompanhamento.routes.ts`
- `server/routes/umbler.routes.ts`
- `server/routes/reports.routes.ts`
- `server/routes/products.routes.ts`
- `server/routes/events.routes.ts`
- `server/routes/trainings.routes.ts`
- `server/routes/client-debts.routes.ts`
- `server/routes/dashboard.routes.ts`
- `server/routes/health.routes.ts`
- `server/routes/admin.routes.ts`
- `server/routes/message-automation-settings.routes.ts`
- `server/routes/birthday-automation.routes.ts`
- routers existentes a expandir:
- `server/routes/users.routes.ts`
- `server/routes/clients.routes.ts`
- `server/routes/companies.routes.ts`
- `server/routes/sales.routes.ts`
- `server/routes/telemarketing-goals.routes.ts`
- `server/routes/cashback.routes.ts` ou `server/routes/cashback-settings.routes.ts`
- routers publicos fora de `/api`:
- `server/routes/public-objects.routes.ts`
- `server/routes/object-storage.routes.ts`
- testes:
- `server/routes/__tests__/*.test.ts`
- `server/test/create-route-test-app.ts`
- `server/test/raw-body-json.ts`
- `server/test/mocks/*` se necessario

### Task 1: Criar a Base de Testes e o Harness de Rotas

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `server/test/create-route-test-app.ts`
- Create: `server/test/raw-body-json.ts`

- [x] Adicionar `vitest` e `supertest` como dependencias de desenvolvimento.
- [x] Adicionar script `test` e `test:run` em `package.json`.
- [x] Criar `create-route-test-app()` para montar routers isolados com `express.json()`, `express.urlencoded()` e suporte opcional a `rawBody`.
- [x] Criar helper para headers recorrentes (`x-user-id`, `x-user-role`) e mocks de middleware quando necessario.
- [x] Validar que o harness consegue testar um router isolado sem subir `server/index.ts`.

### Checkpoint 1

- Rodar `npx vitest`
- Rodar `npm run check`
- Criterio: harness pronto e sem side effects de scheduler/server real.

### Task 2: Migrar Quick Wins ja proximos do padrao modular

**Files:**
- Create: `server/routes/auth.routes.ts`
- Create: `server/routes/files.routes.ts`
- Create: `server/routes/acompanhamento.routes.ts`
- Modify: `server/routes/users.routes.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`
- Create: `server/routes/__tests__/auth.routes.test.ts`
- Create: `server/routes/__tests__/files.routes.test.ts`
- Create: `server/routes/__tests__/users.routes.test.ts`
- Create: `server/routes/__tests__/acompanhamento.routes.test.ts`

**Scope:**
- `POST /api/auth/login`
- `POST /api/files/upload`
- `DELETE /api/files/:fileId`
- `GET /api/acompanhamento`
- `GET /api/users/by-email/:email`
- `POST /api/users/channel`

- [ ] Extrair `login` para `auth.routes.ts` preservando validacao manual, payloads de erro e sucesso.
- [ ] Mover rotas de arquivo para `files.routes.ts` reutilizando `uploadMiddleware`, `createFileController` e `deleteFileController`.
- [ ] Expandir `users.routes.ts` para absorver `by-email` e `channel`.
- [ ] Extrair a query de acompanhamento para controller/service dedicado sem alterar filtros, paginacao ou calculo de stats.
- [ ] Registrar novos mounts em `server/routes/index.ts`.
- [ ] Remover os blocos equivalentes de `server/routes.ts`.

**Cobertura minima**
- `auth.routes.test.ts`
- login com sucesso
- 400 sem email/senha
- 401 para credenciais invalidas
- 500 em falha do storage/bcrypt
- `users.routes.test.ts`
- `GET /by-email/:email` 200 e 404
- `POST /channel` 400, 404 de usuario, 404 de canal e atualizacao/criacao com sucesso
- `acompanhamento.routes.test.ts`
- fluxo admin
- fluxo nao admin
- paginacao
- resposta com `stats` e `pagination`
- `files.routes.test.ts`
- upload chama controller
- delete chama controller

### Checkpoint 2

- Rodar `npx vitest run server/routes/__tests__/auth.routes.test.ts server/routes/__tests__/files.routes.test.ts server/routes/__tests__/users.routes.test.ts server/routes/__tests__/acompanhamento.routes.test.ts`
- Rodar `npm run check`

### Task 3: Migrar o dominio Umbler em um unico batch

**Files:**
- Create: `server/routes/umbler.routes.ts`
- Create: `server/routes/__tests__/umbler.routes.test.ts`
- Optionally create: `server/controllers/umbler/*`
- Optionally create: `server/services/umbler-route.service.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`

**Scope:**
- todos os endpoints entre `lines ~167-808` de `server/routes.ts`, incluindo:
- `/api/umbler/channels`
- `/api/umbler/whatsapp-api/channels`
- `/api/umbler/contacts/*`
- `/api/umbler/bot`
- `/api/umbler/manual-starts/bot`
- `/api/umbler/chats*`
- `/api/umbler/messages`
- `/api/umbler/birthday-bots*`
- `/api/start/birthday-bot`
- `/api/umbler/:contactId/cashback-field`
- `/api/umbler/bot-cashback`
- `/api/umbler/cashback*`
- `/api/umbler/campaigns*`
- `/api/client/umbler/tag` se permanecer ligado ao mesmo contexto

- [ ] Migrar primeiro os endpoints simples de passthrough.
- [ ] Depois mover os endpoints que combinam `db` + integracao (`/chats`, `/contacts/create`, `/users/channel` ja tera saido na task anterior).
- [ ] Preservar aliases de rota (`/channels` e `/whatsapp-api/channels`).
- [ ] Manter `/:contactId/cashback-field` por ultimo dentro do router para nao capturar rotas fixas.
- [ ] Substituir imports dinamicos de campanhas por controllers importados estaticamente no router novo, sem mudar comportamento.

**Cobertura minima**
- busca de canais nas duas URLs
- `contacts/conversations`
- `contacts/:phone` 200 e 404
- `contacts` list/update/delete/tags
- `bot`, `manual-starts/bot`, `bots`
- `chats` list/get/create
- `messages`
- `birthday-bots`, `birthday-bots-today`, `birthday-bots-days-before`
- `start/birthday-bot`
- `cashback-field`, `bot-cashback`, create/update cashback
- `campaigns` create/list/details/stats
- testes explicitos de payload de erro e ordem de matching

### Checkpoint 3

- Rodar `npx vitest run server/routes/__tests__/umbler.routes.test.ts`
- Rodar `npm run check`

### Task 4: Fechar os routers ja existentes mas ainda incompletos

**Files:**
- Modify: `server/routes/clients.routes.ts`
- Modify: `server/routes/companies.routes.ts`
- Modify: `server/routes/sales.routes.ts`
- Create: `server/routes/reports.routes.ts`
- Create: `server/routes/__tests__/clients.routes.test.ts`
- Create: `server/routes/__tests__/companies.routes.test.ts`
- Create: `server/routes/__tests__/sales.routes.test.ts`
- Create: `server/routes/__tests__/reports.routes.test.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`

**Scope:**
- `POST /api/clients/import`
- `GET|POST|DELETE /api/companies/:companyId/products*`
- `GET /api/companies/export-all`
- `POST /api/companies/import`
- `/api/reports/general`
- `/api/reports/clients`
- `/api/reports/companies`
- `/api/reports/sales`
- qualquer rota restante de sales/report hoje ativa em `server/routes.ts`

- [ ] Completar `clients.routes.ts` com importacao.
- [ ] Completar `companies.routes.ts` com produtos da empresa, export e import.
- [ ] Manter `sales.routes.ts` so para `/sales*`.
- [ ] Criar `reports.routes.ts` para `/reports/*`, inclusive a rota de vendas hoje inline.
- [ ] Atualizar `server/routes/index.ts` com `apiRouter.use("/reports", reportsRouter)`.

**Cobertura minima**
- `clients import`
- `companies products` list/add/remove
- `companies export-all`
- `companies import`
- `reports` general/clients/companies/sales
- asserts de compatibilidade de status e shape do JSON

### Checkpoint 4

- Rodar `npx vitest run server/routes/__tests__/clients.routes.test.ts server/routes/__tests__/companies.routes.test.ts server/routes/__tests__/sales.routes.test.ts server/routes/__tests__/reports.routes.test.ts`
- Rodar `npm run check`

### Task 5: Migrar Goals e Stats operacionais

**Files:**
- Modify: `server/routes/telemarketing-goals.routes.ts`
- Create: `server/routes/client-registration-goals.routes.ts`
- Create: `server/routes/marker-goals.routes.ts`
- Create: `server/routes/interaction-goals.routes.ts`
- Create: `server/routes/__tests__/telemarketing-goals.routes.test.ts`
- Create: `server/routes/__tests__/client-registration-goals.routes.test.ts`
- Create: `server/routes/__tests__/marker-goals.routes.test.ts`
- Create: `server/routes/__tests__/interaction-goals.routes.test.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`

**Scope:**
- `/api/telemarketing-stats/:month/:year`
- `/api/client-registration-goals*`
- `/api/client-registration-stats/:month/:year`
- `/api/marker-goals*`
- `/api/marker-stats/:month/:year`
- `/api/interaction-goals*`
- `/api/interaction-stats/:month/:year`

- [ ] Manter `telemarketing-goals.routes.ts` para o dominio ja existente.
- [ ] Criar routers separados para os outros dominios, seguindo o padrao ja usado em `user-goals.routes.ts`.
- [ ] Extrair validacoes de `month`, `year`, `id` e body para middleware Zod.
- [ ] Preservar filtros por header/query e payloads atuais.

### Checkpoint 5

- Rodar `npx vitest run server/routes/__tests__/telemarketing-goals.routes.test.ts server/routes/__tests__/client-registration-goals.routes.test.ts server/routes/__tests__/marker-goals.routes.test.ts server/routes/__tests__/interaction-goals.routes.test.ts`
- Rodar `npm run check`

### Task 6: Migrar Products, Client Debts e Dashboard

**Files:**
- Create: `server/routes/products.routes.ts`
- Create: `server/routes/client-debts.routes.ts`
- Create: `server/routes/dashboard.routes.ts`
- Create: `server/routes/__tests__/products.routes.test.ts`
- Create: `server/routes/__tests__/client-debts.routes.test.ts`
- Create: `server/routes/__tests__/dashboard.routes.test.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`

**Scope:**
- `/api/products*`
- `/api/products/:productId/companies`
- `/api/products/statistics`
- `/api/client-debts*`
- `/api/dashboard/stats/:userId`

- [ ] Centralizar todo o dominio de produtos em `products.routes.ts`.
- [ ] Garantir que as rotas de produtos relacionadas a empresa saiam de `companies.routes.ts` e fiquem so em um lugar.
- [ ] Extrair `client-debts` e `dashboard` para routers pequenos e independentes.
- [ ] Preservar o fallback atual de dashboard e as regras implicitas de header.

### Checkpoint 6

- Rodar `npx vitest run server/routes/__tests__/products.routes.test.ts server/routes/__tests__/client-debts.routes.test.ts server/routes/__tests__/dashboard.routes.test.ts`
- Rodar `npm run check`

### Task 7: Migrar Events, Trainings, Uploads e Object Storage

**Files:**
- Create: `server/routes/events.routes.ts`
- Create: `server/routes/trainings.routes.ts`
- Create: `server/routes/object-storage.routes.ts`
- Create: `server/routes/public-objects.routes.ts`
- Create: `server/routes/__tests__/events.routes.test.ts`
- Create: `server/routes/__tests__/trainings.routes.test.ts`
- Create: `server/routes/__tests__/object-storage.routes.test.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`

**Scope:**
- `/api/events*`
- `/api/training-images`
- `/api/trainings*`
- `/api/upload`
- `/api/delete-file`
- `/api/objects/upload`
- `/objects/:objectPath(*)`
- `/public-objects/:filePath(*)`

- [ ] Separar `events` e `trainings` em routers distintos.
- [ ] Encapsular upload/S3/object storage em router proprio sem alterar middleware e side effects.
- [ ] Manter rotas publicas fora de `/api` em mounts diretos a partir de `registerRoutes`.
- [ ] Preservar handling de `multer`, S3 e erros `ObjectNotFoundError`.

**Cobertura minima**
- CRUD/listagens principais de eventos
- upload de anexos/participantes
- trainings CRUD e anexos
- upload de objeto
- leitura publica
- download/remocao quando aplicavel
- 404 e 500 dos fluxos de object storage

### Checkpoint 7

- Rodar `npx vitest run server/routes/__tests__/events.routes.test.ts server/routes/__tests__/trainings.routes.test.ts server/routes/__tests__/object-storage.routes.test.ts`
- Rodar `npm run check`

### Task 8: Migrar Endpoints operacionais, automacao, health e admin

**Files:**
- Create: `server/routes/message-automation-settings.routes.ts`
- Create: `server/routes/birthday-automation.routes.ts`
- Create: `server/routes/health.routes.ts`
- Create: `server/routes/admin.routes.ts`
- Create: `server/routes/templates.routes.ts`
- Create: `server/routes/__tests__/message-automation-settings.routes.test.ts`
- Create: `server/routes/__tests__/birthday-automation.routes.test.ts`
- Create: `server/routes/__tests__/health.routes.test.ts`
- Create: `server/routes/__tests__/admin.routes.test.ts`
- Create: `server/routes/__tests__/templates.routes.test.ts`
- Modify: `server/routes/index.ts`
- Modify: `server/routes.ts`

**Scope:**
- `/api/message-automation-settings*`
- `/api/templates`
- `/api/birthday-automation/trigger*`
- `/api/health`
- `/api/admin/seed-deal-questions`

- [ ] Criar routers pequenos por prefixo atual.
- [ ] Manter imports dinamicos apenas se forem necessarios para evitar side effects.
- [ ] Garantir que `health` fique simples e isolado.
- [ ] Mover seed/admin para `admin.routes.ts`.

### Checkpoint 8

- Rodar `npx vitest run server/routes/__tests__/message-automation-settings.routes.test.ts server/routes/__tests__/birthday-automation.routes.test.ts server/routes/__tests__/health.routes.test.ts server/routes/__tests__/admin.routes.test.ts server/routes/__tests__/templates.routes.test.ts`
- Rodar `npm run check`

### Task 9: Limpeza final do legado e verificacao de paridade

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/routes/index.ts`
- Optionally modify: comentarios `TODO` em routers ja concluidos

- [ ] Remover de `server/routes.ts` todos os handlers movidos.
- [ ] Deixar `server/routes.ts` apenas com bootstrap e mounts necessarios.
- [ ] Revisar `server/routes/index.ts` para garantir que todos os novos routers foram registrados.
- [ ] Atualizar comentarios `TODO` dos routers existentes.
- [ ] Conferir que nao existem rotas duplicadas registradas em dois lugares.

### Checkpoint Final

- Rodar `npx vitest run`
- Rodar `npm run check`
- Criterio:
- nenhuma rota migrada permanece ativa em `server/routes.ts`
- todos os testes de rota passam
- tipagem do projeto permanece integra

## Regras de execucao

- Migrar por dominio, nunca misturando 2 dominios grandes no mesmo commit.
- Antes de remover um bloco legado, o teste do novo router ja deve existir.
- Preferir copiar a logica atual primeiro e so depois extrair helpers, para evitar regressao comportamental.
- Onde ja existe router do dominio, expandir o arquivo atual antes de criar um router novo.
- Para endpoints fora de `/api`, modularizar o arquivo, mas manter o mount fora de `apiRouter`.

## Sequencia recomendada de entrega

1. Infra de testes
2. Auth/files/users/acompanhamento
3. Umbler
4. Companies/clients import/reports
5. Goals/stats
6. Products/dashboard/client-debts
7. Events/trainings/object storage
8. Automation/admin/health
9. Cleanup final

## Riscos que o plano ja cobre

- quebra por ordem de rota em Umbler
- side effects ao importar `server/index.ts`
- regressao em rotas com `multer` e S3
- inconsistencias entre payloads antigos e novos
- duplicidade de registro durante a transicao
