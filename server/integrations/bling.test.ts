import assert from "node:assert/strict";
import test from "node:test";

import {
  createBlingContato,
  getBlingContatos,
  updateBlingContato,
} from "./bling";

test("createBlingContato normalizes payload and returns created id", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    return new Response(JSON.stringify({ data: { id: 12345678 } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await createBlingContato("token", {
      nome: "  Contato  ",
      tipo: "J",
      telefone: "  (54) 3333-4444  ",
      email: "   ",
      endereco: {
        geral: {
          endereco: "  Rua A  ",
          numero: "  10 ",
          complemento: "   ",
        },
        cobranca: {},
      },
    });

    assert.deepEqual(result, { id: 12345678 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://www.bling.com.br/Api/v3/contatos");
    assert.equal(calls[0]?.init?.method, "POST");

    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer token");
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get("Accept"), "application/json");

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;

    assert.deepEqual(body, {
      nome: "Contato",
      situacao: "A",
      tipo: "J",
      telefone: "(54) 3333-4444",
      endereco: {
        geral: {
          endereco: "Rua A",
          numero: "10",
        },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateBlingContato sends PUT with normalized payload and succeeds on 204", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    return new Response(null, {
      status: 204,
    });
  };

  try {
    await updateBlingContato("token", 987654, {
      nome: "  Contato Atualizado  ",
      tipo: "F",
      situacao: "A",
      emailNotaFiscal: "  fiscal@email.com  ",
      endereco: {
        geral: {
          endereco: "  Rua B  ",
          numero: "  20  ",
        },
        cobranca: {
          complemento: "   ",
        },
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://www.bling.com.br/Api/v3/contatos/987654");
    assert.equal(calls[0]?.init?.method, "PUT");

    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer token");
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get("Accept"), "application/json");

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;

    assert.deepEqual(body, {
      nome: "Contato Atualizado",
      tipo: "F",
      situacao: "A",
      emailNotaFiscal: "fiscal@email.com",
      endereco: {
        geral: {
          endereco: "Rua B",
          numero: "20",
        },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getBlingContatos normalizes query params and returns contact summaries", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    return new Response(
      JSON.stringify({
        data: [
          {
            id: 12345678,
            nome: "Contato",
            codigo: "ASD001",
            situacao: "A",
            numeroDocumento: "123.456.789-10",
            telefone: "(51) 99999-9999",
            celular: "(51) 99999-9999",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const result = await getBlingContatos("token", {
      telefone: "51999999999",
      numeroDocumento: "123.456.789-10",
    });

    assert.deepEqual(result, [
      {
        id: 12345678,
        nome: "Contato",
        codigo: "ASD001",
        situacao: "A",
        numeroDocumento: "123.456.789-10",
        telefone: "(51) 99999-9999",
        celular: "(51) 99999-9999",
      },
    ]);

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://www.bling.com.br/Api/v3/contatos?telefone=%2851%29+99999-9999&numeroDocumento=12345678910",
    );
    assert.equal(calls[0]?.init?.method, "GET");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
