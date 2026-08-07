import { describe, expect, it } from "vitest";
import { WHATSAPP_ERRORS } from "@shared/whatsapp-error-codes";
import {
  extractApiErrorCode,
  getWhatsappErrorPresentation,
} from "../api-error";

/** Formato que `throwIfResNotOk` produz: `"<status>: <corpo cru>"`. */
function apiError(status: number, body: unknown): Error {
  return new Error(`${status}: ${JSON.stringify(body)}`);
}

describe("extractApiErrorCode", () => {
  it("lê o code do corpo", () => {
    expect(
      extractApiErrorCode(
        apiError(400, { message: "x", code: "CHANNEL_DISCONNECTED" }),
      ),
    ).toBe("CHANNEL_DISCONNECTED");
  });

  it("retorna null quando o corpo não tem code", () => {
    expect(extractApiErrorCode(apiError(500, { message: "x" }))).toBeNull();
    expect(extractApiErrorCode(new Error("falha de rede"))).toBeNull();
  });
});

describe("getWhatsappErrorPresentation", () => {
  it("usa o hint da tabela quando o servidor manda só o código", () => {
    const { title, description } = getWhatsappErrorPresentation(
      apiError(400, {
        message: WHATSAPP_ERRORS.CHANNEL_DISCONNECTED.message,
        code: "CHANNEL_DISCONNECTED",
      }),
    );

    expect(title).toBe(WHATSAPP_ERRORS.CHANNEL_DISCONNECTED.message);
    expect(description).toBe(WHATSAPP_ERRORS.CHANNEL_DISCONNECTED.hint);
  });

  it("preserva a mensagem específica do servidor sobre o texto da tabela", () => {
    const { title, description } = getWhatsappErrorPresentation(
      apiError(400, {
        message: 'O nó "Boas-vindas" não tem saída definida.',
        code: "BOT_FLOW_INVALID",
      }),
    );

    expect(title).toBe('O nó "Boas-vindas" não tem saída definida.');
    expect(description).toBe(WHATSAPP_ERRORS.BOT_FLOW_INVALID.hint);
  });

  it("hint do servidor ganha do hint da tabela", () => {
    const { description } = getWhatsappErrorPresentation(
      apiError(409, {
        message: "Conflito com o bot “Pós-venda”.",
        code: "BOT_AUTOMATIC_CONFLICT",
        hint: "Desative o bot “Pós-venda” antes de ativar este.",
      }),
    );

    expect(description).toBe("Desative o bot “Pós-venda” antes de ativar este.");
  });

  it("sem code, cai na mensagem do servidor", () => {
    const { title, description } = getWhatsappErrorPresentation(
      apiError(400, { message: "Parâmetros inválidos" }),
    );

    expect(title).toBe("Parâmetros inválidos");
    expect(description).toBeUndefined();
  });

  it("código desconhecido não engole a mensagem do servidor", () => {
    const { title } = getWhatsappErrorPresentation(
      apiError(400, { message: "Algo específico", code: "NAO_MAPEADO" }),
    );

    expect(title).toBe("Algo específico");
  });

  it("sem code e sem message, cai no status HTTP — nunca mostra JSON cru", () => {
    const { title } = getWhatsappErrorPresentation(
      new Error("502: <html>Bad Gateway</html>"),
    );

    expect(title).not.toContain("<html>");
    expect(title).toContain("servidor");
  });

  it("erro de rede vira frase de conexão", () => {
    const { title } = getWhatsappErrorPresentation(new Error("Failed to fetch"));
    expect(title).toContain("conexão");
  });
});
