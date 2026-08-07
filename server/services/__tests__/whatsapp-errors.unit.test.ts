import { describe, expect, it, vi } from "vitest";
import { WhatsAppApiError } from "server/integrations/whatsapp";
import { BaileysGatewayError } from "server/integrations/baileys-gateway";
import {
  classifyDispatchFailure,
  describeSendError,
  toWhatsappErrorResponse,
  respondWhatsappError,
  waError,
} from "../whatsapp-errors";
import {
  CampaignConfigError,
  CampaignRequeueBlockedError,
} from "../whatsapp-campaign-errors";
import { BotFlowValidationError } from "../whatsapp-bot.service";
import { BotCompatibilityLookupError } from "../whatsapp-bot-compatibility.service";

describe("describeSendError", () => {
  it("mapeia cada código do gateway Baileys para um código de apresentação", () => {
    const cases = [
      ["channel_offline", "SEND_CHANNEL_OFFLINE"],
      ["rate_limited", "SEND_RATE_LIMITED"],
      ["overloaded", "SEND_PROVIDER_UNAVAILABLE"],
      ["unavailable", "SEND_PROVIDER_UNAVAILABLE"],
      ["not_configured", "SEND_CREDENTIALS_MISSING"],
      ["unauthorized", "SEND_CREDENTIALS_MISSING"],
      ["payload_too_large", "SEND_PROVIDER_REJECTED"],
      ["unexpected", "SEND_PROVIDER_REJECTED"],
    ] as const;

    for (const [gatewayCode, expected] of cases) {
      const result = describeSendError(
        new BaileysGatewayError("boom", gatewayCode, 500),
      );
      expect(result.code, gatewayCode).toBe(expected);
      expect(result.detail).toBe("boom");
    }
  });

  it("separa rate limit, indisponibilidade e recusa da Meta pelo status", () => {
    expect(describeSendError(new WhatsAppApiError("x", 429)).code).toBe(
      "SEND_RATE_LIMITED",
    );
    expect(describeSendError(new WhatsAppApiError("x", 503)).code).toBe(
      "SEND_PROVIDER_UNAVAILABLE",
    );
    expect(describeSendError(new WhatsAppApiError("x", 400)).code).toBe(
      "SEND_PROVIDER_REJECTED",
    );
  });

  it("preserva o corpo cru da Meta no detalhe técnico", () => {
    const body = '{"error":{"message":"Invalid parameter","code":100}}';
    expect(describeSendError(new WhatsAppApiError(body, 400)).detail).toBe(body);
  });

  it("trata erros de rede como indisponibilidade do provedor", () => {
    expect(describeSendError(new TypeError("fetch failed")).code).toBe(
      "SEND_PROVIDER_UNAVAILABLE",
    );
    expect(
      describeSendError(Object.assign(new Error("x"), { code: "ECONNRESET" }))
        .code,
    ).toBe("SEND_PROVIDER_UNAVAILABLE");
    expect(
      describeSendError(
        Object.assign(new Error("x"), { code: "UND_ERR_SOCKET" }),
      ).code,
    ).toBe("SEND_PROVIDER_UNAVAILABLE");
    expect(
      describeSendError(Object.assign(new Error("x"), { name: "AbortError" }))
        .code,
    ).toBe("SEND_PROVIDER_UNAVAILABLE");
  });

  it("reconhece a falta de credenciais lançada como Error puro", () => {
    const err = new Error(
      "WhatsApp não configurado: wa_phone_number_id e wa_access_token são obrigatórios",
    );
    expect(describeSendError(err).code).toBe("SEND_CREDENTIALS_MISSING");
  });

  it("erro desconhecido vira UNEXPECTED sem perder o detalhe", () => {
    const result = describeSendError(new Error("coluna x não existe"));
    expect(result.code).toBe("UNEXPECTED");
    expect(result.detail).toBe("coluna x não existe");
  });
});

