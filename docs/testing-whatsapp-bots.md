# Testes dos bots do WhatsApp

Setup de testes para o engine de chatbots do WhatsApp, em três camadas:

| Camada | O que cobre | Onde | Precisa de banco? |
| --- | --- | --- | --- |
| **Unitário** | Lógica pura de decisão (`interpolate`, `validateAnswer`, `isValidCpf`, `resolveMenuHandle`) | `server/services/__tests__/whatsapp-bot-engine.unit.test.ts` | Não |
| **E2E do engine** | Fluxos completos de conversa pelo runtime do bot (start → pergunta → condição → menu → ação → fim) | `server/services/__tests__/whatsapp-bot-engine.e2e.test.ts` | Sim (Postgres de teste) |
| **E2E de UI** | Editor de bots no navegador (canvas React Flow) | `e2e/bot-editor.spec.ts` (Playwright) | Sim (app rodando) |

A estratégia segue a pirâmide de testes: muita lógica pura barata embaixo, fluxos
de integração no meio mockando só as **fronteiras externas** (API do WhatsApp/Meta,
Evolution/Baileys, R2, SSE, IA), e poucos testes de UI no topo.

---

## Pré-requisito: toolchain do Vitest

> ⚠️ **Atenção:** o repositório está com `vitest@4` e `vite@5` no lockfile — uma
> combinação **incompatível** (Vitest 4 exige Vite ≥ 6). Hoje **qualquer** teste
> do projeto falha na inicialização com:
> `ERR_PACKAGE_PATH_NOT_EXPORTED: ... './module-runner' is not defined ... vite`.
>
> Isso é anterior a este setup (reproduz com os testes de rota já existentes).
> Antes de rodar os testes, reconcilie as versões — escolha **uma**:
>
> - **Conservador (mantém o app em Vite 5):** fixar o Vitest na linha 3.2
>   `pnpm add -D vitest@^3.2.4` (a config `test.projects` usada aqui é suportada).
> - **Atualizar o Vite:** subir para Vite 6/7 (`pnpm add -D vite@^6`). Os plugins
>   do projeto (`@vitejs/plugin-react`, `@tailwindcss/vite`) já suportam Vite 6/7,
>   mas é um major no build do app — teste o `npm run build` depois.

> Use sempre **pnpm** neste projeto (há `pnpm-lock.yaml`). `npm install` corrompe o
> `node_modules` gerenciado por pnpm.

---

## Como rodar

### Unitários (sem banco)

```bash
pnpm test:unit                 # só o projeto "unit" (lógica pura + rotas)
pnpm test:unit -- --watch      # modo watch
```

### E2E do engine (banco de teste real)

Os testes rodam o engine de verdade contra um Postgres **descartável** e mockam
apenas a API do WhatsApp. Auto-pulam quando `TEST_DATABASE_URL` não está definido.

1. Crie um banco de teste isolado (ex.: um **branch do Neon**) e exporte a URL:

   ```bash
   export TEST_DATABASE_URL="postgresql://...branch-de-teste..."
   ```

2. Materialize o schema nesse banco (uma vez, ou quando o schema mudar):

   ```bash
   pnpm test:setup-db
   ```

   O script aplica `shared/schema.ts` via `drizzle-kit push --force`. Como o banco
   de teste começa vazio, é **não-interativo** — diferente do banco de dev/prod,
   onde `db:push` é proibido (ver `CLAUDE.md`). Ele recusa rodar se
   `TEST_DATABASE_URL` for igual a `DATABASE_URL`.

3. Rode:

   ```bash
   pnpm test:bot-e2e
   ```

   Cada teste dá `TRUNCATE` nas tabelas (com guarda dupla: só executa com
   `TEST_DATABASE_URL` setado, para nunca tocar um banco real).

### E2E de UI (Playwright)

```bash
pnpm exec playwright install chromium   # baixa o navegador (uma vez)

export E2E_EMAIL="usuario@teste.local"   # credenciais válidas no banco do app
export E2E_PASSWORD="senha"
# opcional: export E2E_BASE_URL="http://localhost:5000"

pnpm test:e2e        # headless
pnpm test:e2e:ui     # modo interativo
```

O `playwright.config.ts` sobe o app com `npm run dev` automaticamente
(`webServer`). O `e2e/auth.setup.ts` faz login via `POST /api/auth/login`, salva o
estado autenticado (cookie JWT) em `playwright/.auth/user.json` e os specs o
reutilizam. Sem `E2E_EMAIL`/`E2E_PASSWORD`, o setup pula e os testes de UI não
rodam.

---

## Como estender

- **Novo nó / comportamento puro:** adicione um caso em `*.unit.test.ts`. Se a
  lógica estiver embutida numa função privada do engine, exporte-a (como já foi
  feito com `interpolate`, `validateAnswer`, `isValidCpf`, `resolveMenuHandle`).
- **Novo fluxo de conversa:** use os builders de `server/test/bot-fixtures.ts`
  (`createUser`, `createBot`, `addNode`, `addEdge`, `openCustomerWindow`, ...) para
  montar o grafo do bot e dirija a conversa com `startBotSession` /
  `handleIncomingMessage`. Lembre de `openCustomerWindow(phone)` antes de fluxos
  que enviam texto livre/menu (a janela de 24h da Meta precisa estar aberta).
- **Nova fronteira externa:** adicione um `vi.mock(...)` no topo do
  `*.e2e.test.ts` (os mocks são içados antes dos imports).
- **Nova tela:** crie um `*.spec.ts` em `e2e/` reaproveitando o estado autenticado.

## Arquivos do setup

```
vitest.config.ts                         # projetos "unit" e "bot-e2e"
server/test/bot-e2e.setup.ts             # aponta DATABASE_URL → TEST_DATABASE_URL
server/test/bot-fixtures.ts              # helpers/builders + reset do banco
server/services/__tests__/*.unit.test.ts # testes unitários
server/services/__tests__/*.e2e.test.ts  # testes e2e do engine
scripts/setup-bot-test-db.mjs            # aplica o schema no banco de teste
playwright.config.ts                     # config do Playwright
e2e/auth.setup.ts                        # login compartilhado
e2e/bot-editor.spec.ts                   # smoke do editor
```
