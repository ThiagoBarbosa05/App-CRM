// Registro global de "o usuário está na página de conversas do WhatsApp".
// Usado por useWhatsAppNotifications (montado em layouts fora da página) para
// suprimir toast/som de mensagens novas: a lista na própria página já
// atualiza em tempo real (badge, negrito, preview), então notificar de novo
// seria ruído redundante.
let onConversationsPage = false;

export function setOnWaConversationsPage(value: boolean) {
  onConversationsPage = value;
}

export function isOnWaConversationsPage() {
  return onConversationsPage;
}
