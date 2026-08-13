import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, updateUserMock, s3SendMock, deleteR2ObjectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  s3SendMock: vi.fn(),
  deleteR2ObjectMock: vi.fn(),
}));

// Mock de ../../storage é obrigatório: sem ele, o import de user-profile.routes
// arrasta server/db.ts, que lança sem DATABASE_URL configurada no ambiente de teste.
vi.mock("../../storage", () => ({
  storage: { getUser: getUserMock, updateUser: updateUserMock },
}));

vi.mock("../../lib/r2", () => ({
  r2: { send: s3SendMock },
  deleteR2Object: deleteR2ObjectMock,
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
}));

// Este arquivo NÃO mocka ../../middleware/validation: o objetivo é exercitar
// o requireAuth real (cookie JWT), não um substituto condicionado a req.user.
import { userProfileRouter } from "../user-profile.routes";

describe("user profile router — auth enforcement (real requireAuth)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
    s3SendMock.mockReset();
    deleteR2ObjectMock.mockReset();
  });

  it("rejeita POST /api/users/me/avatar sem cookie de autenticação", async () => {
    const app = express();
    app.use("/api/users", userProfileRouter);

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(401);
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejeita DELETE /api/users/me/avatar sem cookie de autenticação", async () => {
    const app = express();
    app.use("/api/users", userProfileRouter);

    const response = await request(app).delete("/api/users/me/avatar");

    expect(response.status).toBe(401);
    expect(deleteR2ObjectMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
