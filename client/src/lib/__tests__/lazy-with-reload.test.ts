import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppErrorFallback } from "@/components/app-error-boundary";
import {
  importWithReload,
  type LazyReloadRuntime,
} from "../lazy-with-reload";

function createRuntime(initialEntries: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initialEntries));
  const runtime: LazyReloadRuntime = {
    storage: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
    reload: vi.fn(),
  };

  return { entries, runtime };
}

describe("importWithReload", () => {
  it("resolve o módulo e limpa uma tentativa anterior bem-sucedida", async () => {
    const { entries, runtime } = createRuntime({
      "lazy-reload:conversations": "1",
    });
    const module = { default: () => null };

    await expect(
      importWithReload("conversations", async () => module, runtime),
    ).resolves.toBe(module);
    expect(entries.has("lazy-reload:conversations")).toBe(false);
    expect(runtime.reload).not.toHaveBeenCalled();
  });

  it("marca e recarrega uma vez quando um chunk dinâmico não existe mais", async () => {
    const { entries, runtime } = createRuntime();
    const error = new TypeError(
      "Failed to fetch dynamically imported module: /assets/conversations-old.js",
    );

    await expect(
      importWithReload("conversations", async () => {
        throw error;
      }, runtime),
    ).rejects.toBe(error);
    expect(entries.get("lazy-reload:conversations")).toBe("1");
    expect(runtime.reload).toHaveBeenCalledOnce();
  });

  it("não entra em loop quando o mesmo módulo falha após a recarga", async () => {
    const { runtime } = createRuntime({ "lazy-reload:conversations": "1" });
    const error = new TypeError("Importing a module script failed");

    await expect(
      importWithReload("conversations", async () => {
        throw error;
      }, runtime),
    ).rejects.toBe(error);
    expect(runtime.reload).not.toHaveBeenCalled();
  });

  it("propaga erros que não são falhas de carregamento de chunk", async () => {
    const { runtime } = createRuntime();
    const error = new Error("Erro ao inicializar a página");

    await expect(
      importWithReload("conversations", async () => {
        throw error;
      }, runtime),
    ).rejects.toBe(error);
    expect(runtime.reload).not.toHaveBeenCalled();
  });

  it("não recarrega quando o sessionStorage está indisponível", async () => {
    const error = new TypeError("error loading dynamically imported module");
    const runtime: LazyReloadRuntime = {
      storage: {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      reload: vi.fn(),
    };

    await expect(
      importWithReload("conversations", async () => {
        throw error;
      }, runtime),
    ).rejects.toBe(error);
    expect(runtime.reload).not.toHaveBeenCalled();
  });
});

describe("AppErrorFallback", () => {
  it("oferece uma saída visível quando uma página lazy continua falhando", () => {
    const html = renderToStaticMarkup(
      createElement(AppErrorFallback, { onReload: () => undefined }),
    );

    expect(html).toContain("Não foi possível carregar esta página");
    expect(html).toContain("Atualizar página");
  });
});
