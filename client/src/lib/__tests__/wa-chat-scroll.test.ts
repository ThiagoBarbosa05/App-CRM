import { describe, expect, it } from "vitest";
import {
  getWhatsappChatAutoScrollBehavior,
  isWhatsappChatNearBottom,
} from "../wa-chat-scroll";

describe("isWhatsappChatNearBottom", () => {
  it("considera o chat no fim quando resta apenas a tolerância configurada", () => {
    expect(
      isWhatsappChatNearBottom({
        scrollHeight: 1_000,
        scrollTop: 620,
        clientHeight: 300,
      }),
    ).toBe(true);
  });

  it("considera o atendente fora do fim quando ele está lendo mensagens antigas", () => {
    expect(
      isWhatsappChatNearBottom({
        scrollHeight: 1_000,
        scrollTop: 400,
        clientHeight: 300,
      }),
    ).toBe(false);
  });
});

describe("getWhatsappChatAutoScrollBehavior", () => {
  it("rola sem animação ao abrir a conversa", () => {
    expect(
      getWhatsappChatAutoScrollBehavior({
        hasScrolledInitially: false,
        wasNearBottom: false,
      }),
    ).toBe("auto");
  });

  it("rola suavemente quando uma atualização chega e o atendente estava no fim", () => {
    expect(
      getWhatsappChatAutoScrollBehavior({
        hasScrolledInitially: true,
        wasNearBottom: true,
      }),
    ).toBe("smooth");
  });

  it("não desloca o atendente quando ele está lendo o histórico", () => {
    expect(
      getWhatsappChatAutoScrollBehavior({
        hasScrolledInitially: true,
        wasNearBottom: false,
      }),
    ).toBeNull();
  });
});
