# Paginação por cursor no chat WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os `.limit(100)` sem paginação nas mensagens do chat e na lista de conversas do WhatsApp por paginação real via cursor (keyset), carregada sob demanda via scroll infinito, mantendo mensagens ordenadas da mais antiga (topo) para a mais recente (fundo).

**Architecture:** Cursor opaco composto `(timestamp, id)` (keyset pagination) nos dois endpoints (`GET /api/whatsapp/conversations` e `GET /api/whatsapp/conversations/:clientId`). No frontend, `useInfiniteQuery` do TanStack Query em ambas as listas; atualizações em tempo real (SSE + polling periódico) só re-buscam e fundem a página mais recente no cache, sem tocar páginas antigas já carregadas por scroll.

**Tech Stack:** Express + Drizzle ORM (Postgres/Neon) no backend; React + TanStack Query v5 (`useInfiniteQuery`) no frontend; Vitest para testes (projeto "unit" sem banco, projeto "bot-e2e" com Postgres real via `TEST_DATABASE_URL`).

## Global Constraints

- Paginação por cursor composto `(timestamp, id)` — nunca offset, nunca cursor só-timestamp (ver spec, seção "Por que cursor composto").
- Tamanho de página: **20** para mensagens e para conversas (fixado no servidor, cliente não controla; exceção: o badge do botão flutuante pede `?limit=100` explicitamente, sem cursor).
- Scroll infinito **automático** nas duas listas (sem botão "carregar mais").
- Polling periódico existente é **mantido**, mas restrito a atualizar só a primeira página (mais recentes) — nunca re-busca páginas antigas já carregadas.
- Cursor inválido/malformado nunca gera 500 — é tratado como "sem cursor" (primeira página).
- `npm run check` deve passar sem novos erros antes de qualquer commit que toque `.ts`/`.tsx`.
- Spec completa: [docs/superpowers/specs/2026-07-02-wa-chat-cursor-pagination-design.md](../specs/2026-07-02-wa-chat-cursor-pagination-design.md).

---

### Task 1: Cursor opaco (`server/lib/cursor-pagination.ts`)

**Files:**
- Create: `server/lib/cursor-pagination.ts`
- Test: `server/services/__tests__/cursor-pagination.unit.test.ts` (colocado aqui, não em `server/lib/__tests__`, porque o glob do projeto "unit" no `vitest.config.ts` só inclui `server/services/__tests__/**/*.unit.test.ts` — ver Task 1, Passo 1)

**Interfaces:**
- Produces: `interface Cursor { at: string | null; id: string }`, `encodeCursor(cursor: Cursor): string`, `decodeCursor(raw: unknown): Cursor | null`, `clampLimit(raw: unknown, options: { fallback: number; max: number }): number` — usados pelas Tasks 2, 3 e 4.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `server/services/__tests__/cursor-pagination.unit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampLimit, decodeCursor, encodeCursor } from "../../lib/cursor-pagination";

describe("encodeCursor / decodeCursor", () => {
  it("faz round-trip preservando at e id", () => {
    const cursor = { at: "2026-07-02T23:16:00.000Z", id: "msg-1" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("preserva at: null (bucket sem timestamp da lista de conversas)", () => {
    const cursor = { at: null, id: "conv-1" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("retorna null para string que não é base64/JSON válido", () => {
    expect(decodeCursor("not-a-valid-cursor!!!")).toBeNull();
  });

  it("retorna null para JSON válido mas com formato errado", () => {
    const badShape = Buffer.from(JSON.stringify({ foo: "bar" }), "utf-8").toString(
      "base64url",
    );
    expect(decodeCursor(badShape)).toBeNull();
  });

  it("retorna null para undefined ou string vazia", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("clampLimit", () => {
  it("usa o fallback quando o valor é ausente", () => {
    expect(clampLimit(undefined, { fallback: 20, max: 100 })).toBe(20);
  });

  it("usa o fallback quando o valor não é um número válido", () => {
    expect(clampLimit("abc", { fallback: 20, max: 100 })).toBe(20);
  });

  it("usa o fallback quando o valor é <= 0", () => {
    expect(clampLimit("0", { fallback: 20, max: 100 })).toBe(20);
    expect(clampLimit("-5", { fallback: 20, max: 100 })).toBe(20);
  });

  it("trava no máximo quando o valor pedido excede", () => {
    expect(clampLimit("500", { fallback: 20, max: 100 })).toBe(100);
  });

  it("respeita o valor pedido quando está dentro do intervalo", () => {
    expect(clampLimit("35", { fallback: 20, max: 100 })).toBe(35);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run server/services/__tests__/cursor-pagination.unit.test.ts`
Expected: FAIL — `Cannot find module '../../lib/cursor-pagination'`

- [ ] **Step 3: Implementar `server/lib/cursor-pagination.ts`**

```ts
/**
 * Cursor opaco para paginação por conjunto de chaves (keyset pagination).
 * `at` é o timestamp (ISO) do item de fronteira; `id` desempata quando dois
 * itens têm exatamente o mesmo timestamp (ex.: sincronizações em lote). `at`
 * só é `null` no bucket "sem timestamp" da lista de conversas (conversas sem
 * nenhuma mensagem ainda).
 */
export interface Cursor {
  at: string | null;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
}

/** Cursor inválido/malformado vira `null` (tratado como "primeira página"), nunca lança. */
export function decodeCursor(raw: unknown): Cursor | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof (parsed as { id: unknown }).id === "string" &&
      "at" in parsed &&
      ((parsed as { at: unknown }).at === null ||
        typeof (parsed as { at: unknown }).at === "string")
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

/** Lê um `limit` de query param e trava dentro de [1, max], usando `fallback` quando ausente/inválido. */
export function clampLimit(
  raw: unknown,
  options: { fallback: number; max: number },
): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return options.fallback;
  return Math.min(parsed, options.max);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run server/services/__tests__/cursor-pagination.unit.test.ts`
Expected: PASS (11 testes)

- [ ] **Step 5: Type check e commit**

Run: `npm run check`

```bash
git add server/lib/cursor-pagination.ts server/services/__tests__/cursor-pagination.unit.test.ts
git commit -m "feat(wa-chat): adiciona codec de cursor para paginação keyset"
```

---

### Task 2: Paginação das mensagens (`getConversation`)

**Files:**
- Modify: `server/services/whatsapp-conversations.service.ts:437-537` (função `getConversation`)
- Modify: `server/test/bot-fixtures.ts` (novos helpers `createConversation`/`createMessage`)
- Create: `server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts`

**Interfaces:**
- Consumes: `Cursor`, `decodeCursor`, `encodeCursor`, `clampLimit` de `../lib/cursor-pagination` (Task 1).
- Produces: `getConversation(conversationId, userId, userRole, pagination?: { cursor?: Cursor | null; limit?: number })` agora retorna `{ conversation, messages, nextCursor: string | null }` — usado pela Task 4 (rota).
- Produces (fixtures): `createConversation(overrides?)`, `createMessage(conversationId, overrides?)` em `server/test/bot-fixtures.ts` — reutilizáveis por futuros testes e2e.

