/**
 * Motivos de supressão de mensagens de campanha do WhatsApp
 * (`whatsapp_campaign_messages.suppressionReason`), compartilhados entre
 * backend (que grava o texto) e frontend (que reclassifica o texto em
 * categorias visuais). Manter as strings centralizadas aqui evita que os
 * dois lados divirjam silenciosamente.
 */
export const CAMPAIGN_SUPPRESSION_REASONS = {
  optedOut: "Opt-out de campanhas do WhatsApp",
  invalidPhone: "Telefone inválido",
  duplicatePhoneInAudience: "Telefone duplicado na audiência",
  invalidOrChangedPhone: "Telefone inválido ou alterado após o agendamento",
  tagsChanged: "Etiquetas alteradas: contato não corresponde mais à segmentação da campanha",
  duplicateContent: "Mensagem idêntica dentro da janela de proteção",
} as const;

export type CampaignSuppressionCategory =
  | "duplicate_content"
  | "tags_changed"
  | "opted_out"
  | "invalid_phone"
  | "other";

/**
 * Classifica um `suppressionReason` livre em uma categoria estável, usada
 * para agrupar contadores na UI. Replica exatamente a lógica que antes
 * vivia inline em `client/src/pages/whatsapp/campaign-details.tsx`,
 * incluindo a checagem duplicada com/sem acento em "idêntica" — a variante
 * sem acento nunca bate na prática (a única string real usada hoje tem
 * acento), mas é mantida para não alterar comportamento observável.
 */
export function classifySuppressionReason(
  reason: string | null | undefined,
): CampaignSuppressionCategory {
  const value = reason ?? "";
  if (!value) return "other";
  if (value.includes("idêntica") || value.includes("identica")) return "duplicate_content";
  if (value.includes("Etiquetas alteradas")) return "tags_changed";
  if (value.toLowerCase().includes("opt-out")) return "opted_out";
  if (value.toLowerCase().includes("telefone")) return "invalid_phone";
  return "other";
}