describe("toWhatsappErrorResponse", () => {
  it("usa status, mensagem e hint do código", () => {
    const { status, body } = toWhatsappErrorResponse(
      waError("CHANNEL_DISCONNECTED"),
    );
    expect(status).toBe(400);
    expect(body.code).toBe("CHANNEL_DISCONNECTED");
    expect(body.message).toBeTruthy();
    expect(body.hint).toBeTruthy();
  });

  it("mantém o payload extra ao lado de message/code", () => {
    const { body } = toWhatsappErrorResponse(
      waError("BOT_INCOMPATIBLE_CHANNEL", {
        details: { compatibility: { issues: [{ code: "CLOUD_ONLY_NODE" }] } },
      }),
    );
    expect(body.compatibility).toEqual({
      issues: [{ code: "CLOUD_ONLY_NODE" }],
    });
    expect(body.code).toBe("BOT_INCOMPATIBLE_CHANNEL");
  });

  it("nunca expõe o texto técnico na resposta", () => {
    const { body } = toWhatsappErrorResponse(
      waError("CAMPAIGN_NOT_FOUND", {
        technicalMessage: "SELECT falhou: relation whatsapp_campaigns",
      }),
    );
    expect(JSON.stringify(body)).not.toContain("SELECT");
  });

  it("anexa código aos erros de domínio que já existiam, preservando o texto", () => {
    expect(
      toWhatsappErrorResponse(new BotFlowValidationError("Nó X sem saída", 400)),
    ).toMatchObject({
      status: 400,
      body: { code: "BOT_FLOW_INVALID", message: "Nó X sem saída" },
    });

    expect(
      toWhatsappErrorResponse(new BotCompatibilityLookupError("sumiu", 404)),
    ).toMatchObject({ status: 404, body: { code: "BOT_NOT_FOUND" } });

    expect(
      toWhatsappErrorResponse(
        new BotCompatibilityLookupError("incompatível", 409),
      ),
    ).toMatchObject({
      status: 409,
      body: { code: "BOT_INCOMPATIBLE_CHANNEL" },
    });

    expect(
      toWhatsappErrorResponse(
        new CampaignRequeueBlockedError("bloqueado", "cancelled"),
      ),
    ).toMatchObject({ status: 409, body: { code: "CAMPAIGN_REQUEUE_BLOCKED" } });

    expect(
      toWhatsappErrorResponse(new CampaignConfigError("sem template nem bot")),
    ).toMatchObject({ status: 400, body: { code: "CAMPAIGN_NO_CONTENT" } });
  });

  it("erro desconhecido nunca vaza a mensagem original", () => {
    const { status, body } = toWhatsappErrorResponse(
      new Error('duplicate key value violates constraint "wa_campaigns_pkey"'),
    );
    expect(status).toBe(500);
    expect(body.code).toBe("UNEXPECTED");
    expect(JSON.stringify(body)).not.toContain("duplicate key");
  });
});

describe("classifyDispatchFailure", () => {
  it("falha estrutural encerra a campanha com o código do erro", () => {
    expect(
      classifyDispatchFailure(
        waError("CHANNEL_DISCONNECTED", { permanent: true }),
      ),
    ).toEqual({ permanent: true, code: "CHANNEL_DISCONNECTED" });

    expect(
      classifyDispatchFailure(waError("BOT_NOT_FOUND", { permanent: true })),
    ).toEqual({ permanent: true, code: "BOT_NOT_FOUND" });

    expect(classifyDispatchFailure(new CampaignConfigError("sem conteúdo"))).toEqual(
      { permanent: true, code: "CAMPAIGN_NO_CONTENT" },
    );
  });

  it("erro transitório continua sendo retentado no próximo tick", () => {
    // Se isto virar permanente, uma queda de rede passa a matar a campanha.
    expect(classifyDispatchFailure(new Error("ECONNRESET"))).toEqual({
      permanent: false,
    });
    expect(classifyDispatchFailure(new TypeError("fetch failed"))).toEqual({
      permanent: false,
    });
    expect(classifyDispatchFailure(waError("CAMPAIGN_NOT_FOUND"))).toEqual({
      permanent: false,
    });
  });
});

describe("respondWhatsappError", () => {
  function fakeRes() {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    return { res: { status } as never, status, json };
  }

  it("responde com o status do código e loga o técnico", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { res, status, json } = fakeRes();

    respondWhatsappError(res, waError("CAMPAIGN_ALREADY_RUNNING"), "[teste]");

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CAMPAIGN_ALREADY_RUNNING" }),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("erro desconhecido vira 500 genérico e vai para console.error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { res, status, json } = fakeRes();

    respondWhatsappError(res, new Error("stack interno"), "[teste]");

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UNEXPECTED" }),
    );
    expect(json.mock.calls[0][0].message).not.toContain("stack interno");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
