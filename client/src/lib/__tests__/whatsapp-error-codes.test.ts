import { describe, expect, it } from "vitest";
import {
  WHATSAPP_ERRORS,
  decodeCampaignMessageError,
  encodeCampaignMessageError,
  isWhatsappErrorCode,
  whatsappErrorInfo,
  type WhatsappErrorCode,
} from "@shared/whatsapp-error-codes";

describe("WHATSAPP_ERRORS", () => {
  it("toda entrada tem mensagem, status e escopo utilizáveis", () => {
    for (const [code, info] of Object.entries(WHATSAPP_ERRORS)) {
      expect(info.message.trim(), code).not.toBe("");
      expect(info.httpStatus, code).toBeGreaterThanOrEqual(400);
      expect(info.scope, code).toBeTruthy();
    }
  });

  it("nenhuma mensagem vaza jargão técnico para o usuário", () => {
    for (const [code, info] of Object.entries(WHATSAPP_ERRORS)) {
      expect(info.message, code).not.toMatch(/undefined|null|Error:|\{|\}/);
    }
  });
});

describe("isWhatsappErrorCode / whatsappErrorInfo", () => {
  it("aceita código conhecido", () => {
    expect(isWhatsappErrorCode("CHANNEL_DISCONNECTED")).toBe(true);
    expect(whatsappErrorInfo("CHANNEL_DISCONNECTED")).toBe(
      WHATSAPP_ERRORS.CHANNEL_DISCONNECTED,
    );
  });

  it("rejeita qualquer outra coisa sem lançar", () => {
    for (const value of ["NAO_EXISTE", "", null, undefined, 42, {}]) {
      expect(isWhatsappErrorCode(value)).toBe(false);
      expect(whatsappErrorInfo(value)).toBeNull();
    }
  });
});

describe("encode/decodeCampaignMessageError", () => {
  it("faz round-trip preservando código, tentativas e detalhe", () => {
    const raw = encodeCampaignMessageError({
      code: "SEND_RATE_LIMITED",
      attempt: 2,
      maxAttempts: 5,
      detail: '{"error":{"code":131048}}',
    });

    const decoded = decodeCampaignMessageError(raw);
    expect(decoded.info).toBe(WHATSAPP_ERRORS.SEND_RATE_LIMITED);
    expect(decoded.attempt).toBe(2);
    expect(decoded.maxAttempts).toBe(5);
    expect(decoded.detail).toBe('{"error":{"code":131048}}');
  });

  it("linha legada em texto puro vira detalhe, sem código", () => {
    const decoded = decodeCampaignMessageError("Telefone inválido");
    expect(decoded.info).toBeNull();
    expect(decoded.detail).toBe("Telefone inválido");
  });

  it("JSON cru do provedor (sem envelope) continua sendo tratado como legado", () => {
    const metaBody = '{"error":{"message":"Invalid parameter","code":100}}';
    const decoded = decodeCampaignMessageError(metaBody);
    expect(decoded.info).toBeNull();
    expect(decoded.detail).toBe(metaBody);
  });

  it("envelope com código desconhecido não é interpretado", () => {
    const decoded = decodeCampaignMessageError('{"__waerr":1,"code":"XPTO"}');
    expect(decoded.info).toBeNull();
    expect(decoded.detail).toContain("XPTO");
  });

  it("nunca lança para entrada vazia ou malformada", () => {
    for (const value of [null, undefined, "", "   ", "{não é json"]) {
      expect(() => decodeCampaignMessageError(value)).not.toThrow();
    }
    expect(decodeCampaignMessageError(null).info).toBeNull();
    expect(decodeCampaignMessageError("   ").detail).toBeNull();
  });

  it("todo código do vocabulário sobrevive ao round-trip", () => {
    for (const code of Object.keys(WHATSAPP_ERRORS) as WhatsappErrorCode[]) {
      const decoded = decodeCampaignMessageError(
        encodeCampaignMessageError({ code }),
      );
      expect(decoded.info, code).toBe(WHATSAPP_ERRORS[code]);
    }
  });
});
