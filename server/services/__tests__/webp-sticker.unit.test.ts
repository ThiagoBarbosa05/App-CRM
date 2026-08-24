import { describe, expect, it } from "vitest";
import { inspectWebpSticker } from "../../lib/webp-sticker";

function chunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type, 0, "ascii");
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function webp(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from("WEBP", "ascii"), ...chunks]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function vp8x(animated: boolean, width = 512, height = 512): Buffer {
  const data = Buffer.alloc(10);
  if (animated) data[0] = 0x02;
  data.writeUIntLE(width - 1, 4, 3);
  data.writeUIntLE(height - 1, 7, 3);
  return chunk("VP8X", data);
}

describe("inspectWebpSticker", () => {
  it("detecta dimensões e animação sem alterar os bytes", () => {
    const buffer = webp(vp8x(true), chunk("ANIM", Buffer.alloc(6)), chunk("ANMF", Buffer.alloc(16)));

    expect(inspectWebpSticker(buffer)).toEqual({
      valid: true,
      metadata: { animated: true, width: 512, height: 512 },
    });
  });

  it("detecta figurinha estática lossless", () => {
    const dimensions = (511 | (511 << 14)) >>> 0;
    const frame = Buffer.alloc(5);
    frame[0] = 0x2f;
    frame.writeUInt32LE(dimensions, 1);

    expect(inspectWebpSticker(webp(chunk("VP8L", frame)))).toEqual({
      valid: true,
      metadata: { animated: false, width: 512, height: 512 },
    });
  });

  it("rejeita MIME WebP falso e arquivo truncado", () => {
    expect(inspectWebpSticker(Buffer.from("not-webp"))).toMatchObject({ valid: false });

    const truncated = webp(vp8x(true), chunk("ANMF", Buffer.alloc(16)));
    truncated.writeUInt32LE(truncated.length + 100, 4);
    expect(inspectWebpSticker(truncated)).toMatchObject({ valid: false });
  });
});
