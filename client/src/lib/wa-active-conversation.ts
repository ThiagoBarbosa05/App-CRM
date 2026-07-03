// Registro global da conversa WhatsApp atualmente aberta na página de
// conversas. Usado por useWhatsAppNotifications (montado em layouts fora da
// página) para suprimir toast/som quando a mensagem é da conversa em foco.
export interface ActiveWaConversation {
  clientId: string | null;
  conversationId: string | null;
}

let active: ActiveWaConversation | null = null;

export function setActiveWaConversation(value: ActiveWaConversation | null) {
  active = value;
}

export function getActiveWaConversation() {
  return active;
}
