import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  downloadMediaToBufferMock,
  uploadWhatsappMediaMock,
  resolveChannelByIdMock,
} = vi.hoisted(() => ({
  downloadMediaToBufferMock: vi.fn(),
  uploadWhatsappMediaMock: vi.fn(),
  resolveChannelByIdMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { update: vi.fn() } }));
vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  uploadMedia: vi.fn(),
  sendMediaMessage: vi.fn(),
  sendReaction: vi.fn(),
  downloadMediaToBuffer: downloadMediaToBufferMock,
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: vi.fn(),
  sendMedia: vi.fn(),
  normalizeToJid: (phone: string) => phone,
  fetchProfilePictureUrl: vi.fn(),
}));
vi.mock("../../lib/r2", () => ({
  uploadWhatsappMedia: uploadWhatsappMediaMock,
  getPublicR2Url: vi.fn(),
  getWhatsappMediaObject: vi.fn(),
  deleteR2Object: vi.fn(),
}));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: vi.fn(),
  publishSseEvent: vi.fn(),
  registerConversationAccessChecker: vi.fn(),
  revokeStaleConversationAccess: vi.fn(),
}));
vi.mock("../whatsapp-templates.service", () => ({ getTemplateMedia: vi.fn(), fetchMetaTemplates: vi.fn() }));
vi.mock("../whatsapp-sectors.service", () => ({ listSectorIdsForUser: vi.fn() }));
vi.mock("../../lib/webm-opus-to-ogg", () => ({ remuxWebmOpusToOgg: vi.fn() }));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelById: vi.fn(),
  resolveChannelForConversation: vi.fn(),
  resolveChannelById: resolveChannelByIdMock,
  getActiveChannelIdByUserId: vi.fn(),
  listChannelIdsForUser: vi.fn(),
  getDefaultSectorIdForChannel: vi.fn(),
  getChannelByPhone: vi.fn(),
  getChannelIdentityById: vi.fn(),
  isSameChannelPhone: vi.fn(),
}));

import { db } from "../../db";
import { persistInboundMedia } from "../whatsapp-conversations.service";

describe("persistInboundMedia", () => {
  beforeEach(() => {
    downloadMediaToBufferMock.mockReset();
    uploadWhatsappMediaMock.mockReset();
    resolveChannelByIdMock.mockReset();
    (db.update as ReturnType<typeof vi.fn>).mockReset();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    downloadMediaToBufferMock.mockResolvedValue({
      buffer: Buffer.from("media"), contentType: "image/jpeg", size: 5,
    });
    uploadWhatsappMediaMock.mockResolvedValue("whatsapp-media/media.jpg");
  });

  it("baixa mídia recebida com a credencial do canal Cloud API que a originou", async () => {
    resolveChannelByIdMock.mockResolvedValue({
      id: 27,
      provider: "cloud_api",
      phoneNumberId: "phone-number-27",
      accessToken: "token-27",
    });

    await persistInboundMedia("media-row-1", "meta-media-1", "image/jpeg", 27);

    expect(downloadMediaToBufferMock).toHaveBeenCalledWith("meta-media-1", {
      phoneNumberId: "phone-number-27",
      accessToken: "token-27",
    });
  });
});
