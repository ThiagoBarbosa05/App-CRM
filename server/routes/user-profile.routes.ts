import { randomUUID } from "crypto";
import { Router } from "express";
import multer, { MulterError } from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { storage } from "../storage";
import { requireAuth } from "../middleware/validation";
import { r2, deleteR2Object } from "../lib/r2";
import { toAvatarUrl } from "../lib/user-serializer";

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

const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";

const upload = multer({ limits: { fileSize: AVATAR_MAX_BYTES } });

/**
 * Perfil do próprio usuário. Toda rota daqui opera sobre `req.user.userId` —
 * nenhum id vem do body ou da URL. É isso que garante que ninguém altera a foto
 * de outra pessoa.
 */
export const userProfileRouter = Router();

/** Apaga o objeto antigo sem derrubar o request: a foto nova já está gravada. */
async function removeOldAvatar(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await deleteR2Object(key);
  } catch (error) {
    console.error("Erro ao remover avatar anterior do R2:", error);
  }
}

userProfileRouter.post(
  "/me/avatar",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = req.user!.userId;

      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não fornecido" });
      }

      const validation = validateAvatarUpload(req.file.mimetype, req.file.size);
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message });
      }

      const previous = await storage.getUser(userId);
      const key = buildAvatarKey(userId);

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }),
      );

      await storage.updateUser(userId, { avatarStorageKey: key });
      await removeOldAvatar(previous?.avatarStorageKey);

      return res.json({ avatarUrl: toAvatarUrl(key) });
    } catch (error) {
      if (error instanceof MulterError) {
        return res.status(400).json({ message: "A imagem deve ter no máximo 5 MB." });
      }
      console.error("Erro ao atualizar foto de perfil:", error);
      return res.status(500).json({ message: "Erro ao atualizar foto de perfil" });
    }
  },
);

userProfileRouter.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const previous = await storage.getUser(userId);

    await storage.updateUser(userId, { avatarStorageKey: null });
    await removeOldAvatar(previous?.avatarStorageKey);

    return res.json({ avatarUrl: null });
  } catch (error) {
    console.error("Erro ao remover foto de perfil:", error);
    return res.status(500).json({ message: "Erro ao remover foto de perfil" });
  }
});
