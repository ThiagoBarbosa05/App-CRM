import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import copilotoRouter from "../copiloto.routes";

const { loadMoreFromBacklogMock, getCopilotoFeedMock, currentUser } = vi.hoisted(
  () => ({
    loadMoreFromBacklogMock: vi.fn(),
    getCopilotoFeedMock: vi.fn(),
    // Mutável: a permissão depende de quem chama, e o mock do requireAuth é
    // içado uma vez só para o módulo inteiro.
    currentUser: { userId: "me", role: "vendedor", email: "me@example.com" },
  }),
);

// requireAuth real lê o cookie JWT e sobrescreve req.user — o mock de auth do
// createRouteTestApp sozinho não passa por ele.
vi.mock("../../middleware/validation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../middleware/validation")>();
  return {
    ...actual,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

// O serviço importa server/db no topo; sem o mock o teste abriria conexão.
vi.mock("../../services/copiloto.service", () => ({
  loadMoreFromBacklog: loadMoreFromBacklogMock,
  getCopilotoFeed: getCopilotoFeedMock,
  actOnSignal: vi.fn(),
  scanCopilotoSignals: vi.fn(),
}));

const appAs = (role: string, userId = "me") => {
  currentUser.role = role;
  currentUser.userId = userId;
  return createRouteTestApp({ router: copilotoRouter, basePath: "/copiloto" });
};

describe("copilotoRouter — POST /load-more", () => {
  beforeEach(() => {
    loadMoreFromBacklogMock.mockReset();
    loadMoreFromBacklogMock.mockResolvedValue({ promoted: 3, remaining: 10 });
  });

  it("promove na própria fila quando não vem sellerId", async () => {
    const response = await request(appAs("vendedor")).post("/copiloto/load-more");

    expect(response.status).toBe(200);
    expect(loadMoreFromBacklogMock).toHaveBeenCalledWith("me");
  });

  it("deixa admin promover na fila de outro vendedor", async () => {
    const response = await request(appAs("admin")).post(
      "/copiloto/load-more?sellerId=outro",
    );

    expect(response.status).toBe(200);
    expect(loadMoreFromBacklogMock).toHaveBeenCalledWith("outro");
  });

  it("deixa gerente promover na fila de outro vendedor", async () => {
    const response = await request(appAs("gerente")).post(
      "/copiloto/load-more?sellerId=outro",
    );

    expect(response.status).toBe(200);
    expect(loadMoreFromBacklogMock).toHaveBeenCalledWith("outro");
  });

  it("barra vendedor tentando promover na fila de outro", async () => {
    const response = await request(appAs("vendedor")).post(
      "/copiloto/load-more?sellerId=outro",
    );

    expect(response.status).toBe(403);
    expect(loadMoreFromBacklogMock).not.toHaveBeenCalled();
  });

  // O ?sellerId apontando para si mesmo não é tentativa de escalar privilégio:
  // é o vendedor comum abrindo a própria fila com o parâmetro preenchido.
  it("deixa vendedor passar o próprio id explicitamente", async () => {
    const response = await request(appAs("vendedor", "me")).post(
      "/copiloto/load-more?sellerId=me",
    );

    expect(response.status).toBe(200);
    expect(loadMoreFromBacklogMock).toHaveBeenCalledWith("me");
  });
});
