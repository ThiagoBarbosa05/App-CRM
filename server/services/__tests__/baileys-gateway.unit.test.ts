import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  baileysGateway,
  BaileysGatewayError,
} from "../../integrations/baileys-gateway";

describe("baileysGateway", () => {
  beforeEach(() => {
    process.env.GATEWAY_URL = "https://gateway.example";
    process.env.GATEWAY_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("codifica o nome e envia autenticação e idempotência", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: true, id: "wa-1" },
          status: "sent",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await baileysGateway.sendText(
      "canal-piloto",
      { to: "5511999999999", text: "Olá" },
      "message-123",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.example/v1/instances/canal-piloto/messages/text",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Idempotency-Key": "message-123",
        }),
      }),
    );
  });

  it("classifica instância desconectada como erro de canal offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Instância "x" desconectada' }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      baileysGateway.sendText("x", { to: "5511999999999", text: "Olá" }, "m-1"),
    ).rejects.toMatchObject<Partial<BaileysGatewayError>>({
      code: "channel_offline",
    });
  });

  it("classifica sobrecarga", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Memória acima do limite seguro" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(baileysGateway.connect("x")).rejects.toMatchObject({
      code: "overloaded",
    });
  });

  it("solicita novo pareamento apenas quando explicitamente informado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ code: "", connectionStatus: "connecting" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await baileysGateway.connect("canal-piloto", true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.example/v1/instances/canal-piloto/connect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ forceNewPairing: true }),
      }),
    );
  });
});
