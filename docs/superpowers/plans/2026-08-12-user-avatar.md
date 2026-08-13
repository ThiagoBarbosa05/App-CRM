# Foto de perfil do usuário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada usuário defina e remova a própria foto de perfil, exibida na sidebar, na lista de usuários e no chat interno.

**Architecture:** Uma coluna `avatar_storage_key` em `users` guarda a chave do objeto no Cloudflare R2; a URL pública é derivada com `getPublicR2Url` na serialização, nunca persistida. Um router dedicado `POST/DELETE /api/users/me/avatar` faz upload e remoção sempre para `req.user.userId` — nenhum id vem do body, e é isso que garante que só o próprio usuário altera a sua foto. O client reduz a imagem para 512px via `<canvas>` antes de enviar, então não entra nenhuma dependência de processamento de imagem.

**Tech Stack:** TypeScript ESM, Express, Drizzle ORM (Neon serverless), multer, `@aws-sdk/client-s3` (R2), React 18, TanStack Query, Shadcn UI, Vitest + supertest.

**Spec:** [docs/superpowers/specs/2026-08-12-user-avatar-design.md](../specs/2026-08-12-user-avatar-design.md)

## Global Constraints

- `strict: true` — nunca usar `any`. ESM only. Sempre `async/await`, nunca `.then()`.
- **Nunca rodar `npm run db:push`.** Toda mudança de schema é aplicada por script `.mjs` com SQL direto, no padrão de `scripts/add-client-sexo-col.mjs`.
- **Nunca rodar `npm run check`** (estoura memória neste repo). Type check só com `npx tsc -p tsconfig.tmp.json`, sempre incluindo `server/types/express.d.ts`, e apagando o `tsconfig.tmp.json` ao final.
- Sem verificação visual em browser. Nada de `npm run dev`, preview ou pedir teste manual ao usuário.
- Código novo de rota vai em `server/routes/` (modular), nunca em `server/routes.ts` (legado).
- Não modificar arquivos em `client/src/components/ui/` (componentes Shadcn gerenciados).
- Mensagens de erro voltadas ao usuário em português.
- Limite de upload: **5 MB**. Mimes aceitos: **`image/jpeg`, `image/png`, `image/webp`**. Prefixo no R2: **`avatars/<userId>/<uuid>`**. Lado máximo da imagem após redução no client: **512 px**, jpeg qualidade **0.85**.
- Testes do projeto `unit` rodam em `environment: "node"` — sem `document`, sem `<canvas>`. Só lógica pura é testada no client.
- O glob do projeto `unit` é fechado ([vitest.config.ts:28](../../../vitest.config.ts)): arquivos de teste só rodam em `server/routes/__tests__/**/*.test.ts`, `server/services/__tests__/**/*.unit.test.ts` ou `client/src/lib/__tests__/**/*.test.ts`. Um teste fora desses caminhos nunca é coletado e a suíte segue verde mentindo.

## File Structure

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `scripts/add-user-avatar-column.mjs` | Migração SQL da coluna `avatar_storage_key` |
| `server/lib/user-serializer.ts` | `toPublicUser` — tira `password`/`avatarStorageKey`, deriva `avatarUrl` |
| `server/routes/user-profile.routes.ts` | Router `POST`/`DELETE /api/users/me/avatar` + `validateAvatarUpload`/`buildAvatarKey` |
| `server/routes/__tests__/user-profile.routes.test.ts` | Testes de rota (auth, validação, gravação, remoção) |
| `server/routes/__tests__/user-serializer.test.ts` | Testes de `toPublicUser` (fica em `routes/__tests__` porque é o glob que coleta) |
| `client/src/lib/image-resize.ts` | `computeResizedDimensions` (pura) + `resizeImageFile` (canvas) |
| `client/src/lib/__tests__/image-resize.test.ts` | Testes de `computeResizedDimensions` |
| `client/src/components/profile-modal.tsx` | Modal "Meu perfil" com trocar/remover foto |

**Modificar:**

| Arquivo | Mudança |
|---|---|
| `shared/schema.ts:34-52` | Coluna `avatarStorageKey` em `users` |
| `server/storage.ts:752-778` | `getUsers()` seleciona `avatarStorageKey` e devolve `avatarUrl` |
| `server/routes/auth.routes.ts:49-59, 80-82` | `login` e `/me` expõem `avatarUrl` |
| `server/routes/index.ts:198` | Monta `userProfileRouter` antes de `usersRouter` |
| `server/services/internal-chat.service.ts:439, 464, 475, 517, 548` | `avatarUrl` do outro usuário nas DMs |
| `client/src/hooks/useAuth.tsx:9-16` | `User.avatarUrl` |
| `client/src/components/sidebar.tsx:103-127` | Bloco do usuário vira botão + `<Avatar>` |
| `client/src/components/users-management.tsx:302-308` | `<AvatarImage>` na lista |
| `client/src/pages/whatsapp/internal-chat/internal-chat-panel.tsx:5, 251-259, 302-310` | `<AvatarImage>` na lista de DMs e no cabeçalho |

---

### Task 1: Coluna `avatar_storage_key`

**Files:**
- Create: `scripts/add-user-avatar-column.mjs`
- Modify: `shared/schema.ts:34-52`

**Interfaces:**
- Consumes: nada.
- Produces: `users.avatarStorageKey` (coluna Drizzle `text`, nullable) — usada por todas as tasks seguintes. `User` e `InsertUser` (já exportados de `shared/schema.ts`) passam a incluir `avatarStorageKey?: string | null`.

