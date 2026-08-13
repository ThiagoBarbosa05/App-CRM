/** Lado máximo do avatar depois da redução no client. */
export const AVATAR_MAX_DIMENSION = 512;

const JPEG_QUALITY = 0.85;

/**
 * Dimensões finais mantendo a proporção. Nunca amplia e nunca devolve zero.
 * Separada do canvas para ser testável no ambiente `node` do projeto `unit`.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxSize: number,
): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= maxSize) return { width, height };

  const ratio = maxSize / largest;
  return {
    width: Math.max(1, Math.ceil(width * ratio)),
    height: Math.max(1, Math.ceil(height * ratio)),
  };
}

/**
 * Reduz a imagem para no máximo `maxSize` px de lado e devolve um jpeg. Evita
 * subir 8 MB de foto de celular para exibir um avatar de 40 px — e é por isso
 * que o servidor não precisa de `sharp`.
 */
export async function resizeImageFile(
  file: File,
  maxSize: number = AVATAR_MAX_DIMENSION,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const target = computeResizedDimensions(bitmap.width, bitmap.height, maxSize);

  if (target.width === bitmap.width && target.height === bitmap.height) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  return blob ?? file;
}
