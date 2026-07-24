import { describe, expect, it, vi, beforeEach } from "vitest";

// backfillEchoedOutboundMessage é a única função exercida aqui — os módulos
// abaixo são side-effect (DB real, integrações externas) ou irrelevantes para
// esta lógica de "esse eco casa com uma mensagem que o CRM já gravou?".
vi.mock("../../db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: () => {},
  publishSseEvent: () => {},
  revokeStaleConversationAccess: async () => {},
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: async () => null,
  sendMedia: async () => null,
  normalizeToJid: (p: string) => p,
  fetchProfilePictureUrl: async () => null,
}));
vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: async () => null,
  sendTemplateMessage: async () => null,
  uploadMedia: async () => null,
  sendMediaMessage: async () => null,
  sendReaction: async () => null,
  downloadMediaToBuffer: async () => null,
}));
vi.mock("../whatsapp-templates.service", () => ({
  getTemplateMedia: async () => null,
  fetchMetaTemplates: async () => [],
}));
vi.mock("../whatsapp-sectors.service", () => ({
  listSectorIdsForUser: async () => [],
}));
vi.mock("../../lib/webm-opus-to-ogg", () => ({
  remuxWebmOpusToOgg: (buf: Buffer) => buf,
}));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelById: vi.fn(),
  getChannelForConversation: vi.fn(),
  resolveChannelForConversation: vi.fn(),
  resolveChannelById: vi.fn(),
  getActiveChannelIdByUserId: vi.fn(),
  listChannelIdsForUser: vi.fn(),
  getDefaultSectorIdForChannel: vi.fn(),
  getChannelByPhone: vi.fn(),
  getChannelIdentityById: vi.fn(),
  isSameChannelPhone: vi.fn(),
}));

import { db } from "../../db";
import { backfillEchoedOutboundMessage } from "../whatsapp-conversations.service";

/** Mock de `db.select(...).from(...).where(...).orderBy(...).limit(1)`. */
function mockPendingRow(row: { id: string } | undefined) {
  const rows = row ? [row] : [];
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  });
}

/** Mock de `db.update(...).set(...).where(...)`. */
function mockUpdate() {
  const updateWhere = vi.fn(async () => undefined);
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
    set: () => ({ where: updateWhere }),
  });
  return updateWhere;
}

describe("backfillEchoedOutboundMessage", () => {
  beforeEach(() => {
    (db.select as ReturnType<typeof vi.fn>).mockReset();
    (db.update as ReturnType<typeof vi.fn>).mockReset();
  });

  it("casa e faz UPDATE quando existe mensagem pendente do CRM (independente da direção gravada)", async () => {
    mockPendingRow({ id: "msg-1" });
    const updateWhere = mockUpdate();

    const result = await backfillEchoedOutboundMessage("conv-1", {
      waMessageId: "wa-123",
      type: "text",
      content: "teste",
    });

    expect(result).toBe(true);
    expect(db.update).toHaveBeenCalledOnce();
    expect(updateWhere).toHaveBeenCalledOnce();
  });

  it("retorna false sem UPDATE quando não há mensagem pendente (era inbound real, não eco)", async () => {
    mockPendingRow(undefined);
    mockUpdate();

    const result = await backfillEchoedOutboundMessage("conv-2", {
      waMessageId: "wa-456",
      type: "text",
      content: "oi",
    });

    expect(result).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });
});
