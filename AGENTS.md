# AGENTS.md - Developer Guide & Rules

This document defines the coding standards, workflows, and tools for this repository. All AI agents and developers must adhere to these guidelines to ensure consistency and stability.

## 1. Project Overview & Architecture

This is a full-stack CRM application with a monorepo-like structure:
- **Frontend:** React 18 + Vite located in `client/src/`
- **Backend:** Express.js (Node.js) located in `server/`
- **Shared:** Common types and schemas in `shared/schema.ts`
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS v3 + Shadcn UI (Radix UI primitives)
- **State Management:** TanStack Query (React Query) for server state
- **Routing:** Wouter (lightweight React router)
- **Forms:** React Hook Form with Zod validation

## 2. Commands & Scripts

### Development
```bash
npm run dev              # Start dev server (tsx + Vite)
npm run check            # Type check entire project (MANDATORY before commits)
npm run build            # Build frontend (Vite) + backend (esbuild)
npm start                # Run production build
npm run db:push          # Push Drizzle schema changes to DB
npm run sync:umbler      # Run Umbler sync job manually
```

### Testing
No test runner is currently configured. If implementing tests:
- **Preferred:** Vitest (Vite-compatible)
- **Run single test:** `npx vitest run path/to/file.test.ts`
- **Run all tests:** `npx vitest`

### Type Checking
**CRITICAL:** Always run `npm run check` before finishing any task involving code changes. This validates types across the entire monorepo.

## 3. Code Style & Conventions

### TypeScript Standards
- **Strict Mode:** `strict: true` is enabled. Never use `any`.
- **Type Annotations:** Explicitly define types for function parameters and return values.
- **Async/Await:** Always prefer `async/await` over `.then()` chains.
- **Imports:** Use path aliases:
  - `@/*` → `client/src/*`
  - `@shared/*` → `shared/*`
  - `@assets/*` → `attached_assets/*`
- **Module System:** ESM only (`"type": "module"` in package.json).

### Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Variables/Functions | `camelCase` | `getUserById`, `isValid` |
| React Components | `PascalCase` | `UserProfile`, `DataTable` |
| Component Files | `kebab-case.tsx` or `PascalCase.tsx` | `user-profile.tsx`, `Button.tsx` |
| Database Tables | `snake_case` | `user_profiles`, `sales_funnels` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `API_BASE_URL` |
| Route Files | `kebab-case.routes.ts` | `clients.routes.ts` |
| Service Files | `kebab-case.service.ts` | `clients.service.ts` |
| Controller Files | `kebab-case.controller.ts` | `get-clients.controller.ts` |

### Frontend Architecture (React)

#### Component Organization
```
client/src/
├── components/        # Reusable components
│   ├── ui/           # Shadcn UI primitives (DO NOT modify)
│   └── custom/       # Custom components
├── pages/            # Route pages (kebab-case.tsx)
├── hooks/            # Custom React hooks (use-*.ts)
├── lib/              # Utilities (utils.ts contains cn() helper)
├── contexts/         # React contexts
├── layouts/          # Layout components
└── styles/           # Global styles
```

#### React Best Practices
- **Styling:** Use Tailwind utility classes. For conditional classes, use `cn()` from `@/lib/utils`:
  ```tsx
  import { cn } from "@/lib/utils";
  <div className={cn("base-class", isActive && "active-class")} />
  ```
- **Forms:** Use React Hook Form + Zod:
  ```tsx
  import { useForm } from "react-hook-form";
  import { zodResolver } from "@hookform/resolvers/zod";
  const form = useForm({ resolver: zodResolver(schema) });
  ```
- **API Calls:** Use TanStack Query hooks:
  ```tsx
  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });
  const mutation = useMutation({ mutationFn: createClient });
  ```
