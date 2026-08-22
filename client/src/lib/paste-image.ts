import { format } from "date-fns";

/**
 * Imagem vinda da área de transferência (Ctrl+V de um screenshot, por exemplo).
 * Vive fora dos composers porque o chat do WhatsApp e o chat interno aplicam as
 * mesmas duas regras: achar a imagem no evento e normalizá-la antes de anexar.
 */

/** Subconjunto de `DataTransfer` que interessa aqui — permite testar sem DOM. */
export interface PastedClipboard {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<{
    kind: string;
    type: string;
    getAsFile(): File | null;
  }> | null;
}

/** Nomes que os navegadores dão a um screenshot colado — não vale a pena manter. */
const GENERIC_NAMES = new Set([
  "",
  "image",
  "image.png",
  "image.jpg",
  "image.jpeg",
  "image.webp",
  "blob",
]);

// O backend do WhatsApp reserva image/webp para FIGURINHA. Por isso, imagens
// comuns vindas do clipboard ou do clipe só passam direto nestes formatos;
// qualquer outro formato é reencodado em PNG antes de virar anexo.
const PASSTHROUGH_TYPES = new Set(["image/png", "image/jpeg"]);

export function extractPastedImage(
  clipboard: PastedClipboard | null | undefined,
): File | null {
  if (!clipboard) return null;

  const fromFiles = Array.from(clipboard.files ?? []).find((file) =>
    file.type.startsWith("image/"),
  );
  if (fromFiles) return fromFiles;

  // Safari e navegadores mais antigos populam apenas `items`.
  for (const item of Array.from(clipboard.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

export function pastedImageName(extension: string, now: Date = new Date()): string {
  return `screenshot-${format(now, "yyyy-MM-dd-HHmmss")}.${extension}`;
}

function isGenericName(name: string): boolean {
  return GENERIC_NAMES.has(name.trim().toLowerCase());
}

function convertedPngName(fileName: string, now: Date): string {
  if (isGenericName(fileName)) return pastedImageName("png", now);
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName}.png`;
}

/**
 * Garante um formato que os chats renderizam como imagem e um nome legível.
 * JPEG/PNG com nome próprio permanecem inalterados; outros formatos viram PNG.
 */
export async function normalizeChatImage(
  file: File,
  now: Date = new Date(),
): Promise<File> {
  if (PASSTHROUGH_TYPES.has(file.type)) {
    if (!isGenericName(file.name)) return file;
    const extension = file.type === "image/png" ? "png" : "jpg";
    return new File([file], pastedImageName(extension, now), { type: file.type });
  }
  return toPng(file, now);
}

async function toPng(file: File, now: Date): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D indisponível");
    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Falha ao converter a imagem para PNG");

    return new File([blob], convertedPngName(file.name, now), { type: "image/png" });
  } finally {
    bitmap.close();
  }
}
