import { describe, expect, it } from "vitest";
import { canonicalLocalPhone, phoneNormSql } from "../../lib/phone";
import { normalizePhoneE164 } from "@shared/phone";

/**
 * Testa `server/lib/phone.ts`. Mora em `server/services/__tests__/` porque é o
 * único glob do projeto "unit" que cobre o backend — ver vitest.config.ts.
 *
 * O que está em jogo: `canonicalLocalPhone` é a chave de agrupamento da tela de
 * duplicatas. Enquanto ela só removia o DDI, `3199910141` e `31999910141`
 * apareciam como clientes diferentes — o par que a tela existe para mostrar.
 */

describe("canonicalLocalPhone", () => {
  it("colapsa as formas que as origens gravavam no mesmo valor", () => {
    const esperado = "31999910141";
    expect(canonicalLocalPhone("+5531999910141")).toBe(esperado);
    expect(canonicalLocalPhone("5531999910141")).toBe(esperado);
    expect(canonicalLocalPhone("31999910141")).toBe(esperado);
    expect(canonicalLocalPhone("(31) 99991-0141")).toBe(esperado);
    // Formato antigo, sem o 9º dígito — o caso que a versão anterior perdia.
    expect(canonicalLocalPhone("3199910141")).toBe(esperado);
    expect(canonicalLocalPhone("031999910141")).toBe(esperado);
  });

  it("não insere o 9º dígito em telefone fixo", () => {
    expect(canonicalLocalPhone("(31) 3333-4444")).toBe("3133334444");
  });

  it("não remove o 55 quando ele é o próprio DDD", () => {
    // DDD 55 (Santa Maria/RS) + celular de 9 dígitos = 11 dígitos: o `^55` só
    // cai quando restam 10+ dígitos depois dele.
    expect(canonicalLocalPhone("55999887766")).toBe("55999887766");
  });

  it("é idempotente", () => {
    const uma = canonicalLocalPhone("+5531999910141");
    expect(canonicalLocalPhone(uma)).toBe(uma);
  });

  it("preserva os dígitos de um número não reconhecível, sem quebrar", () => {
    expect(canonicalLocalPhone("abc")).toBe("");
    expect(canonicalLocalPhone("+1 202 555")).toBe("1202555");
  });

  it("concorda com normalizePhoneE164 em todo número BR válido", () => {
    // Invariante que mantém a tela de duplicatas alinhada com o formato que as
    // origens gravam (`toStoredPhone`, que é E.164).
    const entradas = [
      "31999910141",
      "3199910141",
      "+55 (31) 99991-0141",
      "5531999910141",
      "2133334444",
      "21975865422",
    ];
    for (const entrada of entradas) {
      const e164 = normalizePhoneE164(entrada);
      expect(e164).not.toBeNull();
      expect(canonicalLocalPhone(entrada)).toBe(e164!.slice("+55".length));
    }
  });
});

describe("phoneNormSql", () => {
  it("referencia a coluna uma única vez", () => {
    // Aninhar CASE repetiria a expressão do passo anterior em cada ramo, e o
    // custo explodiria no GROUP BY sobre toda a tabela `clients`.
    const gerado = phoneNormSql("c.phone");
    expect(gerado.match(/c\.phone/g)).toHaveLength(1);
  });

  it("aplica os mesmos quatro passos de canonicalLocalPhone", () => {
    const gerado = phoneNormSql("c.phone");
    expect(gerado).toContain("'[^0-9]', '', 'g'"); // 1. só dígitos
    expect(gerado).toContain("'^55(?=[0-9]{10,}$)', ''"); // 2. DDI
    expect(gerado).toContain("'^0', ''"); // 3. zero inicial
    expect(gerado).toContain("'^([0-9]{2})([6-9][0-9]{7})$', '\\19\\2'"); // 4. 9º dígito
  });

  it("trata coluna nula como string vazia", () => {
    expect(phoneNormSql("c.phone")).toContain("COALESCE(c.phone, '')");
  });
});
