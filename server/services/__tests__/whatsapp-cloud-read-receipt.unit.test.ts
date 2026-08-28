import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../whatsapp-settings.service", () => ({
  getWhatsappSettingsRaw: vi.fn(async () => ({
    wa_phone_number_id: "global-phone-id",
    wa_access_token: "global-access-token",
  })),
}));

import { markMessageAsRead } from "../../integrations/whatsapp";

describe("markMessageAsRead", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia o recibo de leitura para a mensagem inbound pelo canal Cloud API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await markMessageAsRead("wamid.inbound", {
      phoneNumberId: "channel-phone-id",
      accessToken: "channel-access-token",
      apiVersion: "v26.0",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v26.0/channel-phone-id/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer channel-access-token" }),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: "wamid.inbound",
        }),
      }),
    );
  });

  it("usa Graph API v26.0 quando não há versão salva", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await markMessageAsRead("wamid.default");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v26.0/global-phone-id/messages",
      expect.any(Object),
    );
  });
});
