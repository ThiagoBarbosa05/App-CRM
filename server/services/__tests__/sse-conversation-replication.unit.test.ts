import { beforeEach, describe, expect, it, vi } from "vitest";

type NotificationHandler = (message: { channel: string; payload?: string }) => void;

const { notificationHandlers, queryMock } = vi.hoisted(() => ({
  notificationHandlers: [] as NotificationHandler[],
  queryMock: vi.fn(async () => undefined),
}));

vi.mock("@neondatabase/serverless", () => ({
  Pool: class {
    on = vi.fn();
    connect = vi.fn(async () => ({
      query: queryMock,
      on: (event: string, handler: NotificationHandler) => {
        if (event === "notification") notificationHandlers.push(handler);
      },
    }));
  },
}));

import {
  addConversationSseClient,
  registerConversationAccessChecker,
} from "../../lib/sse-hub";

function createResponse(): {
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} {
  return { write: vi.fn(), end: vi.fn() };
}

describe("replicação SSE por conversa", () => {
  beforeEach(() => {
    queryMock.mockClear();
  });

  it("entrega um evento remoto somente aos assinantes da conversa correspondente", () => {
    const targetResponse = createResponse();
    const otherResponse = createResponse();
    addConversationSseClient("conversation-a", "user-a", "vendedor", targetResponse as never);
    addConversationSseClient("conversation-b", "user-b", "vendedor", otherResponse as never);

    const handler = notificationHandlers[0];
    expect(handler).toBeDefined();
    handler({
      channel: "whatsapp_sse",
      payload: JSON.stringify({
        scope: "conversation",
        conversationId: "conversation-a",
        event: "new_message",
        data: { messageId: "message-1" },
        originInstanceId: "replica-remota",
      }),
    });

    expect(targetResponse.write).toHaveBeenCalledWith(
      'event: new_message\ndata: {"messageId":"message-1"}\n\n',
    );
    expect(otherResponse.write).not.toHaveBeenCalledWith(
      'event: new_message\ndata: {"messageId":"message-1"}\n\n',
    );
  });

  it("revoga localmente o stream que perde acesso após transferência remota", async () => {
    const response = createResponse();
    addConversationSseClient("conversation-transferred", "user-a", "vendedor", response as never);
    registerConversationAccessChecker(async () => false);

    const handler = notificationHandlers[0];
    handler({
      channel: "whatsapp_sse",
      payload: JSON.stringify({
        scope: "conversation_access_changed",
        conversationId: "conversation-transferred",
        originInstanceId: "replica-remota",
      }),
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(response.end).toHaveBeenCalledOnce();
    expect(response.write).toHaveBeenCalledWith("event: access_revoked\ndata: {}\n\n");
  });
});
