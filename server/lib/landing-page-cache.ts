const TTL_MS = 5 * 60 * 1000; // 5 minutos (igual ao Cache-Control da rota)

interface CacheEntry {
  html: Buffer;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedPage(slug: string): Buffer | null {
  const entry = cache.get(slug);
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(slug);
    return null;
  }
  return entry.html;
}

export function setCachedPage(slug: string, html: Buffer): void {
  cache.set(slug, { html, expiresAt: Date.now() + TTL_MS });
}

export function invalidateCachedPage(slug: string): void {
  cache.delete(slug);
}
