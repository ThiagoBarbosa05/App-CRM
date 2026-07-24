import { describe, expect, it, vi, beforeEach } from "vitest";

// resolveOutboundChannelForSender é a única função exercida aqui — os módulos
// abaixo são side-effect (DB real, integrações externas) ou irrelevantes para
// esta lógica pura de "qual canal/direção usar dado quem está enviando".
vi.mock("../../db", () => ({ db: { select: vi.fn() } }));
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

const {
  listChannelIdsForUserMock,
  getChannelIdentityByIdMock,
  resolveChannelByIdMock,
  resolveChannelForConversationMock,
} = vi.hoisted(() => ({
  listChannelIdsForUserMock: vi.fn(),
  getChannelIdentityByIdMock: vi.fn(),
  resolveChannelByIdMock: vi.fn(),
  resolveChannelForConversationMock: vi.fn(),
}));

vi.mock("../whatsapp-channels.service", () => ({
  getChannelById: vi.fn(),
  getChannelForConversation: vi.fn(),
  resolveChannelForConversation: resolveChannelForConversationMock,
  resolveChannelById: resolveChannelByIdMock,
  getActiveChannelIdByUserId: vi.fn(),
  listChannelIdsForUser: listChannelIdsForUserMock,
  getDefaultSectorIdForChannel: vi.fn(),
  getChannelByPhone: vi.fn(),
  getChannelIdentityById: getChannelIdentityByIdMock,
  isSameChannelPhone: vi.fn(),
}));

import { db } from "../../db";
import { resolveOutboundChannelForSender } from "../whatsapp-conversations.service";

/** Monta o mock de `db.select(...).from(...).where(...).limit(1)` devolvendo `rows`. */
function mockConversationRow(row: Record<string, unknown> | undefined) {
  const rows = row ? [row] : [];
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });
}

const CLOUD_CHANNEL = (id: number) =>
  ({ id, provider: "cloud_api" as const, phoneNumberId: `pnid-${id}`, accessToken: `token-${id}` });

describe("resolveOutboundChannelForSender", () => {
  beforeEach(() => {
    listChannelIdsForUserMock.mockReset();
    getChannelIdentityByIdMock.mockReset();
    resolveChannelByIdMock.mockReset();
    resolveChannelForConversationMock.mockReset();
  });

  it("conversa externa (sem peerChannelId): sempre dono, outbound — igual ao comportamento antigo", async () => {
    mockConversationRow({ channelId: 5, peerChannelId: null, phone: "5511999998888" });
    resolveChannelForConversationMock.mockResolvedValue(CLOUD_CHANNEL(5));

    const result = await resolveOutboundChannelForSender("conv-1", "user-1");

    expect(result).toEqual({
      channel: CLOUD_CHANNEL(5),
      channelId: 5,
      direction: "outbound",
      targetPhone: "5511999998888",
    });
    // Não deveria nem consultar os canais do usuário — não é diálogo interno.
    expect(listChannelIdsForUserMock).not.toHaveBeenCalled();
  });

  it("usuário é do canal PEER (não do dono): envia pelo peer, direction inbound, destino = telefone do dono", async () => {
    // Eventos(7) é o dono, Búzios(12) é o peer — Televendas só tem acesso ao 12.
    mockConversationRow({ channelId: 7, peerChannelId: 12, phone: "+5522996212581" });
    listChannelIdsForUserMock.mockResolvedValue([12]);
    resolveChannelByIdMock.mockResolvedValue(CLOUD_CHANNEL(12));
    getChannelIdentityByIdMock.mockResolvedValue({ id: 7, name: "Eventos", displayPhone: "+5521989014965" });

    const result = await resolveOutboundChannelForSender("conv-2", "televendas");

    expect(result).toEqual({
      channel: CLOUD_CHANNEL(12),
      channelId: 12,
      direction: "inbound",
      targetPhone: "+5521989014965",
    });
  });

  it("usuário é do canal DONO: comportamento normal, dono/outbound", async () => {
    mockConversationRow({ channelId: 7, peerChannelId: 12, phone: "+5522996212581" });
    listChannelIdsForUserMock.mockResolvedValue([7]);
    resolveChannelForConversationMock.mockResolvedValue(CLOUD_CHANNEL(7));

    const result = await resolveOutboundChannelForSender("conv-3", "daiane");

    expect(result).toEqual({
      channel: CLOUD_CHANNEL(7),
      channelId: 7,
      direction: "outbound",
      targetPhone: "+5522996212581",
    });
    expect(resolveChannelByIdMock).not.toHaveBeenCalled();
  });

  it("usuário tem acesso aos DOIS canais: cai no comportamento padrão (dono/outbound)", async () => {
    mockConversationRow({ channelId: 7, peerChannelId: 12, phone: "+5522996212581" });
    listChannelIdsForUserMock.mockResolvedValue([7, 12]);
    resolveChannelForConversationMock.mockResolvedValue(CLOUD_CHANNEL(7));

    const result = await resolveOutboundChannelForSender("conv-4", "admin");

    expect(result?.channelId).toBe(7);
    expect(result?.direction).toBe("outbound");
  });

  it("admin/gerente sem canal próprio em nenhum dos dois lados: cai no dono/outbound", async () => {
    mockConversationRow({ channelId: 7, peerChannelId: 12, phone: "+5522996212581" });
    listChannelIdsForUserMock.mockResolvedValue([]);
    resolveChannelForConversationMock.mockResolvedValue(CLOUD_CHANNEL(7));

    const result = await resolveOutboundChannelForSender("conv-5", "gerente");

    expect(result?.channelId).toBe(7);
    expect(result?.direction).toBe("outbound");
  });

  it("conversa sem channelId (nunca teve canal vinculado): retorna null", async () => {
    mockConversationRow({ channelId: null, peerChannelId: null, phone: "5511999998888" });

    const result = await resolveOutboundChannelForSender("conv-6", "user-1");

    expect(result).toBeNull();
  });

  it("conversa não encontrada: retorna null", async () => {
    mockConversationRow(undefined);

    const result = await resolveOutboundChannelForSender("conv-inexistente", "user-1");

    expect(result).toBeNull();
  });

  it("peer identificado, mas o canal dono não tem displayPhone cadastrado: não sabe para onde mandar, cai no dono", async () => {
    mockConversationRow({ channelId: 7, peerChannelId: 12, phone: "+5522996212581" });
    listChannelIdsForUserMock.mockResolvedValue([12]);
    resolveChannelByIdMock.mockResolvedValue(CLOUD_CHANNEL(12));
    getChannelIdentityByIdMock.mockResolvedValue({ id: 7, name: "Eventos", displayPhone: null });
    resolveChannelForConversationMock.mockResolvedValue(CLOUD_CHANNEL(7));

    const result = await resolveOutboundChannelForSender("conv-7", "televendas");

    expect(result?.channelId).toBe(7);
    expect(result?.direction).toBe("outbound");
  });
});
