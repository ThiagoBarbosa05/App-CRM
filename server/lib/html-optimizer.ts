import { gunzipSync } from "zlib";

interface ManifestEntry {
  mime: string;
  data: string;
  compressed: boolean;
}

type Manifest = Record<string, ManifestEntry>;

function extractScriptContent(html: string, type: string): string | null {
  // Escapa caracteres especiais de regex no tipo
  const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Casa apenas a tag de abertura real — não strings dentro de código JS
  const tagRe = new RegExp(`<script[^>]*type="${escapedType}"[^>]*>`, "i");
  const match = tagRe.exec(html);
  if (!match) return null;
  const contentStart = match.index + match[0].length;
  const contentEnd = html.indexOf("</script>", contentStart);
  if (contentEnd === -1) return null;
  return html.slice(contentStart, contentEnd);
}

function toDataUrl(entry: ManifestEntry): string {
  let bytes = Buffer.from(entry.data, "base64");
  if (entry.compressed) {
    try {
      bytes = gunzipSync(bytes);
    } catch {
      // use compressed bytes as-is
    }
  }
  return `data:${entry.mime};base64,${bytes.toString("base64")}`;
}

/**
 * Detecta HTML gerado pelo Claude Design (bundler com __bundler/manifest) e
 * processa server-side: substitui UUIDs por data URLs, remove overhead de
 * unpack em runtime e garante viewport mobile correto.
 *
 * Para qualquer outro HTML, retorna o buffer original sem alterações.
 */
export function optimizeHtml(buffer: Buffer): Buffer {
  const html = buffer.toString("utf-8");

  if (!html.includes("__bundler/manifest")) {
    return ensureViewport(buffer);
  }

  try {
    const manifestRaw = extractScriptContent(html, "__bundler/manifest");
    const templateRaw = extractScriptContent(html, "__bundler/template");

    if (!manifestRaw || !templateRaw) return buffer;

    const manifest = JSON.parse(manifestRaw) as Manifest;
    let template = JSON.parse(templateRaw) as string;

    // Pré-computa data URLs uma vez por UUID
    const dataUrls: Record<string, string> = {};
    for (const [uuid, entry] of Object.entries(manifest)) {
      dataUrls[uuid] = toDataUrl(entry);
    }

    // Substitui todos os UUIDs no template
    for (const [uuid, dataUrl] of Object.entries(dataUrls)) {
      template = template.split(uuid).join(dataUrl);
    }

    // Injeta window.__resources para scripts que dependem dele
    const extRaw = extractScriptContent(html, "__bundler/ext_resources");
    if (extRaw) {
      const extResources = JSON.parse(extRaw) as Array<{
        uuid: string;
        id: string;
      }>;
      const resourceMap: Record<string, string> = {};
      for (const entry of extResources) {
        if (dataUrls[entry.uuid]) {
          resourceMap[entry.id] = dataUrls[entry.uuid];
        }
      }
      const injection = `<script>window.__resources=${JSON.stringify(resourceMap).replace(/<\/script>/gi, "<\\/script>")};</script>`;
      template = template.includes("</head>")
        ? template.replace("</head>", injection + "</head>")
        : injection + template;
    }

    // Remove atributos SRI/CORS desnecessários com data URLs
    template = template
      .replace(/\s+integrity="[^"]*"/gi, "")
      .replace(/\s+crossorigin="[^"]*"/gi, "");

    return ensureViewport(Buffer.from(template, "utf-8"));
  } catch (err) {
    console.error("[html-optimizer] Falha ao otimizar HTML, usando original:", err);
    return buffer;
  }
}

function ensureViewport(buffer: Buffer): Buffer {
  const html = buffer.toString("utf-8");
  if (html.includes('name="viewport"')) return buffer;
  const patched = html.replace(
    /<head([^>]*)>/i,
    '<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1">',
  );
  return Buffer.from(patched, "utf-8");
}
