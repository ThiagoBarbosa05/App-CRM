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
  contactNotFound: "Contato não encontrado",
} as const;

export type CampaignSuppressionCategory =
  | "duplicate_content"
  | "tags_changed"
  | "opted_out"
  | "invalid_phone"
  | "other";

/**
 * Categoria de cada motivo conhecido, por correspondência exata.
 *
 * É a fonte da classificação. O match por substring (abaixo) virou apenas
 * fallback para as linhas gravadas antes desta tabela existir — ele quebrava
 * a cada ajuste de redação, já que bastava alguém reescrever a frase para o
 * contador da tela mudar de categoria sem ninguém perceber.
 */
const REASON_CATEGORY: Record<string, CampaignSuppressionCategory> = {
  [CAMPAIGN_SUPPRESSION_REASONS.optedOut]: "opted_out",
  [CAMPAIGN_SUPPRESSION_REASONS.invalidPhone]: "invalid_phone",
  [CAMPAIGN_SUPPRESSION_REASONS.duplicatePhoneInAudience]: "invalid_phone",
  [CAMPAIGN_SUPPRESSION_REASONS.invalidOrChangedPhone]: "invalid_phone",
  [CAMPAIGN_SUPPRESSION_REASONS.tagsChanged]: "tags_changed",
  [CAMPAIGN_SUPPRESSION_REASONS.duplicateContent]: "duplicate_content",
  [CAMPAIGN_SUPPRESSION_REASONS.contactNotFound]: "other",
};

/**
 * Classifica um `suppressionReason` em uma categoria estável, usada para
 * agrupar contadores na UI.
 *
 * Motivos conhecidos resolvem por igualdade. O resto cai no match por
 * substring que existia antes — incluindo a checagem duplicada com/sem acento
 * em "idêntica", mantida porque linhas antigas podem depender dela.
 */
export function classifySuppressionReason(
  reason: string | null | undefined,
): CampaignSuppressionCategory {
  const value = reason ?? "";
  if (!value) return "other";

  const known = REASON_CATEGORY[value];
  if (known) return known;

  // Legado: linhas gravadas com redação anterior à tabela acima.
  if (value.includes("idêntica") || value.includes("identica")) return "duplicate_content";
  if (value.includes("Etiquetas alteradas")) return "tags_changed";
  if (value.toLowerCase().includes("opt-out")) return "opted_out";
  if (value.toLowerCase().includes("telefone")) return "invalid_phone";
  return "other";
}