- [ ] **Step 1: Adicionar fixtures de conversa/mensagem com timestamp controlável**

Em `server/test/bot-fixtures.ts`, adicionar ao final do arquivo (após `getOutboundMessages`):

```ts
export async function createConversation(
  overrides: Partial<typeof whatsappConversations.$inferInsert> = {},
): Promise<typeof whatsappConversations.$inferSelect> {
  const [conversation] = await db
    .insert(whatsappConversations)
    .values({
      phone: overrides.phone ?? `5511${Math.floor(Math.random() * 1e9)}`,
      ...overrides,
    })
    .returning();
  return conversation;
}

export async function createMessage(
  conversationId: string,
  overrides: Partial<typeof whatsappMessages.$inferInsert> = {},
): Promise<typeof whatsappMessages.$inferSelect> {
  const [message] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      direction: overrides.direction ?? "inbound",
      type: overrides.type ?? "text",
      content: overrides.content ?? "mensagem de teste",
      sentAt: overrides.sentAt ?? new Date(),
      ...overrides,
    })
    .returning();
  return message;
}
```

(`whatsappConversations` e `whatsappMessages` já estão importados no topo do arquivo — nenhum import novo necessário.)

- [ ] **Step 2: Escrever os testes e2e de paginação de mensagens (falhando)**