Não há teste automatizado nesta task: é DDL, e o projeto `unit` não toca banco. A verificação é o type check mais o `SELECT` no fim.

- [ ] **Step 1: Adicionar a coluna ao schema Drizzle**

Em `shared/schema.ts`, dentro de `export const users = pgTable("users", {...})`, inserir a linha logo após `umblerMemberName` (linha 48):

```ts
  umblerMemberName: text("umbler_member_name"),
  // Chave do objeto no R2 (ex.: "avatars/<userId>/<uuid>"). A URL pública não é
  // persistida — deriva-se de getPublicR2Url(). Ver server/lib/user-serializer.ts.
  avatarStorageKey: text("avatar_storage_key"),
  pdvUnitId: varchar("pdv_unit_id"),
```

- [ ] **Step 2: Escrever o script de migração**

Criar `scripts/add-user-avatar-column.mjs`:

```js
/**
 * Adiciona a coluna `avatar_storage_key` à tabela `users` — foto de perfil.
 * Guarda a CHAVE do objeto no R2, não a URL pública.
 *
 * Uso (banco de produção):
 *   node scripts/add-user-avatar-column.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-user-avatar-column.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_storage_key text
`;

console.log("[migration] Coluna avatar_storage_key adicionada à tabela users.");
```

- [ ] **Step 3: Rodar a migração**

```bash
node scripts/add-user-avatar-column.mjs
```

Esperado: `[migration] Coluna avatar_storage_key adicionada à tabela users.`

- [ ] **Step 4: Conferir que a coluna existe**

```bash
node -e "import('dotenv/config').then(async()=>{const {neon}=await import('@neondatabase/serverless');const sql=neon(process.env.DATABASE_URL);console.log(await sql\`select column_name, data_type, is_nullable from information_schema.columns where table_name='users' and column_name='avatar_storage_key'\`)})"
```

Esperado: uma linha com `column_name: 'avatar_storage_key'`, `data_type: 'text'`, `is_nullable: 'YES'`.

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts scripts/add-user-avatar-column.mjs
git commit -m "feat: add avatar_storage_key column to users"
```

---

### Task 2: `toPublicUser`

**Files:**
- Create: `server/lib/user-serializer.ts`
- Test: `server/routes/__tests__/user-serializer.test.ts`

**Interfaces:**
- Consumes: `users.avatarStorageKey` (Task 1); `getPublicR2Url(storageKey: string): string` de `server/lib/r2.ts`.
- Produces:
  ```ts
  export type PublicUser = Omit<User, "password" | "avatarStorageKey"> & {
    avatarUrl: string | null;
  };
  export function toPublicUser(user: User): PublicUser;
  export function toAvatarUrl(avatarStorageKey: string | null | undefined): string | null;
  ```
  `toAvatarUrl` é usada nas Tasks 5, 6 e 7, onde o objeto não é um `User` completo.

O teste vive em `server/routes/__tests__/` de propósito: é o glob que coleta testes de servidor fora de `services/`. Não mover para `server/lib/__tests__/` — lá ele nunca rodaria.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/routes/__tests__/user-serializer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/r2", () => ({
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
}));

import { toAvatarUrl, toPublicUser } from "../../lib/user-serializer";
import type { User } from "@shared/schema";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Ana",
    email: "ana@example.com",
    password: "hash-secreto",
    role: "vendedor",
    isActive: "true",
    blingVendedorId: null,
    blingVendedorName: null,
    umblerMemberId: null,
    umblerMemberName: null,
    avatarStorageKey: null,
    pdvUnitId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as User;
}

describe("toAvatarUrl", () => {
  it("devolve null quando não há chave", () => {
    expect(toAvatarUrl(null)).toBeNull();
    expect(toAvatarUrl(undefined)).toBeNull();
    expect(toAvatarUrl("")).toBeNull();
  });

  it("deriva a URL pública a partir da chave", () => {
    expect(toAvatarUrl("avatars/user-1/abc")).toBe("https://cdn.test/avatars/user-1/abc");
  });
});

