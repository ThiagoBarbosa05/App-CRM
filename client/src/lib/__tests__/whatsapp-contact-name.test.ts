import { describe, expect, it } from "vitest";
import { resolveWhatsappContactName } from "../whatsapp-contact-name";

describe("resolveWhatsappContactName", () => {
  it("prioriza o cliente cadastrado sobre os nomes da conversa", () => {
    expect(resolveWhatsappContactName({
      clientName: "Cliente CRM",
      customContactName: "Apelido",
      contactName: "Nome WhatsApp",
      phone: "5511999999999",
    })).toBe("Cliente CRM");
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