Criar `server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";

// ── Mocks das fronteiras externas ────────────────────────────────────────────
// O banco é REAL (TEST_DATABASE_URL). Mocka-se só o que sai do processo.
vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: vi.fn(async () => ({})),
  sendTemplateMessage: vi.fn(async () => ({})),
  sendMediaMessage: vi.fn(async () => ({})),
  sendReaction: vi.fn(async () => ({})),
  uploadMedia: vi.fn(async () => "media-id-test"),
  downloadMediaToBuffer: vi.fn(async () => ({
    buffer: Buffer.from(""),
    contentType: "application/octet-stream",
    size: 0,
  })),
}));
vi.mock("../../integrations/evolution", () => ({
  normalizeToJid: (s: string) => s,
  jidToPhone: (s: string) => s,
  isGroupJid: () => false,
  sendText: vi.fn(async () => ({})),
  sendMedia: vi.fn(async () => ({})),
}));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: vi.fn(),
  publishSseEvent: vi.fn(),
}));
vi.mock("../../lib/r2", () => ({
  r2: { send: vi.fn() },
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
  uploadWhatsappMedia: vi.fn(async () => "r2-key-test"),
}));

import { getConversation, listClientsForChat } from "../whatsapp-conversations.service";
import {
  createConversation,
  createMessage,
  createUser,
  describeBotE2E,
  resetBotTables,
} from "../../test/bot-fixtures";
import { decodeCursor } from "../../lib/cursor-pagination";

describeBotE2E("getConversation — paginação de mensagens", () => {
  beforeEach(async () => {
    await resetBotTables();
  });

  it("retorna as `limit` mensagens mais recentes e nextCursor quando há mais antigas", async () => {
    const user = await createUser();
    const conv = await createConversation();
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      await createMessage(conv.id, {
        content: `msg-${i}`,
        sentAt: new Date(base + i * 60_000),
      });
    }

    const result = await getConversation(conv.id, user.id, "admin", { limit: 2 });

    expect(result).not.toBeNull();
    // ordem cronológica ascendente (mais antiga primeiro) dentro da página
    expect(result!.messages.map((m) => m.content)).toEqual(["msg-1", "msg-2"]);
    expect(result!.nextCursor).not.toBeNull();
  });

  it("usa nextCursor para buscar a página seguinte sem repetir nem pular mensagens", async () => {
    const user = await createUser();
    const conv = await createConversation();
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      await createMessage(conv.id, {
        content: `msg-${i}`,
        sentAt: new Date(base + i * 60_000),
      });
    }

    const page1 = await getConversation(conv.id, user.id, "admin", { limit: 2 });
    const cursor = decodeCursor(page1!.nextCursor);
    const page2 = await getConversation(conv.id, user.id, "admin", {
      limit: 2,
      cursor,
    });

    expect(page2!.messages.map((m) => m.content)).toEqual(["msg-0"]);
    expect(page2!.nextCursor).toBeNull();

    const allContents = [
      ...page2!.messages.map((m) => m.content),
      ...page1!.messages.map((m) => m.content),
    ];
    expect(new Set(allContents)).toEqual(new Set(["msg-0", "msg-1", "msg-2"]));
  });

  it("desempata mensagens com o mesmo timestamp exato pelo id, sem duplicar nem pular", async () => {
    const user = await createUser();
    const conv = await createConversation();
    const sameInstant = new Date("2026-01-01T00:00:00.000Z");
    await createMessage(conv.id, { content: "a", sentAt: sameInstant });
    await createMessage(conv.id, { content: "b", sentAt: sameInstant });
    await createMessage(conv.id, { content: "c", sentAt: sameInstant });

    const page1 = await getConversation(conv.id, user.id, "admin", { limit: 2 });
    const cursor = decodeCursor(page1!.nextCursor);
    const page2 = await getConversation(conv.id, user.id, "admin", {
      limit: 2,
      cursor,
    });

    const allContents = [
      ...page2!.messages.map((m) => m.content),
      ...page1!.messages.map((m) => m.content),
    ];
    expect(allContents).toHaveLength(3);
    expect(new Set(allContents)).toEqual(new Set(["a", "b", "c"]));
    expect(page2!.nextCursor).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham (ou pulam sem TEST_DATABASE_URL)**

Run: `npx vitest run server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts --project bot-e2e`
Expected: sem `TEST_DATABASE_URL` configurado, a suíte inteira aparece como **SKIPPED** (comportamento esperado, ver `describeBotE2E`). Com `TEST_DATABASE_URL` configurado, os 3 testes devem **FALHAR** com erro de tipo/assinatura (`getConversation` ainda não aceita o 4º argumento `pagination`).

- [ ] **Step 4: Implementar a paginação em `getConversation`**

Em `server/services/whatsapp-conversations.service.ts`, adicionar ao topo do arquivo (junto aos demais imports):

```ts
import { Cursor, clampLimit, encodeCursor } from "../lib/cursor-pagination";
```

Substituir a função `getConversation` inteira (linhas 437-537) por:

```ts
export async function getConversation(
  conversationId: string,
  userId: string,
  userRole: string,
  pagination: { cursor?: Cursor | null; limit?: number } = {},
) {
  const limit = clampLimit(pagination.limit, { fallback: 20, max: 50 });
  const cursor = pagination.cursor ?? null;

  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({
      id: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) return null;

  const replyMsg = alias(whatsappMessages, "reply_msg");
  const effectiveAt = sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`;

  const messageConditions: ReturnType<typeof eq>[] = [
    eq(whatsappMessages.conversationId, conversationId),
  ];
  if (cursor) {
    messageConditions.push(
      sql`(${effectiveAt}, ${whatsappMessages.id}) < (${cursor.at}::timestamp, ${cursor.id})` as unknown as ReturnType<typeof eq>,
    );
  }

  const rawMessages = await db
    .select({
      id: whatsappMessages.id,
      conversationId: whatsappMessages.conversationId,
      waMessageId: whatsappMessages.waMessageId,
      direction: whatsappMessages.direction,
      type: whatsappMessages.type,
      content: whatsappMessages.content,
      caption: whatsappMessages.caption,
      status: whatsappMessages.status,
      replyToMessageId: whatsappMessages.replyToMessageId,
      sentByUserId: whatsappMessages.sentByUserId,
      campaignMessageId: whatsappMessages.campaignMessageId,
      sentAt: whatsappMessages.sentAt,
      createdAt: whatsappMessages.createdAt,
      replyToContent: replyMsg.content,
      replyToType: replyMsg.type,
      replyToDirection: replyMsg.direction,
      channelId: whatsappMessages.channelId,
      channelName: whatsappChannels.name,
      channelProvider: whatsappChannels.provider,
      rawPayload: whatsappMessages.rawPayload,
      media: {
        id: whatsappMedia.id,
        whatsappMediaId: whatsappMedia.whatsappMediaId,
        storageKey: whatsappMedia.storageKey,
        mimeType: whatsappMedia.mimeType,
        filename: whatsappMedia.filename,
        size: whatsappMedia.size,
      },
    })
    .from(whatsappMessages)
    .leftJoin(whatsappMedia, eq(whatsappMessages.id, whatsappMedia.messageId))
    .leftJoin(replyMsg, eq(whatsappMessages.replyToMessageId, replyMsg.id))
    .leftJoin(whatsappChannels, eq(whatsappMessages.channelId, whatsappChannels.id))
    .where(and(...messageConditions))
    .orderBy(desc(effectiveAt), desc(whatsappMessages.id))
    .limit(limit + 1);

  const hasMore = rawMessages.length > limit;
  const pageRows = rawMessages.slice(0, limit);
  const oldestInPage = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && oldestInPage
      ? encodeCursor({
          at: (oldestInPage.sentAt ?? oldestInPage.createdAt).toISOString(),
          id: oldestInPage.id,
        })
      : null;

  pageRows.reverse();

  const messageIds = pageRows.map((m) => m.id);
  const reactionsRows = messageIds.length > 0
    ? await db
        .select({
          messageId: whatsappReactions.messageId,
          emoji: whatsappReactions.emoji,
          direction: whatsappReactions.direction,
        })
        .from(whatsappReactions)
        .where(inArray(whatsappReactions.messageId, messageIds))
    : [];

  const reactionsByMessage = new Map<string, { emoji: string; direction: "inbound" | "outbound" }[]>();
  for (const r of reactionsRows) {
    if (!r.emoji) continue;
    const list = reactionsByMessage.get(r.messageId) ?? [];
    list.push({ emoji: r.emoji, direction: r.direction as "inbound" | "outbound" });
    reactionsByMessage.set(r.messageId, list);
  }

  const messages = pageRows.map((m) => ({
    ...m,
    reactions: reactionsByMessage.get(m.id) ?? [],
  }));

  return { conversation: conv, messages, nextCursor };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam (requer `TEST_DATABASE_URL`)**

Run: `TEST_DATABASE_URL=<url-do-banco-de-teste> npx vitest run server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts --project bot-e2e`
Expected: PASS (3 testes). Sem `TEST_DATABASE_URL`, a suíte continua pulando — isso é esperado e não bloqueia o commit (mesma convenção de `whatsapp-bot-engine.e2e.test.ts`).

- [ ] **Step 6: Type check e commit**

Run: `npm run check`

```bash
git add server/services/whatsapp-conversations.service.ts server/test/bot-fixtures.ts server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts
git commit -m "feat(wa-chat): pagina mensagens da conversa por cursor keyset"
```

---

### Task 3: Paginação da lista de conversas (`listClientsForChat`)

**Files:**
- Modify: `server/services/whatsapp-conversations.service.ts:231-435` (função `listClientsForChat`)
- Modify: `server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts` (adiciona novo bloco `describeBotE2E`)

**Interfaces:**
- Consumes: `Cursor`, `decodeCursor`, `encodeCursor`, `clampLimit` de `../lib/cursor-pagination` (Task 1); `createClient`, `createConversation`, `createMessage`, `createUser` de `../../test/bot-fixtures`.
- Produces: `listClientsForChat(userId, userRole, search?, whatsappTagIds?, pagination?: { cursor?: Cursor | null; limit?: number })` agora retorna `{ items: ChatClient[], nextCursor: string | null }` (antes retornava um array puro) — usado pela Task 4 (rota).

- [ ] **Step 1: Escrever os testes e2e de paginação da lista (falhando)**

No mesmo arquivo `server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts` criado na Task 2, adicionar ao final:

```ts
describeBotE2E("listClientsForChat — paginação da lista de conversas", () => {
  beforeEach(async () => {
    await resetBotTables();
  });

  it("retorna as `limit` conversas mais recentes por última mensagem e nextCursor", async () => {
    const user = await createUser();
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    const convs = [];
    for (let i = 0; i < 3; i++) {
      const client = await createClient({ name: `Cliente ${i}` });
      const conv = await createConversation({ clientId: client.id });
      await createMessage(conv.id, { sentAt: new Date(base + i * 60_000) });
      convs.push(conv);
    }

    const result = await listClientsForChat(user.id, "admin", undefined, undefined, {
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    // mais recente primeiro: a última criada (i=2) tem o maior sentAt
    expect(result.items[0].conversationId).toBe(convs[2].id);
    expect(result.items[1].conversationId).toBe(convs[1].id);
    expect(result.nextCursor).not.toBeNull();
  });

  it("pagina para conversas sem nenhuma mensagem (bucket sem timestamp) só depois das com mensagem", async () => {
    const user = await createUser();
    const clientWithMsg = await createClient({ name: "Com mensagem" });
    const convWithMsg = await createConversation({ clientId: clientWithMsg.id });
    await createMessage(convWithMsg.id, { sentAt: new Date("2026-01-01T00:00:00.000Z") });

    const clientNoMsg = await createClient({ name: "Sem mensagem" });
    const convNoMsg = await createConversation({ clientId: clientNoMsg.id });

    const page1 = await listClientsForChat(user.id, "admin", undefined, undefined, {
      limit: 1,
    });
    expect(page1.items[0].conversationId).toBe(convWithMsg.id);
    expect(page1.nextCursor).not.toBeNull();

    const cursor = decodeCursor(page1.nextCursor);
    const page2 = await listClientsForChat(user.id, "admin", undefined, undefined, {
      limit: 1,
      cursor,
    });
    expect(page2.items[0].conversationId).toBe(convNoMsg.id);
    expect(page2.nextCursor).toBeNull();
  });

  it("combina cursor com filtro de busca sem vazar conversas fora do filtro", async () => {
    const user = await createUser();
    const clientA = await createClient({ name: "Ana Paginação" });
    const convA = await createConversation({ clientId: clientA.id });
    await createMessage(convA.id, { sentAt: new Date("2026-01-01T00:00:00.000Z") });

    const clientB = await createClient({ name: "Bruno Fora Do Filtro" });
    const convB = await createConversation({ clientId: clientB.id });
    await createMessage(convB.id, { sentAt: new Date("2026-01-01T00:01:00.000Z") });

    const result = await listClientsForChat(user.id, "admin", "Ana", undefined, {
      limit: 20,
    });

    expect(result.items.map((i) => i.conversationId)).toEqual([convA.id]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham (ou pulam sem TEST_DATABASE_URL)**

Run: `npx vitest run server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts --project bot-e2e`
Expected: SKIPPED sem `TEST_DATABASE_URL`; com a env configurada, FALHA — `listClientsForChat` ainda retorna um array puro, não `{ items, nextCursor }`, e ainda não aceita o 5º argumento `pagination`. Também falhará a importar `createClient` no novo arquivo — confirmar que o import foi adicionado (`createClient` já existe em `bot-fixtures.ts`, só precisa ser importado no topo do teste).

Ajustar o import no topo do arquivo de teste para incluir `createClient`:

```ts
import {
  createClient,
  createConversation,
  createMessage,
  createUser,
  describeBotE2E,
  resetBotTables,
} from "../../test/bot-fixtures";
```

- [ ] **Step 3: Implementar a paginação em `listClientsForChat`**

Em `server/services/whatsapp-conversations.service.ts`, dentro de `listClientsForChat` (linhas 231-435):

Alterar a assinatura da função:

```ts
export async function listClientsForChat(
  userId: string,
  userRole: string,
  search?: string,
  whatsappTagIds?: string[],
  pagination: { cursor?: Cursor | null; limit?: number } = {},
) {
```

Logo após a definição de `lastMsgSub` (antes de `const conditions: ReturnType<typeof eq>[] = [];`), adicionar:

```ts
  const limit = clampLimit(pagination.limit, { fallback: 20, max: 100 });
  const cursor = pagination.cursor ?? null;
```

Após o bloco de `whatsappTagIds` (antes de `const rows = await db`), adicionar a condição de cursor:

```ts
  if (cursor) {
    const cursorCondition =
      cursor.at !== null
        ? or(
            and(
              isNotNull(lastMsgSub.lastAt),
              sql`(${lastMsgSub.lastAt}, ${whatsappConversations.id}) < (${cursor.at}::timestamp, ${cursor.id})`,
            ),
            isNull(lastMsgSub.lastAt),
          )
        : and(isNull(lastMsgSub.lastAt), sql`${whatsappConversations.id} < ${cursor.id}`);
    conditions.push(cursorCondition as unknown as ReturnType<typeof eq>);
  }
```

Alterar a query `rows` para adicionar o desempate por `id` no `ORDER BY` e trocar `.limit(100)` por `.limit(limit + 1)`:

```ts
  const rows = await db
    .with(readsSub, unreadSub, lastMsgSub)
    .select({
      conversationId: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
      clientName: clients.name,
      lastMessageAt: lastMsgSub.lastAt,
      lastMessageContent: lastMsgSub.lastContent,
      lastMessageDirection: lastMsgSub.lastDirection,
      lastMessageType: lastMsgSub.lastType,
      unreadCount: sql<number>`coalesce(${unreadSub.unreadCount}, 0)`,
      channelId: whatsappConversations.channelId,
      channelName: whatsappChannels.name,
      channelDisplayPhone: whatsappChannels.displayPhone,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .leftJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .leftJoin(lastMsgSub, eq(whatsappConversations.id, lastMsgSub.conversationId))
    .leftJoin(unreadSub, eq(whatsappConversations.id, unreadSub.conversationId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${lastMsgSub.lastAt} DESC NULLS LAST`, desc(whatsappConversations.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          at: lastRow.lastMessageAt ? lastRow.lastMessageAt.toISOString() : null,
          id: lastRow.conversationId,
        })
      : null;
```

No restante da função (montagem de tags/etiquetas e retorno final), substituir as duas referências a `rows` por `pageRows`. Trocar:

```ts
  const clientIds = rows.map((r) => r.clientId).filter((id): id is string => !!id);
```

por:

```ts
  const clientIds = pageRows.map((r) => r.clientId).filter((id): id is string => !!id);
```

E trocar o `return` final (hoje a última linha da função, `return rows.map((row) => ({ ...row, tags: ..., whatsappTags: ... }));`):

```ts
  return rows.map((row) => ({
    ...row,
    tags: row.clientId ? (tagsByClient.get(row.clientId) ?? []) : [],
    whatsappTags: row.clientId ? (whatsappTagsByClient.get(row.clientId) ?? []) : [],
  }));
}
```

por:

```ts
  return {
    items: pageRows.map((row) => ({
      ...row,
      tags: row.clientId ? (tagsByClient.get(row.clientId) ?? []) : [],
      whatsappTags: row.clientId ? (whatsappTagsByClient.get(row.clientId) ?? []) : [],
    })),
    nextCursor,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam (requer `TEST_DATABASE_URL`)**

Run: `TEST_DATABASE_URL=<url-do-banco-de-teste> npx vitest run server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts --project bot-e2e`
Expected: PASS (6 testes no total — 3 de mensagens + 3 de lista).

- [ ] **Step 5: Type check e commit**

Run: `npm run check`

```bash
git add server/services/whatsapp-conversations.service.ts server/services/__tests__/whatsapp-conversations-pagination.e2e.test.ts
git commit -m "feat(wa-chat): pagina a lista de conversas por cursor keyset"
```

---

### Task 4: Rotas — parsear cursor/limit e novo formato de resposta

**Files:**
- Modify: `server/routes/whatsapp-conversations.routes.ts:1-28` (imports), `:139-173` (handlers `GET /conversations` e `GET /conversations/:clientId`)

**Interfaces:**
- Consumes: `decodeCursor`, `clampLimit` de `../lib/cursor-pagination` (Task 1); `listClientsForChat`, `getConversation` já atualizados (Tasks 2, 3).
- Produces: `GET /api/whatsapp/conversations` → `{ items, nextCursor }`; `GET /api/whatsapp/conversations/:clientId` → `{ conversation, messages, nextCursor }` — consumidos pelo frontend nas Tasks 6 e 7.

- [ ] **Step 1: Adicionar o import do cursor-pagination**

Em `server/routes/whatsapp-conversations.routes.ts`, logo após o import de `startBotSession` (linha 29):

```ts
import { clampLimit, decodeCursor } from "../lib/cursor-pagination";
```

- [ ] **Step 2: Atualizar `GET /conversations`**

Substituir (linhas 139-156):

```ts
router.get("/conversations", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const tagIds = Array.isArray(req.query.tagIds)
      ? (req.query.tagIds as string[])
      : typeof req.query.tagIds === "string"
        ? [req.query.tagIds]
        : undefined;
    const result = await listClientsForChat(user.userId, user.role, search, tagIds);
    res.json(result);
  } catch (err) {
    console.error("[WA Conversations] Erro ao listar conversas:", err);
    res.status(500).json({ message: "Erro ao listar conversas" });
  }
});
```

por:

```ts
router.get("/conversations", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const tagIds = Array.isArray(req.query.tagIds)
      ? (req.query.tagIds as string[])
      : typeof req.query.tagIds === "string"
        ? [req.query.tagIds]
        : undefined;
    const cursor = decodeCursor(req.query.cursor);
    const limit = clampLimit(req.query.limit, { fallback: 20, max: 100 });
    const result = await listClientsForChat(user.userId, user.role, search, tagIds, {
      cursor,
      limit,
    });
    res.json(result);
  } catch (err) {
    console.error("[WA Conversations] Erro ao listar conversas:", err);
    res.status(500).json({ message: "Erro ao listar conversas" });
  }
});
```

- [ ] **Step 3: Atualizar `GET /conversations/:clientId`**

Substituir (linhas 158-173):

```ts
router.get("/conversations/:clientId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await getConversation(conversationId, user.userId, user.role);
    if (result === null) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json(result);
  } catch {
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});
```

por:

```ts
router.get("/conversations/:clientId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const cursor = decodeCursor(req.query.cursor);
    const limit = clampLimit(req.query.limit, { fallback: 20, max: 50 });
    const result = await getConversation(conversationId, user.userId, user.role, {
      cursor,
      limit,
    });
    if (result === null) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json(result);
  } catch {
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});
```

- [ ] **Step 4: Type check**

Run: `npm run check`
Expected: sem novos erros em `server/routes/whatsapp-conversations.routes.ts`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/whatsapp-conversations.routes.ts
git commit -m "feat(wa-chat): expõe cursor/limit nas rotas de conversas e mensagens"
```

---

### Task 5: Helpers de infinite query no frontend

**Files:**
- Create: `client/src/lib/wa-chat-pagination.ts`
- Create: `client/src/lib/__tests__/wa-chat-pagination.test.ts`
- Create: `client/src/hooks/use-infinite-scroll-sentinel.ts`
- Modify: `vitest.config.ts` (adiciona glob de teste do client ao projeto "unit")

**Interfaces:**
- Produces: `mergeFirstPage<TPage extends { nextCursor: string | null }>(old, freshFirstPage)`, `refreshFirstPage<TPage>(queryClient, queryKey, fetchFirstPage)` de `@/lib/wa-chat-pagination` — usados pelas Tasks 6 e 7.
- Produces: `useInfiniteScrollSentinel(containerRef, onIntersect, enabled): RefObject<HTMLDivElement>` de `@/hooks/use-infinite-scroll-sentinel` — usado pelas Tasks 6 e 7.

- [ ] **Step 1: Estender o glob de testes do client no `vitest.config.ts`**

Em `vitest.config.ts`, no projeto `"unit"`, adicionar uma entrada ao array `include` (depois de `"server/services/__tests__/**/*.unit.test.ts"`):

```ts
          include: [
            "server/test/create-route-test-app.test.ts",
            "server/routes/__tests__/**/*.test.ts",
            "server/services/__tests__/**/*.unit.test.ts",
            "client/src/lib/__tests__/**/*.test.ts",
          ],
```

- [ ] **Step 2: Escrever o teste de `mergeFirstPage` (falhando)**

Criar `client/src/lib/__tests__/wa-chat-pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeFirstPage } from "../wa-chat-pagination";

interface FakePage {
  items: string[];
  nextCursor: string | null;
}

describe("mergeFirstPage", () => {
  it("substitui apenas a página 0 quando já há páginas antigas carregadas", () => {
    const old = {
      pages: [
        { items: ["a", "b"], nextCursor: "cursor-1" },
        { items: ["c", "d"], nextCursor: "cursor-2" },
      ] as FakePage[],
      pageParams: [null, "cursor-1"],
    };
    const fresh: FakePage = { items: ["a", "b", "novo"], nextCursor: "cursor-1" };

    const result = mergeFirstPage(old, fresh);

    expect(result.pages[0]).toEqual(fresh);
    expect(result.pages[1]).toEqual(old.pages[1]);
    expect(result.pages).toHaveLength(2);
    expect(result.pageParams).toEqual(old.pageParams);
  });

  it("cria a estrutura inicial quando não há cache anterior", () => {
    const fresh: FakePage = { items: ["a"], nextCursor: null };
    expect(mergeFirstPage(undefined, fresh)).toEqual({
      pages: [fresh],
      pageParams: [null],
    });
  });

  it("cria a estrutura inicial quando o cache anterior está vazio", () => {
    const fresh: FakePage = { items: ["a"], nextCursor: null };
    expect(mergeFirstPage({ pages: [], pageParams: [] }, fresh)).toEqual({
      pages: [fresh],
      pageParams: [null],
    });
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run client/src/lib/__tests__/wa-chat-pagination.test.ts`
Expected: FAIL — `Cannot find module '../wa-chat-pagination'`

- [ ] **Step 4: Implementar `client/src/lib/wa-chat-pagination.ts`**

```ts
import type { QueryClient, QueryKey } from "@tanstack/react-query";

interface CursorPage {
  nextCursor: string | null;
}

interface InfinitePageData<TPage> {
  pages: TPage[];
  pageParams: unknown[];
}

/**
 * Funde uma página recém-buscada (sem cursor = itens mais recentes) na página
 * 0 do cache, sem tocar nas páginas mais antigas já carregadas via scroll.
 * Pura — não depende do QueryClient — por isso é testável isoladamente.
 */
export function mergeFirstPage<TPage extends CursorPage>(
  old: InfinitePageData<TPage> | undefined,
  freshFirstPage: TPage,
): InfinitePageData<TPage> {
  if (!old || old.pages.length === 0) {
    return { pages: [freshFirstPage], pageParams: [null] };
  }
  return { ...old, pages: [freshFirstPage, ...old.pages.slice(1)] };
}

/**
 * Busca a página mais recente e funde no cache da infinite query indicada.
 * Usado pelo polling periódico e pelos eventos SSE — nunca refaz o fetch das
 * páginas antigas já carregadas pelo usuário via scroll.
 */
export async function refreshFirstPage<TPage extends CursorPage>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  fetchFirstPage: () => Promise<TPage>,
): Promise<void> {
  const freshFirstPage = await fetchFirstPage();
  queryClient.setQueryData<InfinitePageData<TPage>>(queryKey, (old) =>
    mergeFirstPage(old, freshFirstPage),
  );
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run client/src/lib/__tests__/wa-chat-pagination.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 6: Implementar o hook de sentinela de scroll infinito**

Criar `client/src/hooks/use-infinite-scroll-sentinel.ts`:

```ts
import { useEffect, useRef, type RefObject } from "react";

/**
 * Observa um elemento sentinela dentro de `containerRef` e chama `onIntersect`
 * quando ele entra na área visível — usado para infinite scroll (mensagens
 * antigas no topo do chat, conversas antigas no fim do sidebar).
 */
export function useInfiniteScrollSentinel(
  containerRef: RefObject<HTMLElement>,
  onIntersect: () => void,
  enabled: boolean,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const sentinel = sentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [containerRef, onIntersect, enabled]);

  return sentinelRef;
}
```

(Sem teste automatizado — depende de `IntersectionObserver`/DOM real; não há `jsdom`/`@testing-library` configurados no projeto. Verificação manual na Task 8.)

- [ ] **Step 7: Type check e commit**

Run: `npm run check`

```bash
git add client/src/lib/wa-chat-pagination.ts client/src/lib/__tests__/wa-chat-pagination.test.ts client/src/hooks/use-infinite-scroll-sentinel.ts vitest.config.ts
git commit -m "feat(wa-chat): helpers de merge de página e sentinela de scroll infinito"
```

---

### Task 6: Sidebar de conversas — infinite scroll

**Files:**
- Modify: `client/src/pages/whatsapp/conversations.tsx` (imports; `WhatsAppConversationsPage`: query da lista, `setTagsMutation.onMutate`, SSE handler, JSX da lista)
- Modify: `client/src/components/whatsapp-floating-button.tsx` (badge — novo formato de resposta)

**Interfaces:**
- Consumes: `mergeFirstPage`, `refreshFirstPage` de `@/lib/wa-chat-pagination`; `useInfiniteScrollSentinel` de `@/hooks/use-infinite-scroll-sentinel` (Task 5); resposta `{ items, nextCursor }` de `GET /api/whatsapp/conversations` (Task 4).

- [ ] **Step 1: Atualizar imports em `conversations.tsx`**

Trocar (linha 3):

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```

por:

```ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
```

Adicionar, junto aos demais imports de `@/lib`/`@/hooks` (perto da linha 27):

```ts
import { refreshFirstPage } from "@/lib/wa-chat-pagination";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";
```

- [ ] **Step 2: Trocar a query da lista por `useInfiniteQuery`**

Em `WhatsAppConversationsPage`, substituir (bloco atual `const { data: clientList = [], isLoading: isLoadingClients } = useQuery<ChatClient[]>({...})`, hoje nas linhas 4516-4534):

```ts
  const { data: clientList = [], isLoading: isLoadingClients } = useQuery<
    ChatClient[]
  >({
    queryKey: [
      "/api/whatsapp/conversations-list",
      debouncedSearch,
      selectedTagIds,
      user?.id,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      for (const id of selectedTagIds) params.append("tagIds", id);
      const res = await fetch(`/api/whatsapp/conversations?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
  });
```

por:

```ts
  interface ConversationsListPage {
    items: ChatClient[];
    nextCursor: string | null;
  }

  const conversationsListQueryKey = [
    "/api/whatsapp/conversations-list",
    debouncedSearch,
    selectedTagIds,
    user?.id,
  ];

  async function fetchConversationsListPage(
    cursor: string | null,
  ): Promise<ConversationsListPage> {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    for (const id of selectedTagIds) params.append("tagIds", id);
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/whatsapp/conversations?${params}`);
    if (!res.ok) return { items: [], nextCursor: null };
    return res.json();
  }

  const {
    data: clientListData,
    isLoading: isLoadingClients,
    fetchNextPage: fetchNextClientsPage,
    hasNextPage: hasNextClientsPage,
    isFetchingNextPage: isFetchingNextClientsPage,
    isFetchNextPageError: isClientsNextPageError,
  } = useInfiniteQuery({
    queryKey: conversationsListQueryKey,
    queryFn: ({ pageParam }) => fetchConversationsListPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const clientList = clientListData?.pages.flatMap((p) => p.items) ?? [];

  // Refs para o polling e o SSE global (não devem reabrir a conexão SSE nem
  // recriar o efeito a cada troca de busca/tag — só precisam ler o valor
  // mais recente no momento em que disparam).
  const fetchConversationsListPageRef = useRef(fetchConversationsListPage);
  fetchConversationsListPageRef.current = fetchConversationsListPage;
  const conversationsListQueryKeyRef = useRef(conversationsListQueryKey);
  conversationsListQueryKeyRef.current = conversationsListQueryKey;

  // Reforço periódico: re-busca só a página mais recente, sem tocar nas
  // páginas antigas já carregadas via scroll.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshFirstPage(queryClient, conversationsListQueryKey, () =>
        fetchConversationsListPage(null),
      );
    }, 15_000);
    return () => clearInterval(interval);
  }, [queryClient, debouncedSearch, selectedTagIds, user?.id]);
```

- [ ] **Step 3: Corrigir a atualização otimista de etiquetas (`setTagsMutation`)**

O cache agora tem o formato `{ pages: [{ items, nextCursor }, ...], pageParams }` em vez de um array puro — substituir (bloco `onMutate` de `setTagsMutation`, hoje nas linhas 4470-4484):

```ts
    onMutate: ({ clientId, tagIds }) => {
      queryClient.setQueriesData<ChatClient[]>(
        { queryKey: ["/api/whatsapp/conversations-list"] },
        (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.clientId !== clientId) return c;
            const newTags = availableWaTags.filter((t) =>
              tagIds.includes(t.id),
            );
            return { ...c, whatsappTags: newTags };
          });
        },
      );
    },
```

por:

```ts
    onMutate: ({ clientId, tagIds }) => {
      queryClient.setQueriesData<{
        pages: { items: ChatClient[]; nextCursor: string | null }[];
        pageParams: unknown[];
      }>({ queryKey: ["/api/whatsapp/conversations-list"] }, (prev) => {
        if (!prev) return prev;
        const newTags = availableWaTags.filter((t) => tagIds.includes(t.id));
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.clientId === clientId ? { ...c, whatsappTags: newTags } : c,
            ),
          })),
        };
      });
    },
```

- [ ] **Step 4: Simplificar o handler SSE global e usar `refreshFirstPage`**

Substituir (bloco `new_whatsapp_inbound`, hoje nas linhas 4570-4591):

```ts
  useEffect(() => {
    const es = new EventSource("/api/whatsapp/notifications/stream");
    es.addEventListener("new_whatsapp_inbound", (e) => {
      const data = JSON.parse(e.data) as {
        clientId: string | null;
        conversationId?: string | null;
      };
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations-list"],
      });
      const isSelected =
        (data.clientId && data.clientId === selectedIdRef.current) ||
        (data.conversationId && data.conversationId === selectedIdRef.current);
      if (isSelected) {
        markRead(selectedIdRef.current!);
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", selectedIdRef.current],
        });
      }
    });
    return () => es.close();
  }, [queryClient, markRead]);
