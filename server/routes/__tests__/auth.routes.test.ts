import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { authRouter } from "../auth.routes";

const { getUserByEmailMock, compareMock } = vi.hoisted(() => ({
  getUserByEmailMock: vi.fn(),
  compareMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getUserByEmail: getUserByEmailMock,
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: compareMock,
  },
}));

describe("authRouter", () => {
  beforeEach(() => {
    getUserByEmailMock.mockReset();
    compareMock.mockReset();
  });

  it("returns 200 on successful login and sets cookie", async () => {
    getUserByEmailMock.mockResolvedValue({
      id: "user-1",
      name: "Thiago",
      email: "thiago@example.com",
      password: "hashed-password",
      role: "admin",
      isActive: "true",
      serviceChannel: { id: "channel-1" },
    });
    compareMock.mockResolvedValue(true);

    const app = createRouteTestApp({ router: authRouter, basePath: "/auth" });

    const response = await request(app).post("/auth/login").send({
      email: "THIAGO@example.com",
      password: "secret123",
    });

    expect(getUserByEmailMock).toHaveBeenCalledWith("thiago@example.com");
    expect(compareMock).toHaveBeenCalledWith("secret123", "hashed-password");
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(response.body).toMatchObject({
      user: {
        id: "user-1",
        name: "Thiago",
        email: "thiago@example.com",
        role: "admin",
        serviceChannelId: "channel-1",
      },
      message: "Login realizado com sucesso",
    });
  });

  it("returns 400 when email or password fails Zod validation", async () => {
    const app = createRouteTestApp({ router: authRouter, basePath: "/auth" });

    const response = await request(app).post("/auth/login").send({
      email: "thiago@example.com",
    });

    expect(response.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    getUserByEmailMock.mockResolvedValue(null);

    const app = createRouteTestApp({ router: authRouter, basePath: "/auth" });

    const response = await request(app).post("/auth/login").send({
      email: "thiago@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Credenciais inválidas",
    });
  });

  it("returns 500 when storage or bcrypt fails", async () => {
    getUserByEmailMock.mockRejectedValue(new Error("storage failed"));

    const app = createRouteTestApp({ router: authRouter, basePath: "/auth" });

    const response = await request(app).post("/auth/login").send({
      email: "thiago@example.com",
      password: "secret",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Erro interno do servidor",
    });
  });
});
