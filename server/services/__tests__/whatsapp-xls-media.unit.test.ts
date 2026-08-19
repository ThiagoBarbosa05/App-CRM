import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  evolutionSendMediaMock,
  uploadWhatsappMediaMock,
  resolveChannelForConversationMock,
} = vi.hoisted(() => ({
  evolutionSendMediaMock: vi.fn(),
  uploadWhatsappMediaMock: vi.fn(),
  resolveChannelForConversationMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: vi.fn(), sendTemplateMessage: vi.fn(), uploadMedia: vi.fn(),
  sendMediaMessage: vi.fn(), sendReaction: vi.fn(), downloadMediaToBuffer: vi.fn(),
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: vi.fn(), sendMedia: evolutionSendMediaMock, sendReaction: vi.fn(),
  normalizeToJid: (phone: string) => phone, fetchProfilePictureUrl: vi.fn(),
}));
vi.mock("../../lib/r2", () => ({
  uploadWhatsappMedia: uploadWhatsappMediaMock, getPublicR2Url: vi.fn(),
  getWhatsappMediaObject: vi.fn(), deleteR2Object: vi.fn(),
}));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: vi.fn(), publishSseEvent: vi.fn(),
  registerConversationAccessChecker: vi.fn(), revokeStaleConversationAccess: vi.fn(),
}));
vi.mock("../whatsapp-templates.service", () => ({ getTemplateMedia: vi.fn(), fetchMetaTemplates: vi.fn() }));
vi.mock("../whatsapp-sectors.service", () => ({ listSectorIdsForUser: vi.fn() }));
vi.mock("../../lib/webm-opus-to-ogg", () => ({ remuxWebmOpusToOgg: vi.fn() }));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelById: vi.fn(), resolveChannelForConversation: resolveChannelForConversationMock,
  resolveChannelById: vi.fn(), getActiveChannelIdByUserId: vi.fn(), listChannelIdsForUser: vi.fn(),
  getDefaultSectorIdForChannel: vi.fn(), getChannelByPhone: vi.fn(),
  getChannelIdentityById: vi.fn(), isSameChannelPhone: vi.fn(),
}));

import { db } from "../../db";
import { sendConversationMedia } from "../whatsapp-conversations.service";

function selectResult<T>(result: T) {
  const query = {
    from: () => query,
    leftJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: vi.fn().mockResolvedValue(result),
  };
  return query;
}

function mutationQuery() {
  const query = {
    values: () => query,
    set: () => query,
    where: () => query,
    returning: vi.fn().mockResolvedValue([{ id: "message-1" }]),
  };
  return query;
}

describe("sendConversationMedia", () => {
  beforeEach(() => {
    const selections = [
      [{ id: "conversation-1", phone: "5511999999999", clientId: "client-1" }],
      [{ channelId: 7, peerChannelId: null, phone: "5511999999999" }],
      [{ id: "conversation-1", channelId: 7, peerChannelId: null, phone: "5511999999999" }],
    ];
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => selectResult(selections.shift() ?? []));
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(mutationQuery);
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(mutationQuery);
    resolveChannelForConversationMock.mockResolvedValue({
      provider: "evolution", evolutionInstanceName: "channel-7",
    });
    uploadWhatsappMediaMock.mockResolvedValue("whatsapp/media.xls");
    evolutionSendMediaMock.mockResolvedValue({ key: { id: "wa-message-1" }, status: "PENDING" });
  });

  it("envia XLS como documento", async () => {
    await expect(sendConversationMedia(
      "conversation-1",
      { buffer: Buffer.from("xls-content"), originalname: "relatorio.xls", mimetype: "application/vnd.ms-excel", size: 11 },
      "user-1",
      "admin",
    )).resolves.toEqual({ id: "message-1", status: "sent" });

    expect(evolutionSendMediaMock).toHaveBeenCalledWith(
      "channel-7",
      "5511999999999",
      "document",
      expect.objectContaining({
        filename: "relatorio.xls",
        mimetype: "application/vnd.ms-excel",
      }),
    );
  });
});
