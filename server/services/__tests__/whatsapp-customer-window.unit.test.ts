import { describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: { select: vi.fn() } }));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: () => {},
  publishSseEvent: () => {},
  registerConversationAccessChecker: () => {},
  revokeStaleConversationAccess: async () => {},
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: async () => null,
  sendMedia: async () => null,
  normalizeToJid: (phone: string) => phone,
  fetchProfilePictureUrl: async () => null,
}));
vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: async () => null,
  sendTemplateMessage: async () => null,
  uploadMedia: async () => null,
  sendMediaMessage: async () => null,
  sendReaction: async () => null,
  downloadMediaToBuffer: async () => null,
  markMessageAsRead: async () => undefined,
}));
vi.mock("../whatsapp-templates.service", () => ({
  getTemplateMedia: async () => null,
  fetchMetaTemplates: async () => [],
}));
vi.mock("../whatsapp-sectors.service", () => ({ listSectorIdsForUser: async () => [] }));
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
vi.mock("../../lib/webm-opus-to-ogg", () => ({ remuxWebmOpusToOgg: (buffer: Buffer) => buffer }));

import {
  WhatsappCustomerWindowClosedError,
  assertCloudApiCustomerWindowOpen,
} from "../whatsapp-conversations.service";

describe("assertCloudApiCustomerWindowOpen", () => {
  const now = new Date("2026-08-27T15:00:00.000Z");

  it("bloqueia mensagem livre Cloud API sem mensagem inbound nas últimas 24 horas", () => {
    expect(() => assertCloudApiCustomerWindowOpen("cloud_api", null, now)).toThrow(
      WhatsappCustomerWindowClosedError,
    );
  });

  it("aceita mensagem livre Cloud API antes do fim da janela de 24 horas", () => {
    expect(() => assertCloudApiCustomerWindowOpen(
      "cloud_api",
      new Date("2026-08-26T15:00:01.000Z"),
      now,
    )).not.toThrow();
  });

  it("não aplica a janela da Cloud API aos canais Baileys", () => {
    expect(() => assertCloudApiCustomerWindowOpen("evolution", null, now)).not.toThrow();
  });
});
