import { afterEach, describe, it, expect, vi } from "vitest";
import {
  extractPastedImage,
  normalizeChatImage,
  pastedImageName,
  type PastedClipboard,
} from "@/lib/paste-image";

function fakeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

function clipboardItem(file: File | null, kind = "file") {
  return { kind, type: file?.type ?? "text/plain", getAsFile: () => file };
}

describe("extractPastedImage", () => {
  it("pega a primeira imagem de clipboardData.files", () => {
    const image = fakeFile("image.png", "image/png");
    const clipboard: PastedClipboard = {
      files: [fakeFile("nota.txt", "text/plain"), image],
    };

    expect(extractPastedImage(clipboard)).toBe(image);
  });

  it("cai para items quando files vem vazio (Safari)", () => {
    const image = fakeFile("image.png", "image/png");
    const clipboard: PastedClipboard = {
      files: [],
      items: [clipboardItem(fakeFile("t.txt", "text/plain")), clipboardItem(image)],
    };

    expect(extractPastedImage(clipboard)).toBe(image);
  });

  it("ignora items que não são arquivo", () => {
    // Colar texto simples produz um item kind="string" com type image/* em
    // alguns navegadores; sem o filtro de kind isso viraria um anexo fantasma.
    const clipboard: PastedClipboard = {
      items: [{ kind: "string", type: "image/png", getAsFile: () => null }],
    };

    expect(extractPastedImage(clipboard)).toBeNull();
  });

  it("devolve null sem imagem, sem clipboard e com getAsFile vazio", () => {
    expect(extractPastedImage(null)).toBeNull();
    expect(extractPastedImage({})).toBeNull();
    expect(extractPastedImage({ files: [fakeFile("a.txt", "text/plain")] })).toBeNull();
    expect(extractPastedImage({ items: [clipboardItem(null)] })).toBeNull();
  });
});

describe("pastedImageName", () => {
  it("usa data e hora locais", () => {
    expect(pastedImageName("png", new Date(2026, 7, 4, 9, 5, 3))).toBe(
      "screenshot-2026-08-04-090503.png",
    );
  });
});

describe("normalizeChatImage", () => {
  const now = new Date(2026, 7, 4, 9, 5, 3);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renomeia PNG com nome genérico do navegador", async () => {
    const result = await normalizeChatImage(fakeFile("image.png", "image/png"), now);

    expect(result.name).toBe("screenshot-2026-08-04-090503.png");
    expect(result.type).toBe("image/png");
  });

  it("usa extensão jpg para JPEG colado", async () => {
    const result = await normalizeChatImage(fakeFile("", "image/jpeg"), now);

    expect(result.name).toBe("screenshot-2026-08-04-090503.jpg");
  });

  it("preserva o nome de um arquivo copiado do explorador", async () => {
    const original = fakeFile("orcamento-final.png", "image/png");

    expect(await normalizeChatImage(original, now)).toBe(original);
  });

  it("converte WEBP anexado em PNG com nome coerente", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 10, height: 20, close })));
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(["png"], { type: "image/png" })),
      })),
    });

    const result = await normalizeChatImage(fakeFile("foto.webp", "image/webp"), now);

    expect(result.name).toBe("foto.png");
    expect(result.type).toBe("image/png");
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("propaga falha quando o canvas não consegue gerar o PNG", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 10, height: 20, close })));
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: (blob: Blob | null) => void) => callback(null),
      })),
    });

    await expect(
      normalizeChatImage(fakeFile("foto.webp", "image/webp"), now),
    ).rejects.toThrow("Falha ao converter a imagem para PNG");
    expect(close).toHaveBeenCalledOnce();
  });
});
