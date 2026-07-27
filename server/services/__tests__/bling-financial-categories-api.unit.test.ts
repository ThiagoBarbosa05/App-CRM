import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBlingFinancialCategory,
  getBlingFinancialCategories,
} from "../../integrations/bling";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Bling financial categories API", () => {
  it("lista despesas ativas e inativas com paginação", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 1,
              idCategoriaPai: 0,
              descricao: "Despesas",
              tipo: 1,
            },
            {
              id: 2,
              idCategoriaPai: 0,
              descricao: "Receitas",
              tipo: 2,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBlingFinancialCategories("token", 3, 100);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(requestedUrl.pathname).toBe(
      "/Api/v3/categorias/receitas-despesas",
    );
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      pagina: "3",
      limite: "100",
      tipo: "1",
      situacao: "0",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.descricao).toBe("Despesas");
  });

  it("envia o payload financeiro completo na criação", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: 987 } }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createBlingFinancialCategory("token", {
      grupoDRE: 1,
      idCategoriaPai: 123,
      descricao: "1.3.1 Queijos",
      tipo: 1,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      grupoDRE: 1,
      idCategoriaPai: 123,
      descricao: "1.3.1 Queijos",
      tipo: 1,
    });
    expect(result.id).toBe(987);
  });

  it("renova o token após erro de autenticação", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const refresh = vi.fn().mockResolvedValue("token-renovado");

    await getBlingFinancialCategories("token-antigo", 1, 100, refresh);

    expect(refresh).toHaveBeenCalledOnce();
    const secondHeaders = new Headers(
      (fetchMock.mock.calls[1]?.[1] as RequestInit).headers,
    );
    expect(secondHeaders.get("Authorization")).toBe("Bearer token-renovado");
  });

  it("repete a chamada quando o Bling responde com rate limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: { "Retry-After": "0" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getBlingFinancialCategories("token", 1, 100);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
