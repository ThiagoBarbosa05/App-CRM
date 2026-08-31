const WHATSAPP_CHAT_BOTTOM_THRESHOLD_PX = 96;

interface WhatsappChatScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

interface WhatsappChatAutoScrollState {
  hasScrolledInitially: boolean;
  wasNearBottom: boolean;
}

export function isWhatsappChatNearBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}: WhatsappChatScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight <= WHATSAPP_CHAT_BOTTOM_THRESHOLD_PX;
}

export function getWhatsappChatAutoScrollBehavior({
  hasScrolledInitially,
  wasNearBottom,
}: WhatsappChatAutoScrollState): ScrollBehavior | null {
  if (!hasScrolledInitially) return "auto";
  return wasNearBottom ? "smooth" : null;
}