describe("toPublicUser", () => {
  it("não vaza password nem avatarStorageKey", () => {
    const result = toPublicUser(buildUser({ avatarStorageKey: "avatars/user-1/abc" }));

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("avatarStorageKey");
  });

  it("expõe avatarUrl derivado da chave", () => {
    const result = toPublicUser(buildUser({ avatarStorageKey: "avatars/user-1/abc" }));

    expect(result.avatarUrl).toBe("https://cdn.test/avatars/user-1/abc");
  });

  it("expõe avatarUrl null quando o usuário não tem foto", () => {
    expect(toPublicUser(buildUser()).avatarUrl).toBeNull();
  });

  it("preserva os demais campos do usuário", () => {
    const result = toPublicUser(buildUser());

    expect(result.id).toBe("user-1");
    expect(result.name).toBe("Ana");
    expect(result.email).toBe("ana@example.com");
    expect(result.role).toBe("vendedor");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npx vitest run --project unit server/routes/__tests__/user-serializer.test.ts
```

Esperado: FAIL — `Failed to load .../server/lib/user-serializer` (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

Criar `server/lib/user-serializer.ts`:

```ts
import type { User } from "@shared/schema";
import { getPublicR2Url } from "./r2";

/** Usuário como o client o vê: sem senha, sem chave crua do R2, com URL pronta. */
export type PublicUser = Omit<User, "password" | "avatarStorageKey"> & {
  avatarUrl: string | null;
};

/**
 * Deriva a URL pública do avatar a partir da chave do R2. Use esta função nos
 * pontos em que o objeto não é um `User` completo (projeções de `select`).
 */
export function toAvatarUrl(
  avatarStorageKey: string | null | undefined,
): string | null {
  return avatarStorageKey ? getPublicR2Url(avatarStorageKey) : null;
}

export function toPublicUser(user: User): PublicUser {
  const { password: _password, avatarStorageKey, ...rest } = user;
  return { ...rest, avatarUrl: toAvatarUrl(avatarStorageKey) };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npx vitest run --project unit server/routes/__tests__/user-serializer.test.ts
```

Esperado: PASS, 6 testes.

- [ ] **Step 5: Confirmar que o vitest coleta o arquivo novo**

```bash
npx vitest list --project unit
```

Esperado: `server/routes/__tests__/user-serializer.test.ts` aparece na lista.

- [ ] **Step 6: Commit**

```bash
git add server/lib/user-serializer.ts server/routes/__tests__/user-serializer.test.ts
git commit -m "feat: add toPublicUser serializer with avatarUrl"
```

---

### Task 3: Validação e nomeação do avatar (lógica pura)

**Files:**
- Create: `server/routes/user-profile.routes.ts` (só as funções puras nesta task)
- Test: `server/routes/__tests__/user-profile.routes.test.ts` (só o bloco das funções puras nesta task)

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
  export const AVATAR_ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
  export function validateAvatarUpload(
    mimetype: string,
    size: number,
  ): { ok: true } | { ok: false; message: string };
  export function buildAvatarKey(userId: string): string;
  ```
  Usadas pelo router na Task 4.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/routes/__tests__/user-profile.routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  AVATAR_MAX_BYTES,
  buildAvatarKey,
  validateAvatarUpload,
} from "../user-profile.routes";

describe("validateAvatarUpload", () => {
  it("aceita jpeg, png e webp dentro do limite", () => {
    expect(validateAvatarUpload("image/jpeg", 1024)).toEqual({ ok: true });
    expect(validateAvatarUpload("image/png", 1024)).toEqual({ ok: true });
    expect(validateAvatarUpload("image/webp", 1024)).toEqual({ ok: true });
  });

  it("rejeita mime não permitido", () => {
    const result = validateAvatarUpload("application/pdf", 1024);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("JPEG");
    }
  });

  it("rejeita gif, que é imagem mas não está na whitelist", () => {
    expect(validateAvatarUpload("image/gif", 1024).ok).toBe(false);
  });

  it("rejeita arquivo acima do limite", () => {
    const result = validateAvatarUpload("image/jpeg", AVATAR_MAX_BYTES + 1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("5 MB");
    }
  });

  it("aceita arquivo exatamente no limite", () => {
    expect(validateAvatarUpload("image/jpeg", AVATAR_MAX_BYTES)).toEqual({ ok: true });
  });
});

describe("buildAvatarKey", () => {
  it("usa o prefixo avatars/<userId>/", () => {
    expect(buildAvatarKey("user-1")).toMatch(/^avatars\/user-1\/[0-9a-f-]{36}$/);
  });

  it("gera uma chave diferente a cada chamada", () => {
    expect(buildAvatarKey("user-1")).not.toBe(buildAvatarKey("user-1"));
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npx vitest run --project unit server/routes/__tests__/user-profile.routes.test.ts
```

Esperado: FAIL — não consegue resolver `../user-profile.routes`.

- [ ] **Step 3: Implementar as funções puras**

Criar `server/routes/user-profile.routes.ts`:

```ts
import { randomUUID } from "crypto";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Valida o arquivo recebido antes de subir para o R2. Separada do handler para
 * ser testável sem banco nem Express.
 */
export function validateAvatarUpload(
  mimetype: string,
  size: number,
): { ok: true } | { ok: false; message: string } {
  if (!(AVATAR_ALLOWED_MIMES as readonly string[]).includes(mimetype)) {
    return { ok: false, message: "Formato inválido. Envie uma imagem JPEG, PNG ou WebP." };
  }
  if (size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "A imagem deve ter no máximo 5 MB." };
  }
  return { ok: true };
}

/** Chave do objeto no R2. Única por upload, então o CDN nunca serve foto velha. */
export function buildAvatarKey(userId: string): string {
  return `avatars/${userId}/${randomUUID()}`;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npx vitest run --project unit server/routes/__tests__/user-profile.routes.test.ts
```

Esperado: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add server/routes/user-profile.routes.ts server/routes/__tests__/user-profile.routes.test.ts
git commit -m "feat: add avatar upload validation helpers"
```

---

### Task 4: Rotas `POST`/`DELETE /api/users/me/avatar`

**Files:**
- Modify: `server/routes/user-profile.routes.ts` (acrescenta o router)
- Modify: `server/routes/__tests__/user-profile.routes.test.ts` (acrescenta os testes de rota)
- Modify: `server/routes/index.ts:198`

**Interfaces:**
- Consumes: `validateAvatarUpload`, `buildAvatarKey`, `AVATAR_MAX_BYTES` (Task 3); `toAvatarUrl` (Task 2); `storage.getUser(id)` e `storage.updateUser(id, Partial<InsertUser>)` de `server/storage.ts`; `requireAuth` de `server/middleware/validation`; `r2` e `deleteR2Object` de `server/lib/r2`.
- Produces: `export const userProfileRouter: Router`, montado em `/api/users`. Responde `{ avatarUrl: string | null }` nas duas rotas — contrato consumido pelas Tasks 8 e 9.

- [ ] **Step 1: Escrever os testes que falham**

Primeiro, **substituir por completo o cabeçalho** de
`server/routes/__tests__/user-profile.routes.test.ts` (hoje são as duas linhas de
import da Task 3) pelo bloco abaixo. Os mocks precisam vir antes do import do
router: mockar `../../storage` é o que impede o teste de carregar `server/db.ts`,
que lança se `DATABASE_URL` não estiver definida.

```ts
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, updateUserMock, s3SendMock, deleteR2ObjectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  s3SendMock: vi.fn(),
  deleteR2ObjectMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: { getUser: getUserMock, updateUser: updateUserMock },
}));

vi.mock("../../lib/r2", () => ({
  r2: { send: s3SendMock },
  deleteR2Object: deleteR2ObjectMock,
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
}));

import {
  createMockAuthMiddleware,
  createRouteTestApp,
} from "../../test/create-route-test-app";
import {
  AVATAR_MAX_BYTES,
  buildAvatarKey,
  userProfileRouter,
  validateAvatarUpload,
} from "../user-profile.routes";
```

Os `describe` da Task 3 continuam como estão, logo abaixo.

E os casos, depois dos `describe` da Task 3:

```ts
describe("POST /api/users/me/avatar", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
    s3SendMock.mockReset();
    deleteR2ObjectMock.mockReset();
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: null });
    updateUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("rejeita sem autenticação", async () => {
    // App sem o mock de auth: exercita o requireAuth real.
    const app = express();
    app.use("/api/users", userProfileRouter);

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(401);
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejeita mime não permitido com 400", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "doc.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(400);
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejeita requisição sem arquivo com 400", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app).post("/api/users/me/avatar");

    expect(response.status).toBe(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("grava a chave no usuário AUTENTICADO, ignorando id enviado no body", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app)
      .post("/api/users/me/avatar")
      .field("userId", "outro-usuario")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    const [targetId, patch] = updateUserMock.mock.calls[0];
    expect(targetId).toBe("user-1");
    expect(patch.avatarStorageKey).toMatch(/^avatars\/user-1\//);
    expect(response.body.avatarUrl).toBe(`https://cdn.test/${patch.avatarStorageKey}`);
  });

  it("remove a foto anterior ao trocar", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: "avatars/user-1/antiga" });
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(deleteR2ObjectMock).toHaveBeenCalledWith("avatars/user-1/antiga");
  });

  it("responde 200 mesmo se a remoção da foto anterior falhar", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: "avatars/user-1/antiga" });
    deleteR2ObjectMock.mockRejectedValue(new Error("R2 fora do ar"));
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/users/me/avatar", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
    deleteR2ObjectMock.mockReset();
    updateUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("limpa a coluna e remove o objeto", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: "avatars/user-1/antiga" });
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app).delete("/api/users/me/avatar");

    expect(response.status).toBe(200);
    expect(response.body.avatarUrl).toBeNull();
    expect(updateUserMock).toHaveBeenCalledWith("user-1", { avatarStorageKey: null });
    expect(deleteR2ObjectMock).toHaveBeenCalledWith("avatars/user-1/antiga");
  });

  it("é idempotente quando não há foto", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: null });
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app).delete("/api/users/me/avatar");

    expect(response.status).toBe(200);
    expect(deleteR2ObjectMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
npx vitest run --project unit server/routes/__tests__/user-profile.routes.test.ts
```

Esperado: FAIL — `userProfileRouter` não é exportado.

- [ ] **Step 3: Implementar o router**

Acrescentar a `server/routes/user-profile.routes.ts` (mantendo as funções puras já escritas no topo):

```ts
import { Router } from "express";
import multer, { MulterError } from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { storage } from "../storage";
import { requireAuth } from "../middleware/validation";
import { r2, deleteR2Object } from "../lib/r2";
import { toAvatarUrl } from "../lib/user-serializer";

const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";

const upload = multer({ limits: { fileSize: AVATAR_MAX_BYTES } });

/**
 * Perfil do próprio usuário. Toda rota daqui opera sobre `req.user.userId` —
 * nenhum id vem do body ou da URL. É isso que garante que ninguém altera a foto
 * de outra pessoa.
 */
export const userProfileRouter = Router();

/** Apaga o objeto antigo sem derrubar o request: a foto nova já está gravada. */
async function removeOldAvatar(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await deleteR2Object(key);
  } catch (error) {
    console.error("Erro ao remover avatar anterior do R2:", error);
  }
}

