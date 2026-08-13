import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/r2", () => ({
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
}));

import { toAvatarUrl, toPublicUser } from "../../lib/user-serializer";
import type { User } from "@shared/schema";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Ana",
    email: "ana@example.com",
    password: "hash-secreto",
    role: "vendedor",
    isActive: "true",
    blingVendedorId: null,
    blingVendedorName: null,
    umblerMemberId: null,
    umblerMemberName: null,
    avatarStorageKey: null,
    pdvUnitId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as User;
}

describe("toAvatarUrl", () => {
  it("devolve null quando não há chave", () => {
    expect(toAvatarUrl(null)).toBeNull();
    expect(toAvatarUrl(undefined)).toBeNull();
    expect(toAvatarUrl("")).toBeNull();
  });

  it("deriva a URL pública a partir da chave", () => {
    expect(toAvatarUrl("avatars/user-1/abc")).toBe("https://cdn.test/avatars/user-1/abc");
  });
});

describe("toPublicUser", () => {
  it("não vaza password nem avatarStorageKey", () => {
    const result = toPublicUser(buildUser({ avatarStorageKey: "avatars/user-1/abc" }));

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("avatarStorageKey");
  });

  it("expõe avatarUrl derivado da chave", () => {
    const result = toPublicUser(buildUser({ avatarStorageKey: "avatars/user-1/abc" }));

    expect(result.avatarUrl).toBe("https://cdn.test/avatars/user-1/abc");
  });

  it("expõe avatarUrl null quando o usuário não tem foto", () => {
    expect(toPublicUser(buildUser()).avatarUrl).toBeNull();
  });

  it("preserva os demais campos do usuário", () => {
    const result = toPublicUser(buildUser());

    expect(result.id).toBe("user-1");
    expect(result.name).toBe("Ana");
    expect(result.email).toBe("ana@example.com");
    expect(result.role).toBe("vendedor");
  });
});
