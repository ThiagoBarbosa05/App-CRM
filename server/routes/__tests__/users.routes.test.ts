import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { usersRouter } from "../users.routes";

type QueryResult = unknown[];

const {
  getUserByEmailMock,
  getChannelsMock,
  selectResults,
  insertValuesMock,
  insertOnConflictDoUpdateMock,
  updateSetMock,
} = vi.hoisted(() => ({
  getUserByEmailMock: vi.fn(),
  getChannelsMock: vi.fn(),
  selectResults: [] as QueryResult[],
  insertValuesMock: vi.fn(),
  insertOnConflictDoUpdateMock: vi.fn(),
  updateSetMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getUserByEmail: getUserByEmailMock,
  },
}));

vi.mock("../../integrations/umbler", () => ({
  getChannels: getChannelsMock,
}));

vi.mock("../../middleware/validation", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  validateParams: () =>
    (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../controllers/users/get-users.controller", () => ({
  getUsersController: vi.fn(),
}));
vi.mock("../../controllers/users/post-user.controller", () => ({
  createUserController: vi.fn(),
}));
vi.mock("../../controllers/users/put-user.controller", () => ({
  updateUserController: vi.fn(),
}));
vi.mock("../../controllers/users/delete-user.controller", () => ({
  deleteUserController: vi.fn(),
}));
vi.mock("../../controllers/users/patch-toggle-user-status.controller", () => ({
  toggleUserStatusController: vi.fn(),
}));
vi.mock("../../controllers/users/post-sync-bling-vendors.controller", () => ({
  syncBlingVendorsController: vi.fn(),
}));
vi.mock("../../controllers/users/get-seller-sales.controller", () => ({
  getSellerSalesController: vi.fn(),
}));

vi.mock("../../db", () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => selectResults.shift() ?? []),
      })),
    })),
    insert: vi.fn(() => ({
      values: insertValuesMock.mockImplementation(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: updateSetMock.mockImplementation(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };

  insertValuesMock.mockImplementation(() => ({
    onConflictDoUpdate: insertOnConflictDoUpdateMock.mockImplementation(
      async () => undefined,
    ),
  }));

  return { db };
});

describe("usersRouter migrated routes", () => {
  beforeEach(() => {
    getUserByEmailMock.mockReset();
    getChannelsMock.mockReset();
    selectResults.length = 0;
    insertValuesMock.mockClear();
    insertOnConflictDoUpdateMock.mockClear();
    updateSetMock.mockClear();
  });

  it("returns 200 for GET /by-email/:email", async () => {
    getUserByEmailMock.mockResolvedValue({
      id: "user-1",
      name: "Thiago",
      email: "thiago@example.com",
      password: "hashed",
    });

    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).get("/users/by-email/thiago@example.com");

    expect(getUserByEmailMock).toHaveBeenCalledWith("thiago@example.com");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "user-1",
      name: "Thiago",
      email: "thiago@example.com",
      password: "hashed",
    });
  });

  it("returns 404 for GET /by-email/:email when user is missing", async () => {
    getUserByEmailMock.mockResolvedValue(undefined);

    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).get("/users/by-email/missing@example.com");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Usuário não encontrado" });
  });

  it("returns 400 for POST /channel when required ids are missing", async () => {
    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).post("/users/channel").send({
      userId: "user-1",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "ID do usuário e ID do canal são obrigatórios",
    });
  });

  it("returns 404 for POST /channel when user is missing", async () => {
    selectResults.push([]);

    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).post("/users/channel").send({
      userId: "user-1",
      serviceChannelId: "channel-1",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Usuário não encontrado" });
  });

  it("updates an existing channel link", async () => {
    selectResults.push([{ id: "user-1" }], [{ id: "channel-1" }], [{ userId: "user-1" }]);

    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).post("/users/channel").send({
      userId: "user-1",
      serviceChannelId: "channel-1",
    });

    expect(updateSetMock).toHaveBeenCalledWith({ serviceChannelId: "channel-1" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Canal do usuário atualizado com sucesso",
      channelId: "channel-1",
    });
  });

  it("creates a new channel link when none exists", async () => {
    selectResults.push([{ id: "user-1" }], [{ id: "channel-1" }], []);

    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).post("/users/channel").send({
      userId: "user-1",
      serviceChannelId: "channel-1",
    });

    expect(insertValuesMock).toHaveBeenCalledWith({
      userId: "user-1",
      serviceChannelId: "channel-1",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Canal vinculado ao usuário com sucesso",
      channelId: "channel-1",
    });
  });

  it("returns 404 when the channel cannot be found locally or via Umbler sync", async () => {
    selectResults.push([{ id: "user-1" }], [], []);
    getChannelsMock.mockResolvedValue([]);

    const app = createRouteTestApp({ router: usersRouter, basePath: "/users" });

    const response = await request(app).post("/users/channel").send({
      userId: "user-1",
      serviceChannelId: "channel-1",
    });

    expect(getChannelsMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Canal de serviço não encontrado" });
  });
});