userProfileRouter.post(
  "/me/avatar",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = req.user!.userId;

      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não fornecido" });
      }

      const validation = validateAvatarUpload(req.file.mimetype, req.file.size);
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message });
      }

      const previous = await storage.getUser(userId);
      const key = buildAvatarKey(userId);

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }),
      );

      await storage.updateUser(userId, { avatarStorageKey: key });
      await removeOldAvatar(previous?.avatarStorageKey);

      return res.json({ avatarUrl: toAvatarUrl(key) });
    } catch (error) {
      if (error instanceof MulterError) {
        return res.status(400).json({ message: "A imagem deve ter no máximo 5 MB." });
      }
      console.error("Erro ao atualizar foto de perfil:", error);
      return res.status(500).json({ message: "Erro ao atualizar foto de perfil" });
    }
  },
);

userProfileRouter.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const previous = await storage.getUser(userId);

    await storage.updateUser(userId, { avatarStorageKey: null });
    await removeOldAvatar(previous?.avatarStorageKey);

    return res.json({ avatarUrl: null });
  } catch (error) {
    console.error("Erro ao remover foto de perfil:", error);
    return res.status(500).json({ message: "Erro ao remover foto de perfil" });
  }
});
```

`multer` rejeita arquivos acima do limite antes do handler, com `MulterError`. Em Express 4 esse erro chega ao middleware de erro, não ao `catch` — por isso o `validateAvatarUpload` também checa `size`, cobrindo o caso em que o arquivo passa pelo multer. Se o `MulterError` escapar como 500 em produção, acrescentar um handler de erro de 4 argumentos no router.

- [ ] **Step 4: Rodar os testes e ver passar**

```bash
npx vitest run --project unit server/routes/__tests__/user-profile.routes.test.ts
```

Esperado: PASS, 15 testes (7 das funções puras + 8 de rota).

- [ ] **Step 5: Registrar o router**

Em `server/routes/index.ts`, acrescentar o import junto aos demais (perto da linha 9):

```ts
import { userProfileRouter } from "./user-profile.routes";
```

E montar **antes** de `usersRouter` (linha 198), para que `/me/avatar` nunca seja capturado por uma rota `/:id` do router de usuários:

```ts
apiRouter.use("/users", userProfileRouter);
apiRouter.use("/users", usersRouter);
```

- [ ] **Step 6: Type check**

Criar `tsconfig.tmp.json` na raiz:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": [
    "server/types/express.d.ts",
    "server/lib/user-serializer.ts",
    "server/routes/user-profile.routes.ts",
    "server/routes/__tests__/user-profile.routes.test.ts",
    "server/routes/__tests__/user-serializer.test.ts"
  ],
  "exclude": ["node_modules"]
}
```

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Apagar o arquivo depois:

