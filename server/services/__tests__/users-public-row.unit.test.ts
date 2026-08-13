import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/r2", () => ({
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
}));

// O repositório importa `server/db` no topo; mockar aqui mantém o teste sem banco.
vi.mock("../../repositories/users.repository", () => ({
  usersRepository: { getUsers: vi.fn() },
}));

import { toPublicUserRow } from "../users.service";

const row = {
  id: "user-1",
  name: "Ana",
  email: "ana@example.com",
  password: "hash-secreto",
  role: "vendedor",
  avatarStorageKey: "avatars/user-1/abc",
  serviceChannel: { id: "ch-1", name: "Canal", phoneNumber: "+5511999999999" },
};

describe("toPublicUserRow", () => {
  it("expõe avatarUrl derivado da chave do R2", () => {
    expect(toPublicUserRow(row).avatarUrl).toBe("https://cdn.test/avatars/user-1/abc");
  });

  it("devolve avatarUrl null quando o usuário não tem foto", () => {
    expect(toPublicUserRow({ ...row, avatarStorageKey: null }).avatarUrl).toBeNull();
  });

  it("não vaza password nem a chave crua do R2", () => {
    const result = toPublicUserRow(row);

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("avatarStorageKey");
  });

  it("preserva os demais campos, incluindo serviceChannel", () => {
    const result = toPublicUserRow(row);

    expect(result).toMatchObject({
      id: "user-1",
      name: "Ana",
      email: "ana@example.com",
      role: "vendedor",
      serviceChannel: { id: "ch-1", name: "Canal", phoneNumber: "+5511999999999" },
    });
  });
});