```

por:

```ts
  useEffect(() => {
    const es = new EventSource("/api/whatsapp/notifications/stream");
    es.addEventListener("new_whatsapp_inbound", (e) => {
      const data = JSON.parse(e.data) as {
        clientId: string | null;
        conversationId?: string | null;
      };
      refreshFirstPage(queryClient, conversationsListQueryKeyRef.current, () =>
        fetchConversationsListPageRef.current(null),
      );
      const isSelected =
        (data.clientId && data.clientId === selectedIdRef.current) ||
        (data.conversationId && data.conversationId === selectedIdRef.current);
      // Não precisa re-buscar as mensagens aqui: se a conversa está
      // selecionada, o próprio ConversationMessages já tem seu stream SSE por
      // conversa (/conversations/:id/stream) que atualiza a 1ª página.
      if (isSelected) {
        markRead(selectedIdRef.current!);
      }
    });
    return () => es.close();
  }, [queryClient, markRead]);
```

- [ ] **Step 5: Atualizar o JSX da lista — sentinela no fim**

Adicionar um `ref` no container scrollável (hoje `<div className="flex-1 overflow-y-auto relative">`, linha 4757):

```tsx
        <div className="flex-1 overflow-y-auto relative" ref={sidebarContainerRef}>
```

Logo antes da declaração desse `return (...)` (junto às outras chamadas de hook do componente, perto de `selectedIdRef`), adicionar:

```ts
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreConversations = useCallback(() => {
    if (!hasNextClientsPage || isFetchingNextClientsPage) return;
    fetchNextClientsPage();
  }, [hasNextClientsPage, isFetchingNextClientsPage, fetchNextClientsPage]);
  const sidebarSentinelRef = useInfiniteScrollSentinel(
    sidebarContainerRef,
    loadMoreConversations,
    hasNextClientsPage === true,
  );
