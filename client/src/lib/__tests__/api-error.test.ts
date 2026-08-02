import { describe, expect, it } from "vitest";

import { extractApiMessage } from "../api-error";

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
