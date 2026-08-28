import { describe, expect, it } from "vitest";
import {
  getWhatsappConversationCapabilities,
  validateWhatsappMediaForProvider,
} from "@shared/whatsapp-conversation-capabilities";

describe("getWhatsappConversationCapabilities", () => {
  it("não anuncia recursos para um canal Evolution desconectado", () => {
    expect(getWhatsappConversationCapabilities({
      provider: "evolution",
      configured: true,
      connected: false,
    })).toMatchObject({
      reply: false,
      reaction: false,
      sticker: false,
      forward: false,
      unavailableReason: "Canal desconectado",
    });
  });

  it("expõe explicitamente os recursos implementados pelo Cloud API", () => {
    expect(getWhatsappConversationCapabilities({
      provider: "cloud_api",
      configured: true,
      connected: true,
    })).toMatchObject({
      reply: true,
      reaction: true,
      sticker: true,
      forward: true,
      unavailableReason: null,
    });
  });

  it("diferencia mensagens ricas e recursos remotos entre Cloud API e Baileys", () => {
    const cloudApi = getWhatsappConversationCapabilities({
      provider: "cloud_api",
      configured: true,
      connected: true,
    });
    const baileys = getWhatsappConversationCapabilities({
      provider: "evolution",
      configured: true,
      connected: true,
    });

    expect(cloudApi.send).toMatchObject({
      location: true,
      contacts: true,
      poll: false,
      deleted: false,
      interactive: false,
    });
    expect(cloudApi).toMatchObject({
      remoteRead: true,
      presence: false,
      edit: false,
      delete: false,
      historySync: false,
    });
    expect(baileys.send).toMatchObject({
      location: true,
      contacts: true,
      poll: true,
      deleted: false,
      interactive: false,
    });
    expect(baileys).toMatchObject({
      remoteRead: true,
      presence: true,
      edit: false,
      delete: false,
      historySync: true,
    });
    expect(baileys.receive.poll).toBe(true);
  });

  it("desabilita capacidades detalhadas quando o canal não está disponível", () => {
    const capabilities = getWhatsappConversationCapabilities({
      provider: "evolution",
      configured: true,
      connected: false,
    });

    expect(capabilities.send.location).toBe(false);
    expect(capabilities.receive.contacts).toBe(false);
    expect(capabilities.remoteRead).toBe(false);
    expect(capabilities.presence).toBe(false);
    expect(capabilities.historySync).toBe(false);
  });
});

describe("validateWhatsappMediaForProvider", () => {
  it("rejeita figurinha acima do limite antes de chamar o provedor", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "cloud_api",
      mimeType: "image/webp",
      size: 500 * 1024 + 1,
      sticker: { animated: true, width: 512, height: 512 },
    })).toEqual({
      supported: false,
      mediaType: "sticker",
      reason: "Figurinhas devem ter no máximo 500 KB",
    });
  });

  it("rejeita MIME que o provedor não aceita", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "evolution",
      mimeType: "image/gif",
      size: 1024,
    })).toEqual({
      supported: false,
      mediaType: null,
      reason: "Tipo de arquivo não suportado: image/gif",
    });
  });

  it("aplica o limite de figurinha do provedor Evolution", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "evolution",
      mimeType: "image/webp",
      size: 700 * 1024,
      sticker: { animated: true, width: 512, height: 512 },
    })).toEqual({ supported: true, mediaType: "sticker", reason: null });
  });

  it("aplica o limite menor para figurinha estática na Cloud API", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "cloud_api",
      mimeType: "image/webp",
      size: 100 * 1024 + 1,
      sticker: { animated: false, width: 512, height: 512 },
    })).toEqual({
      supported: false,
      mediaType: "sticker",
      reason: "Figurinhas devem ter no máximo 100 KB",
    });
  });

  it("aceita figurinha animada 512 × 512 dentro de 500 KB na Cloud API", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "cloud_api",
      mimeType: "image/webp",
      size: 500 * 1024,
      sticker: { animated: true, width: 512, height: 512 },
    })).toEqual({ supported: true, mediaType: "sticker", reason: null });
  });

  it("rejeita figurinha com dimensões diferentes de 512 × 512", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "cloud_api",
      mimeType: "image/webp",
      size: 10 * 1024,
      sticker: { animated: true, width: 256, height: 512 },
    })).toEqual({
      supported: false,
      mediaType: "sticker",
      reason: "Figurinhas devem ter exatamente 512 × 512 pixels",
    });
  });

  it("aceita documento compatível dentro do limite da aplicação", () => {
    expect(validateWhatsappMediaForProvider({
      provider: "cloud_api",
      mimeType: "application/pdf",
      size: 2 * 1024 * 1024,
    })).toEqual({ supported: true, mediaType: "document", reason: null });
  });
});