```

(`useCallback` já está importado no arquivo.)

Depois do fechamento do `clientList.map(...)` (hoje `))` seguido de `)}` e `</div>`, adicionar a sentinela antes do fechamento do container:

```tsx
              />
            ))
          )}
          {isClientsNextPageError && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-red-500">
              Erro ao carregar mais conversas.
              <button
                onClick={() => fetchNextClientsPage()}
                className="font-semibold underline underline-offset-2"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {hasNextClientsPage && <div ref={sidebarSentinelRef} className="h-4" />}
        </div>
```

- [ ] **Step 6: Corrigir o badge do botão flutuante**

Em `client/src/components/whatsapp-floating-button.tsx`, substituir:

```ts
  const { data: clientList = [] } = useQuery<ChatClient[]>({
    queryKey: ["/api/whatsapp/conversations-list-badge", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/conversations");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });
```

por:

```ts
  const { data: clientList = [] } = useQuery<ChatClient[]>({
    queryKey: ["/api/whatsapp/conversations-list-badge", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/conversations?limit=100");
      if (!res.ok) return [];
      const data = await res.json();
      return data.items ?? [];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });
```

- [ ] **Step 7: Type check**

Run: `npm run check`
Expected: sem novos erros. Se aparecer erro de tipo em `clientList.find(...)`/`.length` em outras partes do arquivo, confirmar que `clientList` continua tipado como `ChatClient[]` (derivado do `flatMap`) — nenhuma outra mudança deveria ser necessária.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/whatsapp/conversations.tsx client/src/components/whatsapp-floating-button.tsx
git commit -m "feat(wa-chat): infinite scroll na lista de conversas do sidebar"
```

---

### Task 7: Mensagens do chat — infinite scroll para cima

**Files:**
- Modify: `client/src/pages/whatsapp/conversations.tsx` (imports; `ConversationMessages`: query de mensagens, efeitos de scroll, SSE, todos os `invalidateQueries` da própria conversa, JSX da área de mensagens)

**Interfaces:**
- Consumes: `mergeFirstPage`, `refreshFirstPage` de `@/lib/wa-chat-pagination`; `useInfiniteScrollSentinel` de `@/hooks/use-infinite-scroll-sentinel` (Task 5); resposta `{ conversation, messages, nextCursor }` de `GET /api/whatsapp/conversations/:clientId` (Task 4).

- [ ] **Step 1: Adicionar `useLayoutEffect` aos imports do React**

Trocar (linha 1):

```ts
import { useState, useEffect, useRef, useCallback } from "react";
```

por:

```ts
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
```

- [ ] **Step 2: Trocar a query de mensagens por `useInfiniteQuery`**

Em `ConversationMessages`, substituir (hoje linhas 2725-2751):

```ts
  const { data: rawMessages = [], isLoading } = useQuery<WaMessage[]>({
    queryKey: ["/api/whatsapp/conversations", conversationKey],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/conversations/${conversationKey}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data?.messages ?? (Array.isArray(data) ? data : []);
    },
    refetchInterval: 30_000,
  });

  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.sentAt ?? a.createdAt).getTime() -
      new Date(b.sentAt ?? b.createdAt).getTime(),
  );

  // Ao abrir a conversa, pula direto para a última mensagem (sem animação);
  // mensagens que chegam depois (novas ou enviadas) rolam suavemente.
  const hasScrolledInitiallyRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: hasScrolledInitiallyRef.current ? "smooth" : "auto",
    });
    hasScrolledInitiallyRef.current = true;
  }, [isLoading, messages.length, localMessages.length]);
```

por:

```ts
  interface MessagesPage {
    messages: WaMessage[];
    nextCursor: string | null;
  }

  const messagesQueryKey = ["/api/whatsapp/conversations", conversationKey];

  async function fetchMessagesPage(cursor: string | null): Promise<MessagesPage> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(
      `/api/whatsapp/conversations/${conversationKey}?${params}`,
    );
    if (!res.ok) return { messages: [], nextCursor: null };
    const data = await res.json();
    return { messages: data?.messages ?? [], nextCursor: data?.nextCursor ?? null };
  }

  const {
    data: messagesData,
    isLoading,
    fetchNextPage: fetchNextMessagesPage,
    hasNextPage: hasNextMessagesPage,
    isFetchingNextPage: isFetchingNextMessagesPage,
    isFetchNextPageError: isMessagesNextPageError,
  } = useInfiniteQuery({
    queryKey: messagesQueryKey,
    queryFn: ({ pageParam }) => fetchMessagesPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    select: (data) => ({
      pages: [...data.pages].reverse(),
      pageParams: [...data.pageParams].reverse(),
    }),
  });

  const rawMessages = messagesData?.pages.flatMap((p) => p.messages) ?? [];

  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.sentAt ?? a.createdAt).getTime() -
      new Date(b.sentAt ?? b.createdAt).getTime(),
  );

  // Ao abrir a conversa, pula direto para a última mensagem (sem animação);
  // mensagens que chegam depois (novas ou enviadas) rolam suavemente. Quando o
  // crescimento vem de uma página ANTIGA carregada por scroll (o id da
  // primeira mensagem mudou), não rola — a posição é preservada pelo efeito
  // de scroll da Step 4 abaixo.
  const hasScrolledInitiallyRef = useRef(false);
  const firstMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const firstId = messages[0]?.id ?? null;
    const prependedOlderPage =
      firstMessageIdRef.current !== null && firstId !== firstMessageIdRef.current;
    firstMessageIdRef.current = firstId;
    if (prependedOlderPage) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: hasScrolledInitiallyRef.current ? "smooth" : "auto",
    });
    hasScrolledInitiallyRef.current = true;
  }, [isLoading, messages.length, localMessages.length]);
```

- [ ] **Step 3: Substituir todos os `invalidateQueries` da própria conversa por `refreshFirstPage`**

Existem 6 ocorrências do bloco `queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", conversationKey] });` neste componente: uma dentro do handler SSE (`new_message`, indentação de 6 espaços) e cinco dentro de blocos `finally`/callbacks de ações do usuário (`attemptSend`, `handleRetry`, `sendMedia`, `handleReact`, `sendTemplate` — indentação de 8 espaços).

Substituir as 5 ocorrências de 8 espaços (idênticas em `attemptSend`, `handleRetry`, `sendMedia`, `handleReact`, `sendTemplate`):

```ts
        queryClient.invalidateQueries({
          queryKey: ["/api/whatsapp/conversations", conversationKey],
        });
```

por (nas 5 ocorrências):

```ts
        refreshFirstPage(queryClient, messagesQueryKey, () => fetchMessagesPage(null));
```

E a ocorrência de 6 espaços, dentro do handler SSE `new_message`:

```ts
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/conversations", conversationKey],
      });
```

por:

```ts
      refreshFirstPage(queryClient, messagesQueryKey, () => fetchMessagesPage(null));
```

(As chamadas irmãs a `queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] })`, presentes nesses mesmos blocos, **não** mudam — continuam invalidando a lista do sidebar normalmente.)

Adicionar também o reforço periódico (30s), próximo ao efeito SSE (`new_message`):

```ts
  useEffect(() => {
    const interval = setInterval(() => {
      refreshFirstPage(queryClient, messagesQueryKey, () => fetchMessagesPage(null));
    }, 30_000);
    return () => clearInterval(interval);
  }, [queryClient, conversationKey]);
```

- [ ] **Step 4: Preservar a posição de scroll ao carregar mensagens antigas**

Adicionar, próximo à declaração de `messagesEndRef` (hoje linha 2593):

```ts
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pendingScrollAdjustRef = useRef<number | null>(null);
  const loadOlderMessages = useCallback(() => {
    if (!hasNextMessagesPage || isFetchingNextMessagesPage) return;
    const container = messagesContainerRef.current;
    pendingScrollAdjustRef.current = container?.scrollHeight ?? null;
    fetchNextMessagesPage();
  }, [hasNextMessagesPage, isFetchingNextMessagesPage, fetchNextMessagesPage]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const previousHeight = pendingScrollAdjustRef.current;
    if (!container || previousHeight === null) return;
    container.scrollTop += container.scrollHeight - previousHeight;
    pendingScrollAdjustRef.current = null;
  }, [messages.length]);

  const topSentinelRef = useInfiniteScrollSentinel(
    messagesContainerRef,
    loadOlderMessages,
    hasNextMessagesPage === true,
  );
```

- [ ] **Step 5: Atualizar o JSX da área de mensagens — ref do container e sentinela no topo**

Adicionar o `ref` no container scrollável (hoje `<div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1 bg-slate-50 dark:bg-slate-950/30">`):

```tsx
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1 bg-slate-50 dark:bg-slate-950/30"
      >
```

Logo após a abertura do fragmento que envolve `grouped.map(...)` (hoje `) : (\n  <>\n    {grouped.map(...`), adicionar a sentinela como primeiro filho:

```tsx
        ) : (
          <>
            {isMessagesNextPageError && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-red-500">
                Erro ao carregar mensagens antigas.
                <button
                  onClick={() => fetchNextMessagesPage()}
                  className="font-semibold underline underline-offset-2"
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {hasNextMessagesPage && <div ref={topSentinelRef} className="h-4" />}
            {grouped.map(({ date, msgs }) => (
```

- [ ] **Step 6: Type check**

Run: `npm run check`
Expected: sem novos erros.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/whatsapp/conversations.tsx
git commit -m "feat(wa-chat): infinite scroll das mensagens com preservação de posição"
```

---

### Task 8: Verificação manual end-to-end

**Files:** nenhum (só verificação)

- [ ] **Step 1: Type check completo**

Run: `npm run check`
Expected: nenhum erro nos arquivos tocados por este plano (erros pré-existentes em `server/storage.ts`, `server/test-pubsub.ts`, `shared/schema.ts` não são deste escopo).

- [ ] **Step 2: Rodar a suíte "unit" completa**

Run: `npx vitest run --project unit`
Expected: todos os testes passam, incluindo os novos de `cursor-pagination` e `wa-chat-pagination`.

- [ ] **Step 3: Subir o dev server e abrir a página de conversas**

Usar `preview_start` (config `dev` em `.claude/launch.json`), depois `preview_snapshot`/`preview_screenshot` em `/whatsapp/conversas`.

Checklist a validar manualmente no navegador:
- [ ] A lista do sidebar carrega inicialmente só ~20 conversas (checar via `preview_network` que a primeira chamada a `/api/whatsapp/conversations` não tem `cursor` e a resposta tem `nextCursor` quando há mais de 20 conversas no banco de dev).
- [ ] Rolar o sidebar até o fim dispara uma nova chamada com `cursor` no query string (`preview_network`), e mais itens aparecem sem duplicar os já visíveis.
- [ ] Abrir uma conversa com histórico longo (se existir uma com mais de 20 mensagens no banco de dev): a tela abre já no fim (mensagem mais recente), sem scroll visível.
- [ ] Rolar para o topo da conversa carrega mensagens mais antigas sem "pular" a posição de leitura atual (a mensagem que estava visível antes do fetch continua visível depois).
- [ ] Mensagens continuam em ordem cronológica (mais antiga no topo, mais recente embaixo) após carregar páginas antigas.
- [ ] Enviar uma mensagem nova na conversa aberta: aparece no fim, sem recarregar páginas antigas já vistas (checar `preview_network`: a chamada após o envio não deveria repetir cursors de páginas antigas).

- [ ] **Step 4: Parar o preview**

Usar `preview_stop` no serverId retornado no Step 3.
