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
  updateConnectionStatusMock,
  canUserReadChannelQrMock,
  connectInstanceMock,
} = vi.hoisted(() => ({
  getChannelByIdMock: vi.fn(),
  updateConnectionStatusMock: vi.fn(),
  canUserReadChannelQrMock: vi.fn(),
  connectInstanceMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-channels.service", () => ({
  getChannelById: getChannelByIdMock,
  updateConnectionStatus: updateConnectionStatusMock,
  canUserReadChannelQr: canUserReadChannelQrMock,
  // Demais exports usados pelo módulo de rotas — não exercidos por estes testes.
  listChannels: vi.fn(),
  listActiveChannels: vi.fn(),
  listAccessibleChannelsForUser: vi.fn(),
  listAttendantsWithChannel: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
}));

vi.mock("../../integrations/evolution", () => ({
  connectInstance: connectInstanceMock,
  logoutInstance: vi.fn(),
  deleteInstance: vi.fn(),
}));

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

function makeApp(role = "vendedor", userId = "u1") {
  return createRouteTestApp({
    router: channelsRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId, role })],
  });
}

describe("GET /channels/:id/evolution/connect", () => {
  beforeEach(() => {
    getChannelByIdMock.mockReset();
    updateConnectionStatusMock.mockReset();
    canUserReadChannelQrMock.mockReset();
    connectInstanceMock.mockReset();
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
      .get("/api/whatsapp/channels/5/evolution/connect");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("QR123");
    expect(connectInstanceMock).toHaveBeenCalledWith("meu-whats");
    expect(updateConnectionStatusMock).toHaveBeenCalledWith(5, "connecting");
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
      .get("/api/whatsapp/channels/5/evolution/connect");

    expect(res.status).toBe(403);
    expect(connectInstanceMock).not.toHaveBeenCalled();
  });
});
