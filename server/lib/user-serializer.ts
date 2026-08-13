import type { User } from "@shared/schema";
import { getPublicR2Url } from "./r2";

/** Usuário como o client o vê: sem senha, sem chave crua do R2, com URL pronta. */
export type PublicUser = Omit<User, "password" | "avatarStorageKey"> & {
  avatarUrl: string | null;
};

/**
 * Deriva a URL pública do avatar a partir da chave do R2. Use esta função nos
 * pontos em que o objeto não é um `User` completo (projeções de `select`).
 */
export function toAvatarUrl(
  avatarStorageKey: string | null | undefined,
): string | null {
  return avatarStorageKey ? getPublicR2Url(avatarStorageKey) : null;
}

export function toPublicUser(user: User): PublicUser {
  const { password: _password, avatarStorageKey, ...rest } = user;
  return { ...rest, avatarUrl: toAvatarUrl(avatarStorageKey) };
}
