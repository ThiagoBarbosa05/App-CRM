import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMediaBase64Mock, uploadWhatsappMediaMock } = vi.hoisted(() => ({
  getMediaBase64Mock: vi.fn(),
  uploadWhatsappMediaMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../integrations/evolution-api", () => ({
  evolutionApi: { getMediaBase64: getMediaBase64Mock },
  normalizeEvolutionQrData: vi.fn(),
}));
vi.mock("../../lib/r2", () => ({ uploadWhatsappMedia: uploadWhatsappMediaMock }));
vi.mock("../whatsapp-channels.service", () => ({ getChannelByEvolutionInstance: vi.fn() }));
vi.mock("../baileys/connection-status.service", () => ({ applyChannelConnectionStatus: vi.fn() }));
vi.mock("../whatsapp-conversations.service", () => ({ saveInboundMessage: vi.fn() }));
vi.mock("../whatsapp-baileys-events.service", () => ({
  handleQrcodeUpdated: vi.fn(),
  handleMessagesUpsert: vi.fn(),
  handleMessagesUpdate: vi.fn(),
  handleMessagesDelete: vi.fn(),
}));

import { prepareEvolutionMedia } from "../evolution-webhook-inbox.service";

describe("prepareEvolutionMedia", () => {
  beforeEach(() => {
    getMediaBase64Mock.mockReset();
    uploadWhatsappMediaMock.mockReset();
    getMediaBase64Mock.mockResolvedValue({ base64: "data:image/jpeg;base64,QUJD", mimetype: "image/jpeg", fileName: "foto.jpg" });
    uploadWhatsappMediaMock.mockResolvedValue("whatsapp-media/foto.jpg");
  });

  it("downloads and persists an image when the Evolution webhook has no base64", async () => {
    const message = {
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "image-1", fromMe: false },
      message: { imageMessage: { url: "https://mmg.whatsapp.net/media", mimetype: "image/jpeg" } },
    };

    const prepared = await prepareEvolutionMedia("crm-1", message);

    expect(getMediaBase64Mock).toHaveBeenCalledWith("crm-1", message);
    expect(uploadWhatsappMediaMock).toHaveBeenCalledWith(Buffer.from("ABC"), "image/jpeg");
    expect(prepared).toMatchObject({
      _baileysMedia: { storageKey: "whatsapp-media/foto.jpg", mimeType: "image/jpeg", filename: "foto.jpg", size: 3 },
      message: { imageMessage: { mimetype: "image/jpeg" } },
    });
    expect((prepared.message as Record<string, Record<string, unknown>>).imageMessage?.base64).toBeUndefined();
  });

  it("rejects a missing media response so the durable inbox retries it", async () => {
    getMediaBase64Mock.mockResolvedValue({});
    const message = {
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "audio-1", fromMe: false },
      message: { pttMessage: { mimetype: "audio/ogg" } },
    };

    await expect(prepareEvolutionMedia("crm-1", message)).rejects.toThrow("Evolution não retornou mídia");
    expect(uploadWhatsappMediaMock).not.toHaveBeenCalled();
  });
});
