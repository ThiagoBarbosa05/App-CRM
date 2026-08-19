import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendMediaMessageMock,
  resolveChannelForConversationMock,
} = vi.hoisted(() => ({
  sendMediaMessageMock: vi.fn(),
  resolveChannelForConversationMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  uploadMedia: vi.fn(),
  sendMediaMessage: sendMediaMessageMock,
  sendReaction: vi.fn(),
  downloadMediaToBuffer: vi.fn(),
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: vi.fn(), sendMedia: vi.fn(), sendReaction: vi.fn(),
  normalizeToJid: (phone: string) => phone, fetchProfilePictureUrl: vi.fn(),
}));
vi.mock("../../lib/r2", () => ({
  uploadWhatsappMedia: vi.fn(), getPublicR2Url: vi.fn(), getWhatsappMediaObject: vi.fn(), deleteR2Object: vi.fn(),
}));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: vi.fn(), publishSseEvent: vi.fn(),
  registerConversationAccessChecker: vi.fn(), revokeStaleConversationAccess: vi.fn(),
}));
vi.mock("../whatsapp-templates.service", () => ({ getTemplateMedia: vi.fn(), fetchMetaTemplates: vi.fn() }));
vi.mock("../whatsapp-sectors.service", () => ({ listSectorIdsForUser: vi.fn() }));
vi.mock("../../lib/webm-opus-to-ogg", () => ({ remuxWebmOpusToOgg: vi.fn() }));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelById: vi.fn(),
  resolveChannelForConversation: resolveChannelForConversationMock,
  resolveChannelById: vi.fn(),
  getActiveChannelIdByUserId: vi.fn(), listChannelIdsForUser: vi.fn(),
  getDefaultSectorIdForChannel: vi.fn(), getChannelByPhone: vi.fn(),
  getChannelIdentityById: vi.fn(), isSameChannelPhone: vi.fn(),
}));

import { db } from "../../db";
import { retryFailedMessage } from "../whatsapp-conversations.service";

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

describe("retryFailedMessage", () => {
  beforeEach(() => {
    sendMediaMessageMock.mockReset();
    resolveChannelForConversationMock.mockReset();
    (db.select as ReturnType<typeof vi.fn>).mockReset();
    (db.update as ReturnType<typeof vi.fn>).mockReset();

    const results = [
      [],
      [{ id: "conversation-1" }],
      [{
        id: "message-1", channelId: 7, direction: "outbound", content: null,
        type: "sticker", caption: null, rawPayload: null, mediaId: "media-1",
        waMediaId: "meta-sticker-1", mimeType: "image/webp", filename: "sticker.webp",
      }],
      [{ id: "conversation-1", phone: "5511999999999", clientId: "client-1", channelId: 7, peerChannelId: null }],
      [{ channelId: 7, peerChannelId: null, phone: "5511999999999" }],
    ];
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => selectResult(results.shift() ?? []));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    resolveChannelForConversationMock.mockResolvedValue({
      provider: "cloud_api", phoneNumberId: "phone-number-7", accessToken: "token-7",
    });
    sendMediaMessageMock.mockResolvedValue({ messages: [{ id: "wamid.retry-1" }] });
  });

  it("reenvia uma figurinha falhada pela Cloud API usando a mídia já enviada", async () => {
    await expect(retryFailedMessage("message-1", "conversation-1", "user-1", "admin"))
      .resolves.toBe("sent");

    expect(sendMediaMessageMock).toHaveBeenCalledWith(
      "5511999999999", "meta-sticker-1", "sticker", undefined, "sticker.webp",
      { phoneNumberId: "phone-number-7", accessToken: "token-7" },
    );
  });
});
