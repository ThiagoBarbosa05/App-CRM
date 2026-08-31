export type WhatsappMessageNavigationResult =
  | "focused"
  | "loaded"
  | "unavailable";

interface NavigateToWhatsappMessageOptions<TContext> {
  messageId: string;
  isMessageLoaded: (messageId: string) => boolean;
  loadMessageContext: (messageId: string) => Promise<TContext | null>;
  replaceHistory: (context: TContext) => void;
  focusMessage: (messageId: string) => void;
}

export async function navigateToWhatsappMessage<TContext>({
  messageId,
  isMessageLoaded,
  loadMessageContext,
  replaceHistory,
  focusMessage,
}: NavigateToWhatsappMessageOptions<TContext>): Promise<WhatsappMessageNavigationResult> {
  if (isMessageLoaded(messageId)) {
    focusMessage(messageId);
    return "focused";
  }

  const context = await loadMessageContext(messageId);
  if (!context) return "unavailable";

  replaceHistory(context);
  focusMessage(messageId);
  return "loaded";
}
