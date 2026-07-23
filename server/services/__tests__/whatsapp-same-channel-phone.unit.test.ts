import { describe, expect, it } from "vitest";
import { isSameChannelPhone } from "../../lib/phone";

describe("isSameChannelPhone — auto-echo escopado ao canal receptor", () => {
  it("casa quando o canal está cadastrado SEM 55 e o inbound chega COM 55 (auto-echo genuíno)", () => {
    // Canal Eventos cadastrado como "21989014965" (sem DDI), eco fromMe traz o
    // JID "5521989014965" (com DDI) — mesmo canal, deve ser filtrado.
    expect(isSameChannelPhone("21989014965", "5521989014965")).toBe(true);
  });

  it("casa quando o canal está cadastrado COM 55 e o inbound chega SEM 55", () => {
    expect(isSameChannelPhone("+5522996212581", "22996212581")).toBe(true);
  });

  it("casa quando ambos os lados vêm com 55", () => {
    expect(isSameChannelPhone("+5522996212581", "5522996212581")).toBe(true);
  });

  it("NÃO casa quando o remetente é um canal DIFERENTE mandando mensagem de verdade", () => {
    // Cenário legítimo: canal Eventos manda mensagem para o canal Búzios. O
    // guard do canal Búzios recebe phone = número da Eventos, que é diferente
    // do seu próprio displayPhone — não deve ser tratado como eco.
    expect(isSameChannelPhone("+5522996212581", "5521989014965")).toBe(false);
  });

  it("NÃO casa quando o remetente é um contato externo cujo número colide com OUTRO canal (bug original)", () => {
    // O guard do canal Eventos só deve comparar contra o próprio displayPhone
    // da Eventos, nunca contra o da Búzios — mesmo que o contato tenha,
    // coincidentemente, o número de outro canal cadastrado.
    expect(isSameChannelPhone("21989014965", "5522996212581")).toBe(false);
  });

  it("retorna false sem lançar erro quando o canal não tem displayPhone cadastrado", () => {
    expect(isSameChannelPhone(null, "5521989014965")).toBe(false);
    expect(isSameChannelPhone(undefined, "5521989014965")).toBe(false);
    expect(isSameChannelPhone("", "5521989014965")).toBe(false);
  });
});
