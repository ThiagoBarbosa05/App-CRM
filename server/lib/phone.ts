/**
 * Normaliza um telefone em duas formas comparáveis: `digits` (só dígitos, com
 * DDI se houver) e `withoutCountry` (sem o DDI 55 quando presente). Comparar por
 * ambas evita falsos negativos quando um lado está cadastrado com o `55` e o
 * outro sem — ex.: `displayPhone` de canal salvo como `21989014965` vs. o JID do
 * WhatsApp que sempre traz `5521989014965`.
 */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return { digits, withoutCountry };
}

/**
 * Confere se um número recebido bate com o de algum canal próprio da empresa,
 * comparando ambas as formas normalizadas (com e sem DDI 55) contra o conjunto
 * produzido por `getOwnChannelPhones()`. Use nos webhooks de inbound para
 * descartar echos do próprio número (ver whatsapp-baileys-events /
 * whatsapp-webhook). Puro (sem DB) para ser testável isoladamente.
 */
export function isOwnChannelPhone(ownPhones: Set<string>, phone: string): boolean {
  const { digits, withoutCountry } = normalizePhone(phone);
  return ownPhones.has(digits) || ownPhones.has(withoutCountry);
}
