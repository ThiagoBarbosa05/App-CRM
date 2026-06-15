import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";

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
