import { describe, expect, it } from "vitest";

import {
  extractApiMessage,
  extractApiFieldErrors,
  extractApiStatus,
  getClientErrorMessage,
} from "../api-error";

describe("extractApiMessage", () => {
  it("extrai o message do corpo JSON que apiRequest gruda no status", () => {
    const error = new Error('400: {"message":"Selecione uma unidade PDV para continuar."}');

    expect(extractApiMessage(error)).toBe("Selecione uma unidade PDV para continuar.");
  });

  it("mantém o texto cru quando a resposta não é JSON", () => {
    const error = new Error("502: Bad Gateway");

    expect(extractApiMessage(error)).toBe("Bad Gateway");
  });

  it("usa o fallback para erro sem mensagem", () => {
    expect(extractApiMessage(new Error(""), "Falhou")).toBe("Falhou");
  });

  it("usa o fallback para o que não é Error", () => {
    expect(extractApiMessage("qualquer coisa", "Falhou")).toBe("Falhou");
  });

  it("lida com JSON sem o campo message", () => {
    const error = new Error('500: {"code":"BOOM"}');

    expect(extractApiMessage(error)).toBe('{"code":"BOOM"}');
  });

  it("preserva mensagem de erro de rede, que não tem prefixo de status", () => {
    const error = new Error("Failed to fetch");

    expect(extractApiMessage(error)).toBe("Failed to fetch");
  });
});

describe("extractApiStatus", () => {
  it("lê o status que apiRequest prefixa na mensagem", () => {
    expect(extractApiStatus(new Error('409: {"message":"Duplicado"}'))).toBe(409);
  });

  it("devolve null para erro de rede, que não tem status", () => {
    expect(extractApiStatus(new Error("Failed to fetch"))).toBeNull();
    expect(extractApiStatus("qualquer coisa")).toBeNull();
  });
});

describe("extractApiFieldErrors", () => {
  it("extrai as falhas por campo do corpo de validação", () => {
    const error = new Error(
      '400: {"message":"Categoria é obrigatória.","errors":[{"field":"categoria","message":"Categoria é obrigatória."}]}',
    );

    expect(extractApiFieldErrors(error)).toEqual([
      { field: "categoria", message: "Categoria é obrigatória." },
    ]);
  });

  it("ignora entradas malformadas em vez de quebrar o formulário", () => {
    const error = new Error(
      '400: {"errors":[{"field":"cpf","message":"Inválido"},{"field":123},"lixo",null]}',
    );

    expect(extractApiFieldErrors(error)).toEqual([
      { field: "cpf", message: "Inválido" },
    ]);
  });

  it("devolve lista vazia quando não há errors[]", () => {
    expect(extractApiFieldErrors(new Error('409: {"message":"Duplicado"}'))).toEqual([]);
    expect(extractApiFieldErrors(new Error("Failed to fetch"))).toEqual([]);
  });
});

describe("getClientErrorMessage", () => {
  it("usa a mensagem do servidor quando ela existe", () => {
    const error = new Error(
      '409: {"message":"Este CPF/CNPJ já está cadastrado para o cliente \\"João Silva\\"."}',
    );

    expect(getClientErrorMessage(error)).toBe(
      'Este CPF/CNPJ já está cadastrado para o cliente "João Silva".',
    );
  });

  it("nunca devolve o corpo cru quando não há message — usa o status", () => {
    const message = getClientErrorMessage(new Error('500: {"code":"BOOM"}'));

    expect(message).not.toContain("BOOM");
    expect(message).toBe(
      "O servidor não conseguiu concluir a operação. Tente novamente em instantes.",
    );
  });

  it("não mostra 'Bad Gateway' ao usuário", () => {
    const message = getClientErrorMessage(new Error("502: Bad Gateway"));

    expect(message).not.toContain("Bad Gateway");
  });

  it("explica sessão expirada no 401", () => {
    // `throwIfResNotOk` lança "401: Sessão expirada" — texto puro, não JSON.
    expect(getClientErrorMessage(new Error("401: Sessão expirada"))).toContain(
      "sessão expirou",
    );
  });

  it("explica falta de permissão no 403", () => {
    expect(getClientErrorMessage(new Error("403: "))).toContain("permissão");
  });

  it("trata erro de rede, que não tem status nem corpo", () => {
    expect(getClientErrorMessage(new Error("Failed to fetch"))).toBe(
      "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    );
  });
});
