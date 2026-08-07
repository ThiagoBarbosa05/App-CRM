import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  clientIdentityConditions,
  clientIdentityOrderBy,
  cpfMatchCondition,
  emailMatchCondition,
  phoneMatchConditions,
  toComparableCpf,
  toDigits,
  toStoredPhone,
} from "../client-lookup";
import { phoneVariants } from "../../lib/phone";

/**
 * O bug que originou este helper: o mesmo cliente entrava duas vezes porque o
 * Bling gravava "21975865422" e o cadastro manual "+5521975865422". Como o
 * UNIQUE de `clients.phone` é sobre o texto cru, ele não reconhecia as duas
 * linhas como o mesmo número.
 */

describe("toStoredPhone — formato único de gravação", () => {
  it("converte para E.164 as três formas que as origens gravavam", () => {
    expect(toStoredPhone("21975865422")).toBe("+5521975865422");
    expect(toStoredPhone("5521975865422")).toBe("+5521975865422");
    expect(toStoredPhone("+55 (21) 97586-5422")).toBe("+5521975865422");
  });

  it("insere o 9º dígito de celular no formato antigo", () => {
    expect(toStoredPhone("2175865422")).toBe("+5521975865422");
  });

  it("não insere o 9 em telefone fixo", () => {
    expect(toStoredPhone("2133334444")).toBe("+552133334444");
  });

  it("preserva os dígitos quando o número não é BR reconhecível", () => {
    expect(toStoredPhone("+1 202 555")).toBe("1202555");
  });

  it("retorna null quando não há dígito nenhum", () => {
    expect(toStoredPhone(null)).toBeNull();
    expect(toStoredPhone("")).toBeNull();
    expect(toStoredPhone("   ")).toBeNull();
    expect(toStoredPhone("sem número")).toBeNull();
  });
});

describe("toStoredPhone — idempotência", () => {
  it("reaplicar sobre o próprio resultado não muda nada", () => {
    const once = toStoredPhone("21975865422");
    expect(toStoredPhone(once)).toBe(once);
  });
});

describe("phoneMatchConditions", () => {
  it("gera condições para phone e fixedPhone", () => {
    expect(phoneMatchConditions("21975865422")).toHaveLength(2);
  });

  it("não gera condição quando não há telefone", () => {
    expect(phoneMatchConditions(null)).toEqual([]);
    expect(phoneMatchConditions("")).toEqual([]);
    expect(phoneMatchConditions("abc")).toEqual([]);
  });

  it("as variantes comparadas cobrem os dois formatos da duplicata real", () => {
    // Um lado busca; o outro está gravado no formato da outra origem. Os dois
    // precisam cair no mesmo conjunto de dígitos comparáveis.
    const buscandoPeloBling = new Set(phoneVariants("21975865422"));
    expect(buscandoPeloBling.has("5521975865422")).toBe(true);

    const buscandoPeloManual = new Set(phoneVariants("+5521975865422"));
    expect(buscandoPeloManual.has("21975865422")).toBe(true);
  });
});

describe("toComparableCpf", () => {
  it("aceita CPF com e sem formatação", () => {
    expect(toComparableCpf("127.022.387-93")).toBe("12702238793");
    expect(toComparableCpf("12702238793")).toBe("12702238793");
  });

  it("rejeita CPF com dígitos repetidos", () => {
    expect(toComparableCpf("00000000000")).toBeNull();
    expect(toComparableCpf("111.111.111-11")).toBeNull();
  });

  it("rejeita comprimento diferente de 11 (inclusive CNPJ)", () => {
    expect(toComparableCpf("1270223879")).toBeNull();
    expect(toComparableCpf("12345678000199")).toBeNull();
    expect(toComparableCpf(null)).toBeNull();
  });
});

