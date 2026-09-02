import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";

// server/db abre um Pool real na importação; o módulo de rotas o puxa
// transitivamente (services → db, integrations/evolution → baileys).
vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../lib/sse-hub", () => ({
  publishSseEvent: () => {},
  addSseClient: () => () => {},
}));

const {
  getChannelByIdMock,
  applyChannelConnectionStatusMock,
  canUserReadChannelQrMock,
  connectInstanceMock,
  evolutionConnectMock,
  evolutionGetConnectionStateMock,
  evolutionCreateInstanceMock,
  evolutionDeleteInstanceMock,
  createChannelMock,
} = vi.hoisted(() => ({
  getChannelByIdMock: vi.fn(),
  applyChannelConnectionStatusMock: vi.fn(),
  canUserReadChannelQrMock: vi.fn(),
  connectInstanceMock: vi.fn(),
  evolutionConnectMock: vi.fn(),
  evolutionGetConnectionStateMock: vi.fn(),
  evolutionCreateInstanceMock: vi.fn(),
  evolutionDeleteInstanceMock: vi.fn(),
  createChannelMock: vi.fn(),
}));

vi.mock("../../services/baileys/connection-status.service", () => ({
  applyChannelConnectionStatus: applyChannelConnectionStatusMock,
}));

vi.mock("../../services/whatsapp-channels.service", () => ({
  getChannelById: getChannelByIdMock,
  canUserReadChannelQr: canUserReadChannelQrMock,
  // Demais exports usados pelo módulo de rotas — não exercidos por estes testes.
  listChannels: vi.fn(),
  listActiveChannels: vi.fn(),
  listAccessibleChannelsForUser: vi.fn(),
  listAttendantsWithChannel: vi.fn(),
  createChannel: createChannelMock,
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
}));

vi.mock("../../integrations/evolution", () => ({
  connectInstance: connectInstanceMock,
  logoutInstance: vi.fn(),
  deleteInstance: vi.fn(),
}));

vi.mock("../../integrations/evolution-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../integrations/evolution-api")>();
  return {
    ...original,
    evolutionApi: {
      connect: evolutionConnectMock,
      getConnectionState: evolutionGetConnectionStateMock,
      createInstance: evolutionCreateInstanceMock,
      deleteInstance: evolutionDeleteInstanceMock,
    },
  };
});

vi.mock("../../integrations/whatsapp", () => ({
  listWabaPhoneNumbers: vi.fn(),
  getPhoneNumberDetails: vi.fn(),
  requestVerificationCode: vi.fn(),
  verifyPhoneNumber: vi.fn(),
}));

vi.mock("../../services/whatsapp-settings.service", () => ({
  getWhatsappSettingsRaw: vi.fn(),
}));

vi.mock("../../services/baileys/connection-events.service", () => ({
  listChannelConnectionEvents: vi.fn(),
}));

vi.mock("../../middleware/validation", () => ({
  isAdminOrGerente: (req: { user?: { role?: string } }) =>
    ["admin", "gerente"].includes(req.user?.role ?? ""),
  requireAdminOrGerente: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import channelsRouter from "../whatsapp-channels.routes";
import { EvolutionApiError } from "../../integrations/evolution-api";

function makeApp(role = "vendedor", userId = "u1") {
  return createRouteTestApp({
    router: channelsRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId, role })],
  });
}

