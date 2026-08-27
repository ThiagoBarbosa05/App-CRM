import { describe, expect, it } from "vitest";
import {
  resolveWhatsappContactPhotoUrl,
  shouldFetchWhatsappContactPhoto,
} from "@shared/whatsapp-contact-photo";

describe("resolveWhatsappContactPhotoUrl", () => {
  it("mantém a foto do WhatsApp quando a conversa está vinculada a um cliente", () => {
    expect(
      resolveWhatsappContactPhotoUrl({
        clientId: "client-1",
        contactPhotoUrl: "https://cdn.example.com/avatar.jpg",
      }),
    ).toBe("https://cdn.example.com/avatar.jpg");
  });
});

describe("shouldFetchWhatsappContactPhoto", () => {
  it("busca a foto ausente de uma conversa antiga vinculada a cliente", () => {
    expect(
      shouldFetchWhatsappContactPhoto({
        direction: "inbound",
        instanceName: "canal-vendas",
        peerChannelId: null,
        contactPhotoUrl: null,
      }),
    ).toBe(true);
  });

  it("não busca foto para diálogos internos entre canais", () => {
    expect(
      shouldFetchWhatsappContactPhoto({
        direction: "inbound",
        instanceName: "canal-vendas",
        peerChannelId: 12,
        contactPhotoUrl: null,
      }),
    ).toBe(false);
  });
});