```bash
rm tsconfig.tmp.json
```

- [ ] **Step 7: Commit**

```bash
git add server/routes/user-profile.routes.ts server/routes/__tests__/user-profile.routes.test.ts server/routes/index.ts
git commit -m "feat: add POST/DELETE /api/users/me/avatar"
```

---

### Task 5: `avatarUrl` nas respostas de autenticação

**Files:**
- Modify: `server/routes/auth.routes.ts:49-59, 71-87`

**Interfaces:**
- Consumes: `toPublicUser`, `toAvatarUrl` (Task 2).
- Produces: `POST /api/auth/login` e `GET /api/auth/me` respondem `user.avatarUrl: string | null`. Consumido pela Task 8.

Sem teste novo: `auth.routes.ts` não tem arquivo de teste hoje e criar um exigiria mockar `storage`, `bcrypt` e `jwt` — trabalho desproporcional para duas linhas. A cobertura da derivação está na Task 2.

- [ ] **Step 1: Importar o serializer**

Em `server/routes/auth.routes.ts`, junto aos imports (após a linha 8):

```ts
import { toAvatarUrl, toPublicUser } from "../lib/user-serializer";
```

- [ ] **Step 2: Acrescentar `avatarUrl` na resposta do login**

Substituir o objeto `user` do `return res.json({...})` do `POST /login` (linhas 49-59) por:

```ts
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        serviceChannelId: user.serviceChannel?.id ?? null,
        avatarUrl: toAvatarUrl(user.avatarStorageKey),
      },
      message: "Login realizado com sucesso",
    });
```

`storage.getUserByEmail` faz um `select` de campos explícitos e **não** traz a
coluna nova — sem isto, `user.avatarStorageKey` é sempre `undefined` no login.
Em `server/storage.ts:793`, acrescentar a linha à projeção:

```ts
        isActive: users.isActive,
        avatarStorageKey: users.avatarStorageKey,
        createdAt: users.createdAt,
```

- [ ] **Step 3: Usar `toPublicUser` no `/me`**

Substituir as linhas 80-82 do `GET /me`:

```ts
    return res.json({ user: toPublicUser(user) });
```

E remover o `const { password: _, ...userWithoutPassword } = user;` que ficou órfão.

- [ ] **Step 4: Verificar manualmente a forma da resposta**

```bash
node -e "import('dotenv/config').then(async()=>{const {neon}=await import('@neondatabase/serverless');const sql=neon(process.env.DATABASE_URL);console.log(await sql\`select id, name, avatar_storage_key from users limit 3\`)})"
```

Esperado: as linhas trazem `avatar_storage_key: null` — confirma que a coluna existe e o `select` do login não vai quebrar.

- [ ] **Step 5: Type check**

`tsconfig.tmp.json` com `server/types/express.d.ts`, `server/routes/auth.routes.ts` e `server/lib/user-serializer.ts` no `include`:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Apagar o `tsconfig.tmp.json`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/auth.routes.ts server/storage.ts
git commit -m "feat: expose avatarUrl in auth responses"
```

---

### Task 6: `avatarUrl` na listagem de usuários

**Files:**
- Modify: `server/storage.ts:752-778`

**Interfaces:**
- Consumes: `toAvatarUrl` (Task 2).
- Produces: cada item de `storage.getUsers()` ganha `avatarUrl: string | null` e **não** expõe `avatarStorageKey`. Consumido pela Task 9.

Sem teste novo: `getUsers` é uma query Drizzle direta contra o banco, fora do alcance do projeto `unit`.

- [ ] **Step 1: Importar o helper**

No topo de `server/storage.ts`, junto aos demais imports:

```ts
import { toAvatarUrl } from "./lib/user-serializer";
```

- [ ] **Step 2: Selecionar a coluna e mapear o resultado**

Substituir o corpo de `getUsers()` (linhas 752-778) por:

```ts
  async getUsers(): Promise<any[]> {
    const result = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        isActive: users.isActive,
        avatarStorageKey: users.avatarStorageKey,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        serviceChannel: {
          id: serviceChannels.id,
          name: serviceChannels.name,
          phoneNumber: serviceChannels.phoneNumber,
        },
      })
      .from(users)
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(
        serviceChannels,
        eq(userServiceChannel.serviceChannelId, serviceChannels.id),
      )
      .orderBy(users.createdAt);

    // A chave crua do R2 não sai daqui — o client recebe só a URL pronta.
    const withAvatar = result.map(({ avatarStorageKey, ...row }) => ({
      ...row,
      avatarUrl: toAvatarUrl(avatarStorageKey),
    }));

    return withAvatar.reverse();
  }
