# AGENTS.md - Developer Guide & Rules

This document defines the coding standards, workflows, and tools for this repository. All AI agents and developers must adhere to these guidelines to ensure consistency and stability.

## 1. Project Overview & Architecture

This is a full-stack application utilizing a Monorepo-like structure:
- **Frontend:** React (Vite) located in `client/`.
- **Backend:** Express (Node.js) located in `server/`.
- **Shared:** Common types and schemas in `shared/`.
- **Database:** PostgreSQL with Drizzle ORM.
- **Styling:** Tailwind CSS + Shadcn UI.

## 2. Environment & Commands

### Key Scripts
- **Development Server:** `npm run dev`
  - Starts the Express backend (using `tsx`) and Vite frontend in parallel.
  - Access app at port 5000 (proxied) or configured port.
- **Type Checking:** `npm run check`
  - Runs `tsc` to validate types across the entire project.
  - **MANDATORY:** Run this before finishing any task involving code changes.
- **Build:** `npm run build`
  - Compiles frontend (Vite) and backend (esbuild).
- **Database Push:** `npm run db:push`
  - Pushes Drizzle schema changes to the database.

### Testing
*Note: No test runner (Jest/Vitest) is currently configured in `package.json`.*
- If asked to write tests, prefer **Vitest** for compatibility with Vite.
- To run a hypothetical single test (if configured): `npx vitest run path/to/file.test.ts`

## 3. Code Style & Conventions

### General TypeScript
- **Strict Typing:** `strict: true` is enabled. Do not use `any`. Explicitly define types for function parameters and return values.
- **Async/Await:** Prefer `async/await` over raw `.then()` chains.
- **Aliases:** Use the configured path aliases:
  - `@/*` -> `client/src/*`
  - `@shared/*` -> `shared/*`
- **Exports:** Use named exports generally; use default exports for React pages/lazy-loaded components if necessary.

### Frontend (React + Vite)
- **Component Structure:**
  - Place components in `client/src/components/`.
  - Use Shadcn UI components from `client/src/components/ui/`.
- **Hooks:** Custom hooks in `client/src/hooks/`.
- **State Management:** Use `tanstack-query` (React Query) for server state. Use `wouter` for routing.
- **Styling:**
  - Use Tailwind CSS utility classes.
  - Use `clsx` or `tailwind-merge` (via `lib/utils`) for conditional classes.
  - **Responsive Design:** Mobile-first approach.
- **Forms:** Use `react-hook-form` with `zod` resolvers (`@hookform/resolvers/zod`).

### Backend (Express)
- **Structure:**
  - Entry point: `server/index.ts`.
  - Routes: Define routes in `server/routes.ts`.
- **API Design:** RESTful principles. Return JSON.
- **Validation:** Use `zod` schemas (often shared from `@shared`) to validate request bodies/params.
- **Error Handling:**
  - Use try-catch blocks in async route handlers.
  - Send appropriate HTTP status codes (400, 404, 500).
  - Return descriptive error messages in JSON format: `{ message: "Error description" }`.

### Database (Drizzle ORM)
- **Schema:** Defined in `shared/schema.ts` (or similar).
- **Migrations:** Use `drizzle-kit push` for rapid prototyping; create migrations for production changes.
- **Queries:** Use the query builder pattern provided by Drizzle.
  ```typescript
  // Example
  await db.select().from(users).where(eq(users.id, 1));
  ```

## 4. Development Workflow

### Adding a New Feature
1.  **Define Schema:** If data models change, update `shared/schema.ts` first.
2.  **Update Types:** Ensure Zod schemas and TypeScript types are exported from `shared`.
3.  **Backend Implementation:**
    - Create/update routes in `server/routes.ts`.
    - Implement logic using Drizzle for DB interactions.
    - Verify with `curl` or Postman if complex.
4.  **Frontend Implementation:**
    - Create Zod schemas for forms if needed.
    - Build UI components using Shadcn primitives.
    - Integrate API using `useQuery` or `useMutation`.
5.  **Verify:** Run `npm run check` to ensure type safety.

### Modifying Existing Code
- **Read First:** Always read the file using `read` or `cat` before editing.
- **Context:** Check imports and surrounding functions to match style.
- **Refactoring:** If refactoring, ensure no functionality is lost.

## 5. Error Handling Guidelines

- **Frontend:**
  - Show toast notifications (using `use-toast`) for user-facing errors (e.g., "Failed to save").
  - Log detailed errors to console for debugging.
- **Backend:**
  - Log errors to the server console with context.
  - Do not expose stack traces to the client in production.

## 6. Naming Conventions

- **Variables/Functions:** `camelCase` (e.g., `getUser`, `isValid`).
- **Components:** `PascalCase` (e.g., `UserProfile`, `SubmitButton`).
- **Files:**
  - React components: `PascalCase.tsx` or `kebab-case.tsx` (match existing folder style).
  - Utilities/Functions: `kebab-case.ts` or `camelCase.ts`.
- **Database Tables:** `snake_case` (e.g., `user_profiles`).
- **Constants:** `UPPER_SNAKE_CASE` for global constants.

## 7. AI Agent Behavior (Self-Correction)

- **Dependency Check:** Before using a new library, check `package.json`. If missing, install it only if absolutely necessary and standard for the task.
- **Path handling:** Always use absolute paths for file tools.
- **Search:** Use `grep` and `glob` to find relevant code before asking the user.
- **Refusal:** If a task contradicts these rules or safety guidelines, explain why.

---
*Generated by opencode on Jan 26, 2026*
