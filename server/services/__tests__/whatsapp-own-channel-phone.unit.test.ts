import { describe, expect, it } from "vitest";
import { normalizePhone, isOwnChannelPhone } from "../../lib/phone";

// Reproduz o que getOwnChannelPhones() faz: para cada displayPhone cadastrado,
// guarda ambas as formas (com e sem DDI 55) no conjunto.
function buildOwnPhones(displayPhones: string[]): Set<string> {
  const set = new Set<string>();
  for (const p of displayPhones) {
    const { digits, withoutCountry } = normalizePhone(p);
    if (digits) set.add(digits);
    if (withoutCountry) set.add(withoutCountry);
  }
  return set;
}

describe("isOwnChannelPhone — colisão de número contato x canal", () => {
  it("casa quando o canal está cadastrado SEM 55 e o inbound chega COM 55", () => {
    // Cenário do bug: canal Eventos cadastrado como "21989014965" (sem DDI),
    // echo fromMe na conexão da Búzios traz o JID "5521989014965" (com DDI).
    const own = buildOwnPhones(["21989014965"]);
    expect(isOwnChannelPhone(own, "5521989014965")).toBe(true);
  });

  it("casa quando o canal está cadastrado COM 55 e o inbound chega COM 55", () => {
    // Canal Búzios "+5522996212581"; reply genuíno chega como "5522996212581".
    const own = buildOwnPhones(["+5522996212581"]);
    expect(isOwnChannelPhone(own, "5522996212581")).toBe(true);
  });

  it("casa quando o canal está cadastrado COM 55 e o inbound chega SEM 55", () => {
    const own = buildOwnPhones(["+5522996212581"]);
    expect(isOwnChannelPhone(own, "22996212581")).toBe(true);
  });

  it("não casa para um número de contato que não é canal", () => {
    const own = buildOwnPhones(["21989014965", "+5522996212581"]);
    expect(isOwnChannelPhone(own, "5511987654321")).toBe(false);
  });

  it("conjunto vazio nunca casa", () => {
    expect(isOwnChannelPhone(new Set(), "5521989014965")).toBe(false);
  });
});
