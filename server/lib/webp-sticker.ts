export interface WebpStickerMetadata {
  animated: boolean;
  width: number;
  height: number;
}

export type WebpInspectionResult =
  | { valid: true; metadata: WebpStickerMetadata }
  | { valid: false; reason: string };

function readUint24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

/**
 * Inspeciona somente o contêiner/cabeçalhos WebP necessários para validar uma
 * figurinha. Não decodifica nem reencoda os frames, preservando a animação.
 */
export function inspectWebpSticker(buffer: Buffer): WebpInspectionResult {
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return { valid: false, reason: "O arquivo enviado não é um WebP válido" };
  }

  const declaredSize = buffer.readUInt32LE(4) + 8;
  if (declaredSize > buffer.length) {
    return { valid: false, reason: "O arquivo WebP está incompleto ou corrompido" };
  }

  let offset = 12;
  let width: number | null = null;
  let height: number | null = null;
  let animated = false;
  let hasImageData = false;

  while (offset + 8 <= declaredSize) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const chunkEnd = dataOffset + chunkSize;
    if (chunkEnd > declaredSize || chunkEnd > buffer.length) {
      return { valid: false, reason: "O arquivo WebP está incompleto ou corrompido" };
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      animated = animated || (buffer[dataOffset] & 0x02) !== 0;
      width = readUint24LE(buffer, dataOffset + 4) + 1;
      height = readUint24LE(buffer, dataOffset + 7) + 1;
    } else if (chunkType === "VP8 " && chunkSize >= 10 && width === null) {
      if (
        buffer[dataOffset + 3] !== 0x9d ||
        buffer[dataOffset + 4] !== 0x01 ||
        buffer[dataOffset + 5] !== 0x2a
      ) {
        return { valid: false, reason: "O arquivo WebP possui um quadro inválido" };
      }
      width = buffer.readUInt16LE(dataOffset + 6) & 0x3fff;
      height = buffer.readUInt16LE(dataOffset + 8) & 0x3fff;
      hasImageData = true;
    } else if (chunkType === "VP8L" && chunkSize >= 5 && width === null) {
      if (buffer[dataOffset] !== 0x2f) {
        return { valid: false, reason: "O arquivo WebP possui um quadro inválido" };
      }
      const dimensions = buffer.readUInt32LE(dataOffset + 1);
      width = (dimensions & 0x3fff) + 1;
      height = ((dimensions >>> 14) & 0x3fff) + 1;
      hasImageData = true;
    } else if (chunkType === "ANIM" || chunkType === "ANMF") {
      animated = true;
      if (chunkType === "ANMF") hasImageData = true;
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (width === null || height === null || width <= 0 || height <= 0 || !hasImageData) {
    return { valid: false, reason: "Não foi possível identificar as dimensões do WebP" };
  }

  return { valid: true, metadata: { animated, width, height } };
}
