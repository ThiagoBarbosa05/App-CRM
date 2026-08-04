import { describe, it, expect } from "vitest";
import {
  extractPastedImage,
  normalizePastedImage,
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

describe("normalizePastedImage", () => {
  const now = new Date(2026, 7, 4, 9, 5, 3);

  it("renomeia PNG com nome genérico do navegador", async () => {
    const result = await normalizePastedImage(fakeFile("image.png", "image/png"), now);

    expect(result.name).toBe("screenshot-2026-08-04-090503.png");
    expect(result.type).toBe("image/png");
  });

  it("usa extensão jpg para JPEG colado", async () => {
    const result = await normalizePastedImage(fakeFile("", "image/jpeg"), now);

    expect(result.name).toBe("screenshot-2026-08-04-090503.jpg");
  });

  it("preserva o nome de um arquivo copiado do explorador", async () => {
    const original = fakeFile("orcamento-final.png", "image/png");

    expect(await normalizePastedImage(original, now)).toBe(original);
  });
});
