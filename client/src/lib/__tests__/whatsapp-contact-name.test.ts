import { describe, expect, it } from "vitest";
import {
  canEditWhatsappContactName,
  resolveWhatsappContactName,
} from "../whatsapp-contact-name";

describe("resolveWhatsappContactName", () => {
  it("prioriza o apelido da conversa sobre o nome do cliente cadastrado", () => {
    expect(resolveWhatsappContactName({
      clientName: "Cliente CRM",
      customContactName: "Apelido",
      contactName: "Nome WhatsApp",
      phone: "5511999999999",
    })).toBe("Apelido");
  });

  it("prioriza o nome personalizado sobre o pushName do WhatsApp", () => {
    expect(resolveWhatsappContactName({
      clientName: null,
      customContactName: "Apelido",
      contactName: "Nome WhatsApp",
      phone: "5511999999999",
    })).toBe("Apelido");
  });

  it("volta ao pushName e depois ao telefone quando o personalizado é removido", () => {
    expect(resolveWhatsappContactName({
      clientName: null,
      customContactName: null,
      contactName: "Nome WhatsApp",
      phone: "5511999999999",
    })).toBe("Nome WhatsApp");
    expect(resolveWhatsappContactName({
      clientName: null,
      customContactName: null,
      contactName: null,
      phone: "5511999999999",
    })).toBe("5511999999999");
  });
});

describe("canEditWhatsappContactName", () => {
  it("permite editar contatos vinculados ou não ao CRM", () => {
    expect(canEditWhatsappContactName({ peerChannelId: null })).toBe(true);
    expect(canEditWhatsappContactName({ peerChannelId: undefined })).toBe(true);
  });

  it("impede editar o nome de conversas internas entre canais", () => {
    expect(canEditWhatsappContactName({ peerChannelId: 42 })).toBe(false);
  });
});
