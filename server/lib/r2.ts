import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";

// Domínio público que serve o bucket R2 (CDN Cloudflare). Usado para gerar
// URLs acessíveis externamente — ex.: links de mídia enviados ao Meta/WhatsApp.
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_URL || "https://eventos.grandcrub2b.com";

/** Monta a URL pública de um objeto do R2 a partir da sua chave (storageKey). */
export function getPublicR2Url(storageKey: string): string {
  return `${PUBLIC_BASE_URL.replace(/\/+$/, "")}/${storageKey.replace(/^\/+/, "")}`;
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Sobe uma mídia do WhatsApp para o R2 e retorna a chave do objeto (valor gravado em storageKey).
export async function uploadWhatsappMedia(
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const key = `whatsapp-media/${randomUUID()}`;
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return key;
}

// Busca o objeto de mídia do WhatsApp no R2 pela chave armazenada em storageKey.
export async function getWhatsappMediaObject(key: string) {
  return r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Sobe um arquivo da biblioteca de mídia para o R2 sob o prefixo media-library/
// e retorna a chave do objeto (storageKey).
export async function uploadMediaLibraryFile(
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const key = `media-library/${randomUUID()}`;
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return key;
}

// Remove um objeto do R2 pela sua chave (storageKey).
export async function deleteR2Object(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
