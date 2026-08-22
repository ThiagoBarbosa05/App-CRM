interface RecoverableMediaSendOptions {
  key: string;
  send: () => Promise<boolean>;
  clearMedia: () => void;
}

const recoverableMediaDrafts = new Map<string, unknown>();
const recoverableMediaUploads = new Set<string>();
const recoverableMediaListeners = new Map<string, Set<() => void>>();

function notifyRecoverableMediaListeners(key: string): void {
  recoverableMediaListeners.get(key)?.forEach((listener) => listener());
}

export function saveRecoverableMediaDraft<T>(key: string, draft: T): void {
  recoverableMediaDrafts.set(key, draft);
  notifyRecoverableMediaListeners(key);
}

export function getRecoverableMediaDraft<T>(key: string): T | undefined {
  return recoverableMediaDrafts.get(key) as T | undefined;
}

export function deleteRecoverableMediaDraft(key: string): void {
  recoverableMediaDrafts.delete(key);
  notifyRecoverableMediaListeners(key);
}

export function isRecoverableMediaUploading(key: string): boolean {
  return recoverableMediaUploads.has(key);
}

export function subscribeRecoverableMediaState(
  key: string,
  listener: () => void,
): () => void {
  const listeners = recoverableMediaListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  recoverableMediaListeners.set(key, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) recoverableMediaListeners.delete(key);
  };
}

/**
 * Preserva a mídia local enquanto o servidor não confirmar o envio.
 * O chamador continua responsável por apresentar o erro da operação.
 */
export async function sendRecoverableMedia({
  key,
  send,
  clearMedia,
}: RecoverableMediaSendOptions): Promise<boolean> {
  if (recoverableMediaUploads.has(key)) return false;
  recoverableMediaUploads.add(key);
  notifyRecoverableMediaListeners(key);

  try {
    const sent = await send();
    if (sent) clearMedia();
    return sent;
  } finally {
    recoverableMediaUploads.delete(key);
    notifyRecoverableMediaListeners(key);
  }
}
