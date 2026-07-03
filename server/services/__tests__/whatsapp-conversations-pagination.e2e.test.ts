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
