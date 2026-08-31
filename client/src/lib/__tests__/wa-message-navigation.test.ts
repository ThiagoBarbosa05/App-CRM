import { describe, expect, it } from "vitest";

import { navigateToWhatsappMessage } from "@/lib/wa-message-navigation";

interface TestPage {
  messages: Array<{ id: string }>;
}

describe("navigateToWhatsappMessage", () => {
  it("focaliza imediatamente uma mensagem que já está no histórico carregado", async () => {
    const events: string[] = [];

    const result = await navigateToWhatsappMessage<TestPage>({
      messageId: "original-1",
      isMessageLoaded: (messageId) => messageId === "original-1",
      loadMessageContext: async () => {
        events.push("load-context");
        return null;
      },
      replaceHistory: () => events.push("replace-history"),
      focusMessage: (messageId) => events.push(`focus:${messageId}`),
    });

    expect(result).toBe("focused");
    expect(events).toEqual(["focus:original-1"]);
  });

  it("carrega o contexto antes de focalizar uma mensagem fora da página atual", async () => {
    const events: string[] = [];
    const context: TestPage = { messages: [{ id: "original-2" }] };

    const result = await navigateToWhatsappMessage<TestPage>({
      messageId: "original-2",
      isMessageLoaded: () => false,
      loadMessageContext: async (messageId) => {
        events.push(`load:${messageId}`);
        return context;
      },
      replaceHistory: (loadedContext) => {
        expect(loadedContext).toBe(context);
        events.push("replace-history");
      },
      focusMessage: (messageId) => events.push(`focus:${messageId}`),
    });

    expect(result).toBe("loaded");
    expect(events).toEqual([
      "load:original-2",
      "replace-history",
      "focus:original-2",
    ]);
  });

  it("informa indisponibilidade sem alterar o histórico quando o contexto não existe", async () => {
    const events: string[] = [];

    const result = await navigateToWhatsappMessage<TestPage>({
      messageId: "deleted-message",
      isMessageLoaded: () => false,
      loadMessageContext: async () => null,
      replaceHistory: () => events.push("replace-history"),
      focusMessage: () => events.push("focus"),
    });

    expect(result).toBe("unavailable");
    expect(events).toEqual([]);
  });
});
