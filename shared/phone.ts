/**
 * Normaliza um telefone brasileiro para E.164 (+55DDDNÚMERO).
 * Aceita entradas com/sem +55, com formatação (parênteses, espaços, traços),
 * com zero inicial, e no formato antigo de celular (8 dígitos, sem o "9").
 * Retorna null quando a entrada não tem dígitos suficientes para ser um
 * telefone brasileiro válido (DDD + fixo de 8 dígitos ou celular de 9 dígitos).
 */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Remove o código do país (55) se presente, para tratar DDD+número isoladamente.
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  // Remove zero inicial no DDD (erro comum de digitação, ex: "022...").
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Formato antigo de celular (DDD + 8 dígitos, sem o "9" na frente) — insere o "9"
  // quando o número parece celular (começa com 6-9, padrão brasileiro).
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    if (/^[6-9]/.test(number)) {
      digits = `${ddd}9${number}`;
    }
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return null;
  }

  return `+55${digits}`;
}

/**
 * Converte um telefone para o formato que a Meta Cloud API espera no campo "to":
 * apenas dígitos, sem "+" (confirmado na doc oficial — payloads de webhook trazem
 * wa_id sem "+", ex: "13557825698"). Normaliza primeiro via normalizePhoneE164
 * para lidar com formatação/DDI ausente; se a normalização falhar (número fora
 * do padrão BR), cai para uma extração simples de dígitos.
 */
export function toMetaWhatsAppId(phone: string): string {
  const normalized = normalizePhoneE164(phone);
  return normalized ? normalized.slice(1) : phone.replace(/\D/g, "");
}
