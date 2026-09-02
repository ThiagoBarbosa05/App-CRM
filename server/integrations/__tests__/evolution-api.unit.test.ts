import { describe, expect, it, vi, afterEach } from "vitest";
import { evolutionApi, EvolutionApiError } from "../evolution-api";

describe("evolutionApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the v2 apikey and creates an instance", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.local/");
    vi.stubEnv("EVOLUTION_API_KEY", "secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ instance: { instanceName: "crm-1", status: "created" } }), { status: 201 }),
    );

    await evolutionApi.createInstance("crm-1", "http://crm.local/api/whatsapp/evolution/webhook");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://evolution.local/instance/create",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: "secret", "Content-Type": "application/json" }),
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const payload = JSON.parse(String(requestInit?.body)) as {
      webhook: { enabled?: boolean; headers?: Record<string, string> };
    };
    expect(payload.webhook.enabled).toBeUndefined();
    expect(payload.webhook.headers).toBeUndefined();
  });

  it("normalizes non-success responses into a typed error", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.local");
    vi.stubEnv("EVOLUTION_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "offline" }), { status: 503 }));

    await expect(evolutionApi.getInstance("crm-1")).rejects.toMatchObject<EvolutionApiError>({ code: "unavailable", status: 503 });
  });

  it("rejects the CRM webhook URL as the Evolution API base URL", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "https://crm.local/api/evolution/v2/webhook");
    vi.stubEnv("EVOLUTION_API_KEY", "secret");

    await expect(evolutionApi.getInstance("crm-1")).rejects.toMatchObject({
      code: "not_configured",
      message: expect.stringContaining("EVOLUTION_API_URL"),
    });
  });

  it("sends the complete webhook message when fetching media base64", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.local");
    vi.stubEnv("EVOLUTION_API_KEY", "secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ base64: "QUJD", mimetype: "image/jpeg" }), { status: 201 }),
    );
    const message = {
      key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "message-1" },
      message: { imageMessage: { url: "https://mmg.whatsapp.net/media", mimetype: "image/jpeg" } },
    };

    await evolutionApi.getMediaBase64("crm-1", message);

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://evolution.local/chat/getBase64FromMediaMessage/crm-1");
    expect(JSON.parse(String(requestInit?.body))).toEqual({ message, convertToMp4: false });
  });

  it("updates an existing instance webhook with the requested config", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.local");
    vi.stubEnv("EVOLUTION_API_KEY", "secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    const config = { url: "https://crm.local/webhook", byEvents: false, base64: true, events: ["MESSAGES_UPSERT"] };

    await evolutionApi.setWebhook("crm-1", config);

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://evolution.local/webhook/set/crm-1");
    expect(JSON.parse(String(requestInit?.body))).toEqual(config);
  });
});
