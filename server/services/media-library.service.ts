import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "../db";
import { mediaLibrary, type MediaLibraryItem } from "@shared/schema";
import {
  uploadMediaLibraryFile,
  deleteR2Object,
  getPublicR2Url,
} from "../lib/r2";

export type MediaType = "image" | "video" | "document";

// Item da biblioteca já com a URL pública derivada (não persistida no banco).
export type MediaLibraryItemWithUrl = MediaLibraryItem & { url: string };

function mediaTypeFromMime(mime: string): MediaType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function withUrl(row: MediaLibraryItem): MediaLibraryItemWithUrl {
  return { ...row, url: getPublicR2Url(row.storageKey) };
}

export async function listMediaLibrary(params: {
  type?: MediaType;
  search?: string;
}): Promise<MediaLibraryItemWithUrl[]> {
  const filters: SQL[] = [];
  if (params.type) filters.push(eq(mediaLibrary.mediaType, params.type));
  if (params.search && params.search.trim()) {
    filters.push(ilike(mediaLibrary.name, `%${params.search.trim()}%`));
  }

  const rows = await db
    .select()
    .from(mediaLibrary)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(mediaLibrary.createdAt));

  return rows.map(withUrl);
}

export async function createMediaLibraryItem(params: {
  buffer: Buffer;
  mimeType: string;
  name: string;
  userId?: string;
}): Promise<MediaLibraryItemWithUrl> {
  const storageKey = await uploadMediaLibraryFile(params.buffer, params.mimeType);

  const [row] = await db
    .insert(mediaLibrary)
    .values({
      name: params.name,
      storageKey,
      mediaType: mediaTypeFromMime(params.mimeType),
      mimeType: params.mimeType,
      size: params.buffer.length,
      createdBy: params.userId,
    })
    .returning();

  return withUrl(row);
}

export async function deleteMediaLibraryItem(id: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(mediaLibrary)
    .where(eq(mediaLibrary.id, id))
    .limit(1);
  if (!row) return false;

  // Remove primeiro do banco; o objeto no R2 é melhor-esforço (pode já não existir).
  await db.delete(mediaLibrary).where(eq(mediaLibrary.id, id));
  try {
    await deleteR2Object(row.storageKey);
  } catch (err) {
    console.error("[Media Library] Falha ao remover objeto do R2:", err);
  }
  return true;
}