```

- [ ] **Step 3: Type check**

`tsconfig.tmp.json` com `server/types/express.d.ts` e `server/storage.ts` no `include`:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: `server/storage.ts` já acusa erros pré-existentes neste modo isolado (documentado no CLAUDE.md). Antes de mexer, rodar o mesmo tsconfig **sem** as suas mudanças (`git stash`) e comparar as listas — nenhum erro novo pode aparecer. Apagar o `tsconfig.tmp.json`.

- [ ] **Step 4: Garantir que a suíte segue verde**

```bash
npm run test:unit
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts
git commit -m "feat: expose avatarUrl in getUsers listing"
```

---

### Task 7: Avatar do interlocutor no chat interno

**Files:**
- Modify: `server/services/internal-chat.service.ts:28, 439, 464, 475, 517`

**Interfaces:**
- Consumes: `toAvatarUrl` (Task 2).
- Produces: `ConversationSummary.avatarUrl` deixa de ser sempre `null` em DM, e `ConversationSummary.otherUser` ganha `avatarUrl: string | null`. O tipo do client (`InternalConversationSummary` em `client/src/hooks/useInternalChat.ts:7-15`) já declara `avatarUrl` — não precisa mudar.

Sem teste novo: a função é uma sequência de queries Drizzle contra o banco, fora do alcance do projeto `unit`.

- [ ] **Step 1: Importar o helper e ampliar o tipo**

No topo de `server/services/internal-chat.service.ts`:

```ts
import { toAvatarUrl } from "../lib/user-serializer";
```

E em `ConversationSummary` (linha 28), trocar a declaração de `otherUser`:

```ts
  otherUser: { id: string; name: string; email: string; avatarUrl: string | null } | null;
```

- [ ] **Step 2: Aba "Atendentes" — selecionar a chave e derivar a URL**

Na linha 439, acrescentar a coluna ao `select`:

```ts
    const attendants = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(asc(users.name));
```

E no `map` (linhas 458-471), substituir por:

```ts
    return attendants.map(({ avatarStorageKey, ...attendant }) => {
      const dm = dmByKey.get(buildDmKey(userId, attendant.id));
      const avatarUrl = toAvatarUrl(avatarStorageKey);
      return {
        id: dm?.id ?? `pending:${attendant.id}`,
        type: "dm" as const,
        name: attendant.name,
        avatarUrl,
        otherUser: { ...attendant, avatarUrl },
        lastMessageAt: dm?.lastMessageAt ? dm.lastMessageAt.toISOString() : null,
        lastMessagePreview: null,
        unreadCount: 0,
        myRole: "member" as const,
      };
    });
```

- [ ] **Step 3: Abas "Todos"/"Grupos" — mesma derivação**

Na linha 475, acrescentar a coluna ao alias:

```ts
  const otherUserAlias = {
    id: users.id,
    name: users.name,
    email: users.email,
    avatarStorageKey: users.avatarStorageKey,
  };
```

Substituir o bloco das linhas 504-518 por:

```ts
    let otherUser: ConversationSummary["otherUser"] = null;
    if (row.conversation.type === "dm") {
      const [member] = await db
        .select(otherUserAlias)
        .from(internalConversationMembers)
        .innerJoin(users, eq(users.id, internalConversationMembers.userId))
        .where(
          and(
            eq(internalConversationMembers.conversationId, row.conversation.id),
            ne(internalConversationMembers.userId, userId),
          ),
        )
        .limit(1);
      if (member) {
        const { avatarStorageKey, ...rest } = member;
        otherUser = { ...rest, avatarUrl: toAvatarUrl(avatarStorageKey) };
      }
    }
```

E no `result.push` (linha 548), a DM passa a usar o avatar do interlocutor, e o grupo continua com o seu próprio:

```ts
      avatarUrl:
        row.conversation.type === "dm"
          ? otherUser?.avatarUrl ?? null
          : row.conversation.avatarUrl,
```

- [ ] **Step 4: Type check**

`tsconfig.tmp.json` com `server/types/express.d.ts`, `server/services/internal-chat.service.ts` e `server/lib/user-serializer.ts`:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Apagar o `tsconfig.tmp.json`.

- [ ] **Step 5: Commit**

```bash
git add server/services/internal-chat.service.ts
git commit -m "feat: serve DM peer avatar in internal chat"
```

---

### Task 8: Redução da imagem no client

**Files:**
- Create: `client/src/lib/image-resize.ts`
- Test: `client/src/lib/__tests__/image-resize.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export const AVATAR_MAX_DIMENSION = 512;
  export function computeResizedDimensions(
    width: number,
    height: number,
    maxSize: number,
  ): { width: number; height: number };
  export function resizeImageFile(file: File, maxSize?: number): Promise<Blob>;
  ```
  `resizeImageFile` é consumida pela Task 9.

Só `computeResizedDimensions` é testada: o projeto `unit` roda em `environment: "node"` ([vitest.config.ts:23](../../../vitest.config.ts)) e não tem `document` nem `<canvas>`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `client/src/lib/__tests__/image-resize.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeResizedDimensions } from "../image-resize";