- **Toast Notifications:** Use `useToast()` hook from `@/hooks/use-toast`.
- **Responsive Design:** Mobile-first approach. Use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`.

### Backend Architecture (Express)

#### Structure
```
server/
├── index.ts              # App entry point
├── routes.ts             # Main route registration (legacy)
├── routes/               # Modular route files
│   ├── index.ts          # Route aggregation
│   └── *.routes.ts       # Feature-specific routes
├── controllers/          # Route handlers (organized by feature)
├── services/             # Business logic layer
├── repositories/         # Data access layer (optional)
├── middleware/           # Express middleware
│   └── validation.ts     # Zod validation middleware
├── jobs/                 # Background jobs & schedulers
├── integrations/         # External API integrations
├── db/                   # Database utilities
└── types/                # TypeScript type definitions
```

#### Backend Best Practices
- **Routes:** Use Express Router. Organize by feature in `server/routes/`:
  ```typescript
  import { Router } from "express";
  export const clientsRouter = Router();
  clientsRouter.get('/', getClientsController);
  clientsRouter.post('/', postClientController);
  ```
- **Controllers:** Handle HTTP request/response. Keep thin, delegate to services:
  ```typescript
  export const getClientsController = async (req: Request, res: Response) => {
    try {
      const clients = await clientsService.getClients(req.query);
      res.json(clients);
    } catch (error) {
      console.error("Error in getClientsController:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  ```
- **Services:** Contain business logic. Use service layer pattern:
  ```typescript
  export const clientsService = {
    async getClients(filters) { /* ... */ },
    async createClient(data) { /* ... */ }
  };
  ```
- **Validation:** Use Zod schemas with middleware:
  ```typescript
  import { validateBody } from "../middleware/validation";
  router.post('/clients', validateBody(insertClientSchema), postClientController);
  ```
- **Error Handling:**
  - Always wrap async handlers in try-catch.
  - Use appropriate HTTP status codes (400 validation, 404 not found, 500 server error).
  - Return JSON errors: `{ message: "Error description" }`.
  - Log errors with context: `console.error("Context:", error)`.
  - Never expose stack traces to client in production.
- **Comments:** Use JSDoc for route documentation (see existing patterns in `server/routes/` and `server/controllers/`).

### Database (Drizzle ORM)

#### Schema Management
- **Schema Definition:** All tables in `shared/schema.ts`.
- **Zod Schemas:** Generate with `createInsertSchema` from `drizzle-zod`:
  ```typescript
  export const insertClientSchema = createInsertSchema(clients);
  ```
- **Migrations:** Use `npm run db:push` for development. For production, create explicit migrations.
- **Queries:** Use Drizzle query builder:
  ```typescript
  import { db } from "./db";
  import { clients } from "@shared/schema";
  import { eq, and } from "drizzle-orm";
  
  const result = await db.select().from(clients).where(eq(clients.id, id));
  ```

## 4. Development Workflow

### Adding a New Feature
1. **Schema First:** If data models change, update `shared/schema.ts` and run `npm run db:push`.
2. **Backend:**
   - Create service in `server/services/feature.service.ts`
   - Create controllers in `server/controllers/feature/`
   - Create route file in `server/routes/feature.routes.ts`
   - Register route in `server/routes/index.ts`
3. **Frontend:**
   - Create Zod schema for form validation
   - Build UI in `client/src/pages/` or `client/src/components/`
   - Use TanStack Query for API integration
   - Add navigation in relevant layout/menu component
4. **Verify:** Run `npm run check` to validate types.

### Modifying Existing Code
- **Read First:** Always read the file before editing to understand context and patterns.
- **Match Style:** Follow existing patterns in the file/module.
- **Preserve Functionality:** Ensure no regressions. Test critical paths.
- **Update Related Files:** If changing API contracts, update both frontend and backend.

## 5. Important Patterns & Libraries

### Key Dependencies
- **UI Components:** Radix UI primitives via Shadcn (in `client/src/components/ui/`)
- **Icons:** `lucide-react`
- **Date Handling:** `date-fns` and `dayjs` (prefer `date-fns` for new code)
- **File Uploads:** Uppy (`@uppy/core`, `@uppy/react`, `@uppy/aws-s3`)
- **Validation:** `zod` + `zod-validation-error`
- **Auth:** Passport.js with local strategy + express-session
- **Background Jobs:** `node-cron` (see `server/jobs/`)

### Brazilian Localization
- **Timezone:** Always use `America/Sao_Paulo` for date formatting.
- **Currency:** Use `formatCurrency()` from `@/lib/utils` for BRL formatting.
- **Phone/CPF:** Use format helpers from `@/lib/utils`.

## 6. Critical Rules for AI Agents

1. **Type Safety:** Never use `any`. Always run `npm run check` before marking tasks complete.
2. **Read Before Write:** Always read files before editing to understand context.
3. **Path Aliases:** Use `@/` and `@shared/` aliases, not relative paths.
4. **Dependency Management:** Check `package.json` before suggesting new libraries.
5. **Error Logging:** Always add contextual logging in catch blocks.
6. **API Consistency:** Maintain RESTful conventions. Follow existing route patterns.
7. **Shadcn UI:** Do not modify files in `client/src/components/ui/` - these are managed components.
8. **Database Changes:** Always update `shared/schema.ts` first, then run `npm run db:push`.
9. **Session/Auth:** Respect authentication middleware. Check `requireAuth` usage.
10. **Performance:** Use database indexes, pagination, and query optimization for large datasets.

## 7. Common Pitfalls to Avoid

- ❌ Forgetting to run `npm run check` after code changes
- ❌ Using `any` type instead of proper TypeScript types
- ❌ Modifying Shadcn UI components directly (use composition instead)
- ❌ Exposing sensitive data or stack traces to frontend
- ❌ Ignoring timezone issues (always use `America/Sao_Paulo`)
- ❌ Creating unvalidated API endpoints (always use Zod schemas)
- ❌ Mixing `.then()` chains with `async/await`
- ❌ Forgetting error handling in async functions

---
*Last updated: Jan 27, 2026*
