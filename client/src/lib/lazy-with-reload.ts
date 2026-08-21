import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

const RELOAD_KEY_PREFIX = "lazy-reload:";
const CHUNK_LOAD_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

interface ReloadStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LazyReloadRuntime {
  storage: ReloadStorage;
  reload(): void;
}

function getBrowserRuntime(): LazyReloadRuntime | null {
  try {
    return {
      storage: window.sessionStorage,
      reload: () => window.location.reload(),
    };
  } catch {
    return null;
  }
}

function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR_PATTERN.test(error.message);
}

export async function importWithReload<T>(
  key: string,
  importer: () => Promise<T>,
  runtime: LazyReloadRuntime | null = getBrowserRuntime(),
): Promise<T> {
  const reloadKey = `${RELOAD_KEY_PREFIX}${key}`;

  try {
    const importedModule = await importer();
    try {
      runtime?.storage.removeItem(reloadKey);
    } catch {
      // Storage pode ser bloqueado pelo navegador; o módulo já foi carregado.
    }
    return importedModule;
  } catch (error) {
    if (!isChunkLoadError(error) || !runtime) throw error;

    try {
      if (runtime.storage.getItem(reloadKey) === "1") throw error;
      runtime.storage.setItem(reloadKey, "1");
      runtime.reload();
    } catch {
      // Sem storage não há como garantir uma única tentativa de reload.
    }

    throw error;
  }
}

export function lazyWithReload<T extends ComponentType<unknown>>(
  key: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithReload(key, importer));
}