describe("computeResizedDimensions", () => {
  it("não amplia imagem menor que o limite", () => {
    expect(computeResizedDimensions(200, 100, 512)).toEqual({ width: 200, height: 100 });
  });

  it("mantém imagem exatamente no limite", () => {
    expect(computeResizedDimensions(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });

  it("reduz paisagem pelo lado maior, mantendo proporção", () => {
    expect(computeResizedDimensions(2000, 1000, 512)).toEqual({ width: 512, height: 256 });
  });

  it("reduz retrato pelo lado maior, mantendo proporção", () => {
    expect(computeResizedDimensions(1000, 2000, 512)).toEqual({ width: 256, height: 512 });
  });

  it("arredonda para inteiro", () => {
    const result = computeResizedDimensions(1000, 333, 512);

    expect(result.width).toBe(512);
    expect(Number.isInteger(result.height)).toBe(true);
    expect(result.height).toBe(171);
  });

  it("nunca devolve dimensão zero", () => {
    const result = computeResizedDimensions(1000, 1, 512);

    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npx vitest run --project unit client/src/lib/__tests__/image-resize.test.ts
```

Esperado: FAIL — não resolve `../image-resize`.

- [ ] **Step 3: Implementar**

Criar `client/src/lib/image-resize.ts`:

```ts
/** Lado máximo do avatar depois da redução no client. */
export const AVATAR_MAX_DIMENSION = 512;

const JPEG_QUALITY = 0.85;

/**
 * Dimensões finais mantendo a proporção. Nunca amplia e nunca devolve zero.
 * Separada do canvas para ser testável no ambiente `node` do projeto `unit`.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxSize: number,
): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= maxSize) return { width, height };

  const ratio = maxSize / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Reduz a imagem para no máximo `maxSize` px de lado e devolve um jpeg. Evita
 * subir 8 MB de foto de celular para exibir um avatar de 40 px — e é por isso
 * que o servidor não precisa de `sharp`.
 */
export async function resizeImageFile(
  file: File,
  maxSize: number = AVATAR_MAX_DIMENSION,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const target = computeResizedDimensions(bitmap.width, bitmap.height, maxSize);

  if (target.width === bitmap.width && target.height === bitmap.height) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  return blob ?? file;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npx vitest run --project unit client/src/lib/__tests__/image-resize.test.ts
```

Esperado: PASS, 6 testes.

- [ ] **Step 5: Confirmar a coleta**

```bash
npx vitest list --project unit
```

Esperado: `client/src/lib/__tests__/image-resize.test.ts` aparece.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/image-resize.ts client/src/lib/__tests__/image-resize.test.ts
git commit -m "feat: add client-side avatar image resize"
```

---

### Task 9: Modal "Meu perfil" e sidebar

**Files:**
- Create: `client/src/components/profile-modal.tsx`
- Modify: `client/src/hooks/useAuth.tsx:9-16`
- Modify: `client/src/components/sidebar.tsx:1-32, 103-127`

**Interfaces:**
- Consumes: `POST`/`DELETE /api/users/me/avatar` → `{ avatarUrl: string | null }` (Task 4); `GET /api/auth/me` → `{ user: { ..., avatarUrl } }` (Task 5); `resizeImageFile` (Task 8).
- Produces: `export function ProfileModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): JSX.Element`.

Sem teste automatizado: são componentes React e o projeto `unit` roda em `node`, sem DOM. A validação é o type check.

- [ ] **Step 1: Acrescentar `avatarUrl` ao tipo do usuário autenticado**

Em `client/src/hooks/useAuth.tsx`, na interface `User` (linhas 9-16):

```ts
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: string;
  serviceChannelId: string | null;
  avatarUrl: string | null;
}
```

- [ ] **Step 2: Criar o modal**

Criar `client/src/components/profile-modal.tsx`:

```tsx
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { resizeImageFile } from "@/lib/image-resize";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user, updateUserAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const blob = await resizeImageFile(file);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");

      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível enviar a foto");
      }

      return (await response.json()) as { avatarUrl: string | null };
    },
    onSuccess: ({ avatarUrl }) => {
      if (user) updateUserAuthenticated({ ...user, avatarUrl });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Foto atualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível remover a foto");
      }
    },
    onSuccess: () => {
      if (user) updateUserAuthenticated({ ...user, avatarUrl: null });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Foto removida" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Zera o input para que escolher o MESMO arquivo de novo volte a disparar o change.
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_MIMES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Envie uma imagem JPEG, PNG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_BYTES) {
      toast({
        title: "Imagem muito grande",
        description: "A imagem deve ter no máximo 5 MB.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const isBusy = isProcessing || uploadMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            Sua foto aparece na barra lateral e para a equipe no chat interno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? "Usuário"} />
            <AvatarFallback className="text-xl">
              {initials(user?.name ?? "?")}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {isBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Alterar foto
            </Button>

            {user?.avatarUrl && (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => removeMutation.mutate()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Abrir o modal a partir da sidebar**

Em `client/src/components/sidebar.tsx`, acrescentar aos imports (após a linha 32):

```ts
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ProfileModal } from "./profile-modal";
```

Acrescentar o estado, junto aos existentes (após a linha 41):

```ts
  const [isProfileOpen, setIsProfileOpen] = useState(false);
```

Substituir o bloco "User Info Section" (linhas 103-127) por:

```tsx
          {/* User Info Section */}
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="w-full text-left mb-4 sm:mb-6 p-3 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
            title="Meu perfil"
          >
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? "Usuário"} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.name ? (
                    user.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || ""}
                </p>
              </div>
            </div>
            {user?.role && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs">
                  {user.role === "admin" ? "Administrador" :
                   user.role === "gerente" ? "Gerente" :
                   user.role === "vendedor" ? "Vendedor" : "Usuário"}
                </Badge>
              </div>
            )}
          </button>

          <ProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
```

O import `User` do lucide-react continua em uso (fallback sem nome), então não remover.

- [ ] **Step 4: Type check**

`tsconfig.tmp.json` com `server/types/express.d.ts`, `client/src/components/profile-modal.tsx`, `client/src/components/sidebar.tsx`, `client/src/hooks/useAuth.tsx` e `client/src/lib/image-resize.ts`:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Se aparecer erro em outro arquivo que consome `useAuth` (por causa do novo campo obrigatório `avatarUrl`), acrescentar esse arquivo ao `include` e corrigir. Apagar o `tsconfig.tmp.json`.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/profile-modal.tsx client/src/components/sidebar.tsx client/src/hooks/useAuth.tsx
git commit -m "feat: add profile modal with avatar upload"
```

---

### Task 10: Exibir a foto na lista de usuários e no chat interno

**Files:**
- Modify: `client/src/components/users-management.tsx:32, 294-308`
- Modify: `client/src/pages/whatsapp/internal-chat/internal-chat-panel.tsx:5, 251-259, 302-310`

**Interfaces:**
- Consumes: `avatarUrl` em `storage.getUsers()` (Task 6) e em `ConversationSummary` (Task 7).
- Produces: nada — é a ponta final.

- [ ] **Step 1: Importar `AvatarImage` na lista de usuários**

Em `client/src/components/users-management.tsx`, linha 32:

```ts
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
```

- [ ] **Step 2: Declarar `avatarUrl` no tipo da linha**

Substituir a declaração de `UserWithChannel` (linhas 53-60). O `Omit` é necessário:
`UserType` é o tipo da tabela Drizzle e traz `avatarStorageKey`, que a API
deliberadamente não envia — o client recebe `avatarUrl` no lugar.

```ts
// Estende o tipo User para incluir serviceChannel.
// A API troca avatarStorageKey (chave crua do R2) por avatarUrl já pronta.
type UserWithChannel = Omit<UserType, "avatarStorageKey"> & {
  avatarUrl: string | null;
  serviceChannel?: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  } | null;
};
```

- [ ] **Step 3: Renderizar a foto**

Substituir o `<Avatar>` das linhas 302-308:

```tsx
                      <Avatar className="h-12 w-12 border-2 border-slate-200 dark:border-slate-600">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                        <AvatarFallback className="bg-accent">
                          <span className="text-sm font-semibold text-primary">
                            {getInitials(user.name)}
                          </span>
                        </AvatarFallback>
                      </Avatar>
```

A `<div>` que estava dentro do `<Avatar>` some: ela renderizava sempre, e por isso taparia a imagem. `AvatarFallback` só aparece quando não há imagem carregada.

- [ ] **Step 4: Importar `AvatarImage` no chat interno**

Em `client/src/pages/whatsapp/internal-chat/internal-chat-panel.tsx`, linha 5:

```ts
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
```

- [ ] **Step 5: Foto na lista de conversas**

Substituir o `<Avatar>` das linhas 251-259:

```tsx
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={conversation.avatarUrl ?? undefined} alt={label ?? ""} />
                  <AvatarFallback className={conversation.type === "group" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : undefined}>
                    {conversation.type === "group" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      initials(label || "?")
                    )}
                  </AvatarFallback>
                </Avatar>
```

- [ ] **Step 6: Foto no cabeçalho da conversa**

Substituir o `<Avatar>` das linhas 302-310:

```tsx
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={selectedConversation?.avatarUrl ?? undefined}
                  alt={conversationLabel ?? ""}
                />
                <AvatarFallback>
                  {selectedConversation?.type === "group" ? (
                    <Users className="h-4 w-4" />
                  ) : (
                    initials(conversationLabel || "?")
                  )}
                </AvatarFallback>
              </Avatar>
```

- [ ] **Step 7: Type check**

`tsconfig.tmp.json` com `server/types/express.d.ts`, `client/src/components/users-management.tsx` e `client/src/pages/whatsapp/internal-chat/internal-chat-panel.tsx`:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Apagar o `tsconfig.tmp.json`.

- [ ] **Step 8: Rodar a suíte inteira**

```bash
npm run test:unit
```

Esperado: PASS, sem regressão.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/users-management.tsx client/src/pages/whatsapp/internal-chat/internal-chat-panel.tsx
git commit -m "feat: show user avatars in users list and internal chat"
```

---

## Verificação final

- [ ] `npm run test:unit` passa.
- [ ] `npx vitest list --project unit` mostra os três arquivos de teste novos: `user-serializer.test.ts`, `user-profile.routes.test.ts`, `image-resize.test.ts`.
- [ ] Nenhum `tsconfig.tmp.json` ficou no repositório: `git status` limpo.
- [ ] `git log --oneline` mostra os 10 commits das tasks.
