# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Express + Vite)
npm run build        # Build frontend (Vite) + backend (esbuild)
npm start            # Run production build
npm run check        # TypeScript type check — run before finishing any task
npm run db:push      # Push Drizzle schema changes to DB (dev only)
npm run sync:umbler  # Manually trigger Umbler sync job
```

No test runner is configured. If implementing tests, use Vitest:
```bash
npx vitest run path/to/file.test.ts   # Single test
npx vitest                             # All tests
```

No ESLint/Prettier — match surrounding code style and run `npm run check` for validation.

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
