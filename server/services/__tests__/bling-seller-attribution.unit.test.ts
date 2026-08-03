import { describe, expect, it } from "vitest";

import {
  getCanonicalBlingClientKey,
  getCanonicalBlingSellerKey,
  resolveBlingSellerUserId,
  type BlingSellerMappingIdentity,
} from "../bling-seller-attribution";

const mappings: BlingSellerMappingIdentity[] = [
  { connectionId: "conta-a", blingVendedorId: "10", userId: "vendedor-1" },
  { connectionId: "conta-b", blingVendedorId: "77", userId: "vendedor-1" },
  { connectionId: "conta-b", blingVendedorId: "10", userId: "vendedor-2" },
];

describe("atribuição de vendedor Bling multi-conta", () => {
  it("atribui códigos diferentes de duas contas ao mesmo usuário", () => {
    expect(
      resolveBlingSellerUserId(
        { connectionId: "conta-a", sellerId: "10" },
        mappings,
        [],
      ),
    ).toBe("vendedor-1");
    expect(
      resolveBlingSellerUserId(
        { connectionId: "conta-b", sellerId: "77" },
        mappings,
        [],
      ),
    ).toBe("vendedor-1");
  });

  it("não cruza vendedores com o mesmo código em contas diferentes", () => {
    expect(
      resolveBlingSellerUserId(
        { connectionId: "conta-b", sellerId: "10" },
        mappings,
        [],
      ),
    ).toBe("vendedor-2");
  });

  it("não aplica o campo legado a um pedido moderno sem mapeamento", () => {
    expect(
      resolveBlingSellerUserId(
        { connectionId: "conta-c", sellerId: "10" },
        mappings,
        [{ userId: "vendedor-1", blingVendedorId: "10" }],
      ),
    ).toBeNull();
  });

  it("mantém compatibilidade legada quando o pedido não possui conexão", () => {
    expect(
      resolveBlingSellerUserId(
        { connectionId: null, sellerId: "10" },
        mappings,
        [{ userId: "vendedor-legado", blingVendedorId: "10" }],
      ),
    ).toBe("vendedor-legado");
  });

  it("mantém vendedores não mapeados separados por conta", () => {
    expect(
      getCanonicalBlingSellerKey(
        { connectionId: "conta-a", sellerId: "99" },
        null,
      ),
    ).not.toBe(
      getCanonicalBlingSellerKey(
        { connectionId: "conta-b", sellerId: "99" },
        null,
      ),
    );
  });

  it("separa contatos Bling iguais entre contas e unifica clientes do CRM", () => {
    expect(
      getCanonicalBlingClientKey({
        connectionId: "conta-a",
        contactId: "55",
        appClientId: null,
      }),
    ).not.toBe(
      getCanonicalBlingClientKey({
        connectionId: "conta-b",
        contactId: "55",
        appClientId: null,
      }),
    );

    expect(
      getCanonicalBlingClientKey({
        connectionId: "conta-a",
        contactId: "55",
        appClientId: "cliente-1",
      }),
    ).toBe(
      getCanonicalBlingClientKey({
        connectionId: "conta-b",
        contactId: "88",
        appClientId: "cliente-1",
      }),
    );
  });
});