describe("cpfMatchCondition", () => {
  it("gera condição para CPF válido", () => {
    expect(cpfMatchCondition("127.022.387-93")).not.toBeNull();
  });

  it("não gera condição para CPF inválido", () => {
    expect(cpfMatchCondition("00000000000")).toBeNull();
    expect(cpfMatchCondition(null)).toBeNull();
  });
});

describe("toDigits", () => {
  it("mantém só dígitos e devolve null quando não sobra nada", () => {
    expect(toDigits("(21) 97586-5422")).toBe("21975865422");
    expect(toDigits("abc")).toBeNull();
    expect(toDigits(null)).toBeNull();
  });
});

describe("clientIdentityConditions", () => {
  it("combina CPF e os dois telefones", () => {
    // 1 (CPF) + 2 (celular) + 2 (fixo) = 5
    expect(
      clientIdentityConditions({
        cpf: "127.022.387-93",
        phones: ["21975865422", "2133334444"],
      }),
    ).toHaveLength(5);
  });

  it("não repete o mesmo telefone informado em celular e fixo", () => {
    expect(
      clientIdentityConditions({
        cpf: null,
        phones: ["21975865422", "21975865422"],
      }),
    ).toHaveLength(2);
  });

  it("ignora telefones vazios", () => {
    expect(
      clientIdentityConditions({ cpf: null, phones: [null, "", undefined] }),
    ).toEqual([]);
  });

  it("retorna vazio sem nenhum dado — o chamador não deve buscar às cegas", () => {
    expect(clientIdentityConditions({})).toEqual([]);
  });

  it("inclui o e-mail como chave", () => {
    // 1 (CPF) + 2 (telefone) + 1 (e-mail) = 4
    expect(
      clientIdentityConditions({
        cpf: "127.022.387-93",
        phones: ["21975865422"],
        email: "fulano@mail.com",
      }),
    ).toHaveLength(4);
  });

  it("busca só por e-mail quando é o único dado", () => {
    expect(clientIdentityConditions({ email: "fulano@mail.com" })).toHaveLength(1);
  });
});

describe("emailMatchCondition", () => {
  it("gera condição para e-mail preenchido", () => {
    expect(emailMatchCondition("Fulano@Mail.com")).not.toBeNull();
  });

  it("não gera condição para e-mail ausente ou em branco", () => {
    expect(emailMatchCondition(null)).toBeNull();
    expect(emailMatchCondition("")).toBeNull();
    expect(emailMatchCondition("   ")).toBeNull();
  });
});

describe("clientIdentityOrderBy", () => {
  /**
   * Sem ordenação, `or(...) + limit(1)` devolve uma linha arbitrária quando o
   * CPF casa num cliente e o telefone casa noutro — e o mesmo contato do Bling
   * podia alternar entre os dois a cada pedido.
   */
  it("gera o CASE de prioridade mais o desempate por data", () => {
    expect(
      clientIdentityOrderBy({
        cpf: "127.022.387-93",
        phones: ["21975865422"],
        email: "fulano@mail.com",
      }),
    ).toHaveLength(2);
  });

  it("ordena por CPF, depois telefone, depois e-mail", () => {
    const [caseExpr] = clientIdentityOrderBy({
      cpf: "127.022.387-93",
      phones: ["21975865422"],
      email: "fulano@mail.com",
    });
    const { sql: compiled } = new PgDialect().sqlToQuery(caseExpr);

    // Os ranks precisam sair como SQL literal, não como parâmetro ligado: o
    // Postgres não infere o tipo de um `$n` no THEN dentro de um ORDER BY.
    expect(compiled).toMatch(/"cpf"[\s\S]*THEN 0/);
    expect(compiled).toMatch(/"phone"[\s\S]*THEN 1/);
    expect(compiled).toMatch(/"email"[\s\S]*THEN 2/);
    expect(compiled).toContain("ELSE 3 END");
  });

  it("sem nenhum dado, cai só no desempate por data", () => {
    expect(clientIdentityOrderBy({})).toHaveLength(1);
  });
});