describe("POST /channels/:id/evolution/connect", () => {
  beforeEach(() => {
    getChannelByIdMock.mockReset();
    applyChannelConnectionStatusMock.mockReset();
    canUserReadChannelQrMock.mockReset();
    connectInstanceMock.mockReset();
    evolutionConnectMock.mockReset();
    evolutionGetConnectionStateMock.mockReset();
    evolutionCreateInstanceMock.mockReset();
    evolutionDeleteInstanceMock.mockReset();
    createChannelMock.mockReset();
  });

  it("clique explícito força novo QR e marca 'connecting'", async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 5,
      userId: "u1", // dono = usuário autenticado
      evolutionInstanceName: "meu-whats",
      connectionStatus: "disconnected",
    });
    connectInstanceMock.mockResolvedValue({ code: "QR123", base64: "data:image/png;base64,AAA" });

    const res = await request(makeApp())
      .post("/api/whatsapp/channels/5/evolution/connect");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("QR123");
    expect(connectInstanceMock).toHaveBeenCalledWith("meu-whats");
    expect(applyChannelConnectionStatusMock).toHaveBeenCalledWith(
      5,
      "connecting",
      expect.objectContaining({ source: "route", logEvent: false }),
    );
  });

  it("nega acesso a quem não é dono, admin nem leitor de QR", async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 5,
      userId: "outro-dono",
      evolutionInstanceName: "meu-whats",
      connectionStatus: "connected",
    });
    canUserReadChannelQrMock.mockResolvedValue(false);

    const res = await request(makeApp("vendedor", "u1"))
      .post("/api/whatsapp/channels/5/evolution/connect");

    expect(res.status).toBe(403);
    expect(connectInstanceMock).not.toHaveBeenCalled();
  });

  it("marks connecting when Evolution returns a QR code without base64", async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 5,
      userId: "u1",
      evolutionInstanceName: "meu-whats",
      connectionStatus: "disconnected",
    });
    connectInstanceMock.mockResolvedValue({ code: "2@QR-ONLY", connectionStatus: "qr" });

    const res = await request(makeApp())
      .post("/api/whatsapp/channels/5/evolution/connect");

    expect(res.status).toBe(200);
    expect(applyChannelConnectionStatusMock).toHaveBeenCalledWith(
      5,
      "connecting",
      expect.objectContaining({ logEvent: false }),
    );
  });

  it("polls Evolution connection state without generating another QR", async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 5,
      userId: "u1",
      evolutionInstanceName: "meu-whats",
      qrBackend: "evolution_api",
      connectionStatus: "connecting",
    });
    evolutionGetConnectionStateMock.mockResolvedValue({ instance: { state: "connecting" } });

    const res = await request(makeApp()).get(
      "/api/whatsapp/channels/5/evolution/qr",
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: "",
      connectionStatus: "connecting",
      observedState: "connecting",
    });
    expect(evolutionConnectMock).not.toHaveBeenCalled();
  });
});

describe("POST /channels/evolution", () => {
  beforeEach(() => {
    evolutionCreateInstanceMock.mockReset();
    evolutionDeleteInstanceMock.mockReset();
    createChannelMock.mockReset();
  });

  it("rejects a name that cannot produce a valid instance slug", async () => {
    const res = await request(makeApp("admin")).post(
      "/api/whatsapp/channels/evolution",
    ).send({ name: "🔥🔥" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nome/i);
    expect(evolutionCreateInstanceMock).not.toHaveBeenCalled();
  });

  it("removes the remote instance when CRM persistence fails", async () => {
    evolutionCreateInstanceMock.mockResolvedValue({
      instance: { instanceName: "canal-vendas", status: "created" },
    });
    createChannelMock.mockRejectedValue(new Error("database unavailable"));
    evolutionDeleteInstanceMock.mockResolvedValue(undefined);

    const res = await request(makeApp("admin")).post(
      "/api/whatsapp/channels/evolution",
    ).send({ name: "Canal Vendas" });

    expect(res.status).toBe(500);
    expect(evolutionDeleteInstanceMock).toHaveBeenCalledWith("canal-vendas");
  });

  it("returns conflict when Evolution reports an existing instance", async () => {
    evolutionCreateInstanceMock.mockRejectedValue(
      new EvolutionApiError("Instance already exists", "unexpected", 409),
    );

    const res = await request(makeApp("admin")).post(
      "/api/whatsapp/channels/evolution",
    ).send({ name: "Canal Vendas" });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/já existe/i);
    expect(createChannelMock).not.toHaveBeenCalled();
  });
});
