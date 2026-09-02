import { beforeEach, describe, expect, it, vi } from "vitest";

const { getChannelMock, connectMock, createInstanceMock, setWebhookMock } = vi.hoisted(() => ({
  getChannelMock: vi.fn(),
  connectMock: vi.fn(),
  createInstanceMock: vi.fn(),
  setWebhookMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-channels.service", () => ({
  getChannelByEvolutionInstance: getChannelMock,
}));

vi.mock("../evolution-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../evolution-api")>();
  return {
    ...original,
    evolutionApi: {
      connect: connectMock,
      createInstance: createInstanceMock,
      setWebhook: setWebhookMock,
    },
  };
});

vi.mock("../baileys-gateway", () => ({
  baileysGateway: {},
}));

vi.mock("../../services/baileys/connection-status.service", () => ({
  applyChannelConnectionStatus: vi.fn(),
}));

import { connectInstance, EvolutionApiError } from "../evolution";

describe("connectInstance with Evolution API", () => {
  beforeEach(() => {
    getChannelMock.mockReset();
    connectMock.mockReset();
    createInstanceMock.mockReset();
    setWebhookMock.mockReset();
    vi.stubEnv("EVOLUTION_WEBHOOK_URL", "https://crm.local/api/evolution/v2/webhook");
    getChannelMock.mockResolvedValue({ id: 7, qrBackend: "evolution_api" });
  });

  it("connects an existing instance without creating it again", async () => {
    connectMock.mockResolvedValue({
      pairingCode: null,
      code: "2@qr-code",
      base64: "data:image/png;base64,QUJD",
      count: 1,
    });

    const result = await connectInstance("crm-7");

    expect(result).toEqual({
      code: "2@qr-code",
      base64: "data:image/png;base64,QUJD",
      connectionStatus: "qr",
    });
    expect(createInstanceMock).not.toHaveBeenCalled();
    expect(setWebhookMock).toHaveBeenCalledWith("crm-7", expect.objectContaining({ base64: true }));
  });

  it("recreates a missing instance once and normalizes raw base64", async () => {
    connectMock
      .mockRejectedValueOnce(new EvolutionApiError("missing", "not_found", 404))
      .mockResolvedValueOnce({ code: "2@new-qr", base64: "QUJD", count: 1 });
    createInstanceMock.mockResolvedValue({
      instance: { instanceName: "crm-7", status: "created" },
    });

    const result = await connectInstance("crm-7");

    expect(result).toEqual({
      code: "2@new-qr",
      base64: "data:image/png;base64,QUJD",
      connectionStatus: "qr",
    });
    expect(createInstanceMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("does not report qr when Evolution returns no renderable content", async () => {
    connectMock.mockResolvedValue({ count: 0 });

    const result = await connectInstance("crm-7");

    expect(result).toEqual({ code: "", base64: undefined, connectionStatus: undefined });
    expect(createInstanceMock).not.toHaveBeenCalled();
  });
});
