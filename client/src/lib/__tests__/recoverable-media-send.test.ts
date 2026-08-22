import { describe, expect, it, vi } from "vitest";

import {
  deleteRecoverableMediaDraft,
  getRecoverableMediaDraft,
  saveRecoverableMediaDraft,
  sendRecoverableMedia,
} from "@/lib/recoverable-media-send";

describe("sendRecoverableMedia", () => {
  it("mantém a mídia disponível quando o envio informa falha", async () => {
    const clearMedia = vi.fn();

    const sent = await sendRecoverableMedia({
      key: "failure-result",
      send: async () => false,
      clearMedia,
    });

    expect(sent).toBe(false);
    expect(clearMedia).not.toHaveBeenCalled();
  });

  it("mantém a mídia disponível quando o envio lança um erro", async () => {
    const clearMedia = vi.fn();

    await expect(
      sendRecoverableMedia({
        key: "failure-error",
        send: async () => {
          throw new Error("rede indisponível");
        },
        clearMedia,
      }),
    ).rejects.toThrow("rede indisponível");

    expect(clearMedia).not.toHaveBeenCalled();
  });

  it("limpa a mídia somente depois de um envio confirmado", async () => {
    const clearMedia = vi.fn();

    const sent = await sendRecoverableMedia({
      key: "success",
      send: async () => true,
      clearMedia,
    });

    expect(sent).toBe(true);
    expect(clearMedia).toHaveBeenCalledOnce();
  });

  it("ignora uma segunda tentativa enquanto a primeira ainda está em andamento", async () => {
    let finishUpload: ((sent: boolean) => void) | undefined;
    const send = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishUpload = resolve;
        }),
    );

    const firstAttempt = sendRecoverableMedia({
      key: "same-conversation",
      send,
      clearMedia: vi.fn(),
    });
    const secondAttempt = sendRecoverableMedia({
      key: "same-conversation",
      send,
      clearMedia: vi.fn(),
    });

    expect(await secondAttempt).toBe(false);
    expect(send).toHaveBeenCalledOnce();
    finishUpload?.(false);
    await firstAttempt;
  });
});

describe("rascunho recuperável de mídia", () => {
  it("restaura o rascunho pela conversa até o descarte explícito", () => {
    const draft = { id: "audio-local" };

    saveRecoverableMediaDraft("conversation-1", draft);

    expect(getRecoverableMediaDraft("conversation-1")).toBe(draft);
    deleteRecoverableMediaDraft("conversation-1");
    expect(getRecoverableMediaDraft("conversation-1")).toBeUndefined();
  });
});
