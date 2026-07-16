# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Express + Vite)
npm run build        # Build frontend (Vite) + backend (esbuild)
npm start            # Run production build
npm run check        # TypeScript type check — run before finishing any task
npm run sync:umbler  # Manually trigger Umbler sync job
```

> **IMPORTANTE — Mudanças no banco de dados:**
> Nunca usar `npm run db:push` (o prompt interativo pode bloquear ou sobrescrever dados).
> Toda alteração de schema deve ser aplicada **manualmente** com SQL direto.
> Use o script helper `scripts/create-reactions-table.mjs` como referência de padrão:
> ```bash
> node scripts/<nome-do-script>.mjs
> ```
> O script usa o driver `@neondatabase/serverless` já instalado no projeto e lê `DATABASE_URL` do `.env`.

> **`npm run check` pode estourar a memória.** Os tipos do Drizzle sobre um
> `shared/schema.ts` de 5.000+ linhas são caros: em máquina de ~7GB o `tsc`
> morre com OOM (exit 134/137) mesmo com `--max-old-space-size`, e aumentar a
> heap não resolve. Não é erro do seu código. O contorno é checar só o que você
> mexeu, com um tsconfig temporário **na raiz do repo** (fora dela o `tsc` não
> acha os `@types`):
> ```jsonc
> // tsconfig.tmp.json — apagar depois
> {
>   "extends": "./tsconfig.json",
>   "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
>   "include": ["server/types/express.d.ts", "<seus arquivos>"],
>   "exclude": ["node_modules"]
> }
> ```
> ```bash
> npx tsc -p tsconfig.tmp.json
> ```
> Inclua sempre `server/types/express.d.ts`, senão todo `req.user` vira erro
> falso. Rodar o mesmo tsconfig com **só** os arquivos que você NÃO tocou
> separa erro seu de erro pré-existente — `server/db.ts` e `shared/schema.ts`
> hoje já acusam erro nesse modo isolado.

No ESLint/Prettier — match surrounding code style and run `npm run check` for validation.

## Tests

Vitest is configured with two projects (`vitest.config.ts`), plus Playwright for browser E2E.

```bash
npm run test:unit                          # Unit + route tests. No DB. Run these.
npm run test:run                           # Both Vitest projects
npm run test:bot-e2e                       # Bot engine vs. a real Postgres
npm run test:setup-db                      # Provision that test DB
npm run test:e2e                           # Playwright (e2e/)
npx vitest run --project unit path/to/file.test.ts   # Single file
```

> **IMPORTANTE — o nome e a pasta decidem se o teste roda.**
> Os projects usam globs fechados. Um `.test.ts` fora deles não falha: ele
> simplesmente nunca é coletado, e a suíte segue verde. Confirme com
> `npx vitest list --project unit` que o arquivo novo aparece.
>
> Estes 5 já estão órfãos hoje — existem, mas nenhum project os roda:
> `server/integrations/bling.test.ts`, `server/test/client-analytics-filters.test.ts`,
> `server/test/seller-dashboard-goals.test.ts`, `server/test/user-goals-storage.test.ts`,
> `shared/schema.user-goals.test.ts`.

Onde cada teste vai:

| Tipo | Caminho | Projeto |
|---|---|---|
| Serviço, sem banco | `server/services/__tests__/*.unit.test.ts` | `unit` |
| Rota HTTP | `server/routes/__tests__/*.routes.test.ts` | `unit` |
| Lib do client | `client/src/lib/__tests__/*.test.ts` | `unit` |
| Engine do bot, com banco | `server/services/__tests__/*.e2e.test.ts` | `bot-e2e` |

**Testes de rota:** monte o app com `createRouteTestApp()` de `server/test/create-route-test-app.ts`; `createMockAuthMiddleware()` injeta `req.user` e dispensa JWT.

**`bot-e2e`** roda contra `TEST_DATABASE_URL` (nunca contra `DATABASE_URL` — o setup redireciona antes de qualquer import). Sem essa env, os testes se auto-pulam via `describeBotE2E` de `server/test/bot-fixtures.ts`, então a suíte passa sem cobrir nada.

**Lógica pura testa melhor que serviço inteiro:** serviços importam `server/db` no topo, o que arrasta a conexão para dentro do teste. Quando a regra de negócio vale um teste, extraia-a numa função pura exportada e teste-a direto — ver `buildSellerQueues` em `copiloto.service.ts`.

> **IMPORTANTE — Teste visual:**
> Pule a verificação visual em navegador (preview/browser) para mudanças de UI. Não inicie servidor de preview nem peça para o usuário testar manualmente — valide apenas via leitura de código e `npm run check`.

## Architecture

Full-stack CRM: React 18 + Vite frontend, Express backend, PostgreSQL via Drizzle ORM (Neon serverless).

**Key directories:**
- `client/src/` — React frontend
- `server/` — Express backend
- `shared/schema.ts` — All Drizzle table definitions and auto-generated Zod schemas (source of truth for data models)

**Backend layering:** Routes → Controllers (thin HTTP handlers) → Services (business logic) → Drizzle queries.

New features follow this pattern:
1. Schema changes in `shared/schema.ts` → `npm run db:push`
2. Service in `server/services/`, controllers in `server/controllers/<feature>/`, route file in `server/routes/<feature>.routes.ts`, registered in `server/routes/index.ts`
3. Frontend: TanStack Query for API calls, React Hook Form + Zod for forms

**Legacy note:** `server/routes.ts` is a large monolithic file being migrated to `server/routes/`. New code goes in the modular `server/routes/` directory.

## Key Patterns

**Authentication:** Header-based (`x-user-id`). Protected routes use `requireAuth` middleware from `server/middleware/validation.ts`. Frontend stores user in localStorage, exposes via `useAuth()` hook.

**Validation:** `validateBody(zodSchema)` middleware on POST/PATCH routes. Zod schemas derived from Drizzle tables via `createInsertSchema` from `drizzle-zod`.

**Path aliases:**
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

**Styling:** Tailwind + Shadcn UI. Use `cn()` from `@/lib/utils` for conditional classes. Do **not** modify files in `client/src/components/ui/` — these are managed Shadcn components.

**Localization:** Timezone is always `America/Sao_Paulo`. Use `formatCurrency()` from `@/lib/utils` for BRL. Prefer `date-fns` over `dayjs` for new code.

**Background jobs:** `node-cron` schedulers in `server/jobs/`. Pub/Sub via Google Cloud for async events.

**External integrations:** Umbler (WhatsApp/messaging), Bling (e-commerce orders), OpenAI (AI assistant), AWS S3 + Google Cloud Storage (file uploads via Uppy).

## TypeScript Rules

- `strict: true` — never use `any`
- ESM only (`"type": "module"`)
- Always `async/await`, never `.then()` chains
- Always run `npm run check` before finishing code tasks
