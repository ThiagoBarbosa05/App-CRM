import { describe, expect, it } from "vitest";

import {
  AVATAR_MAX_BYTES,
  buildAvatarKey,
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
