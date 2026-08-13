import { randomUUID } from "crypto";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Valida o arquivo recebido antes de subir para o R2. Separada do handler para
 * ser testável sem banco nem Express.
 */
export function validateAvatarUpload(
  mimetype: string,
  size: number,
): { ok: true } | { ok: false; message: string } {
  if (!(AVATAR_ALLOWED_MIMES as readonly string[]).includes(mimetype)) {
    return { ok: false, message: "Formato inválido. Envie uma imagem JPEG, PNG ou WebP." };
  }
  if (size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "A imagem deve ter no máximo 5 MB." };
  }
  return { ok: true };
}

/** Chave do objeto no R2. Única por upload, então o CDN nunca serve foto velha. */
export function buildAvatarKey(userId: string): string {
  return `avatars/${userId}/${randomUUID()}`;
}
