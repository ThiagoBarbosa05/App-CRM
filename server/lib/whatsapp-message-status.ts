type WhatsappMessageStatus = "failed" | "sent" | "delivered" | "read";

export const SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES: WhatsappMessageStatus[] = [
  "failed",
  "sent",
];

/**
 * A confirmação assíncrona do provedor só pode promover a linha local que
 * ainda está no estado inicial. Estados de entrega/leitura são mais avançados
 * e nunca podem regredir para `sent`.
 */
export function canConfirmMessageAsSent(
  currentStatus: string | null,
  statusReason: string | null,
): boolean {
  return statusReason === null
    && SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES.includes(currentStatus as WhatsappMessageStatus);
}
