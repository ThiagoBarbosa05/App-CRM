import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, updateUserMock, s3SendMock, deleteR2ObjectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  s3SendMock: vi.fn(),
  deleteR2ObjectMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: { getUser: getUserMock, updateUser: updateUserMock },
}));

vi.mock("../../lib/r2", () => ({
  r2: { send: s3SendMock },
  deleteR2Object: deleteR2ObjectMock,
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
}));

// requireAuth real depende de cookie JWT, que os testes de rota não emitem.
// Aqui ele vira um passthrough condicionado a req.user: todos os testes deste
// arquivo usam createMockAuthMiddleware, que injeta req.user antes desta
// checagem rodar. O 401 do requireAuth real é coberto separadamente em
// user-profile.routes.auth.test.ts, que não mocka este módulo.
vi.mock("../../middleware/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/validation")>();
  return {
    ...actual,
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      if (req.user) return next();
      return res.status(401).json({ message: "Usuário não autenticado", code: "UNAUTHORIZED" });
    },
  };
});

import {
  createMockAuthMiddleware,
  createRouteTestApp,
} from "../../test/create-route-test-app";
import {
  AVATAR_MAX_BYTES,
  buildAvatarKey,
  userProfileRouter,
  validateAvatarUpload,
} from "../user-profile.routes";

describe("validateAvatarUpload", () => {
  it("aceita jpeg, png e webp dentro do limite", () => {
    expect(validateAvatarUpload("image/jpeg", 1024)).toEqual({ ok: true });
    expect(validateAvatarUpload("image/png", 1024)).toEqual({ ok: true });
    expect(validateAvatarUpload("image/webp", 1024)).toEqual({ ok: true });
  });

  it("rejeita mime não permitido", () => {
    const result = validateAvatarUpload("application/pdf", 1024);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("JPEG");
    }
  });

  it("rejeita gif, que é imagem mas não está na whitelist", () => {
    expect(validateAvatarUpload("image/gif", 1024).ok).toBe(false);
  });

  it("rejeita arquivo acima do limite", () => {
    const result = validateAvatarUpload("image/jpeg", AVATAR_MAX_BYTES + 1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("5 MB");
    }
  });

  it("aceita arquivo exatamente no limite", () => {
    expect(validateAvatarUpload("image/jpeg", AVATAR_MAX_BYTES)).toEqual({ ok: true });
  });
});

describe("buildAvatarKey", () => {
  it("usa o prefixo avatars/<userId>/", () => {
    expect(buildAvatarKey("user-1")).toMatch(/^avatars\/user-1\/[0-9a-f-]{36}$/);
  });

  it("gera uma chave diferente a cada chamada", () => {
    expect(buildAvatarKey("user-1")).not.toBe(buildAvatarKey("user-1"));
  });
});

describe("POST /api/users/me/avatar", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
    s3SendMock.mockReset();
    deleteR2ObjectMock.mockReset();
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: null });
    updateUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("rejeita mime não permitido com 400", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "doc.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(400);
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejeita requisição sem arquivo com 400", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app).post("/api/users/me/avatar");

    expect(response.status).toBe(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("grava a chave no usuário AUTENTICADO, ignorando id enviado no body", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app)
      .post("/api/users/me/avatar")
      .field("userId", "outro-usuario")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    const [targetId, patch] = updateUserMock.mock.calls[0];
    expect(targetId).toBe("user-1");
    expect(patch.avatarStorageKey).toMatch(/^avatars\/user-1\//);
    expect(response.body.avatarUrl).toBe(`https://cdn.test/${patch.avatarStorageKey}`);
  });

  it("remove a foto anterior ao trocar", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: "avatars/user-1/antiga" });
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(deleteR2ObjectMock).toHaveBeenCalledWith("avatars/user-1/antiga");
  });

  it("responde 200 mesmo se a remoção da foto anterior falhar", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: "avatars/user-1/antiga" });
    deleteR2ObjectMock.mockRejectedValue(new Error("R2 fora do ar"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", Buffer.from("fake"), { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Erro ao remover avatar anterior do R2:",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it("rejeita arquivo acima do limite com 400, sem chamar R2 nem storage", async () => {
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const oversized = Buffer.alloc(AVATAR_MAX_BYTES + 1, 1);

    const response = await request(app)
      .post("/api/users/me/avatar")
      .attach("file", oversized, { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("A imagem deve ter no máximo 5 MB.");
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/users/me/avatar", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
    deleteR2ObjectMock.mockReset();
    updateUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("limpa a coluna e remove o objeto", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: "avatars/user-1/antiga" });
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app).delete("/api/users/me/avatar");

    expect(response.status).toBe(200);
    expect(response.body.avatarUrl).toBeNull();
    expect(updateUserMock).toHaveBeenCalledWith("user-1", { avatarStorageKey: null });
    expect(deleteR2ObjectMock).toHaveBeenCalledWith("avatars/user-1/antiga");
  });

  it("é idempotente quando não há foto", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", avatarStorageKey: null });
    const app = createRouteTestApp({
      router: userProfileRouter,
      basePath: "/api/users",
      middlewares: [createMockAuthMiddleware({ userId: "user-1" })],
    });

    const response = await request(app).delete("/api/users/me/avatar");

    expect(response.status).toBe(200);
    expect(deleteR2ObjectMock).not.toHaveBeenCalled();
  });
});
