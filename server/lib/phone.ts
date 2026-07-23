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
 * Confere se um número recebido é um auto-echo do MESMO canal que o recebeu —
 * ex.: dispositivo vinculado via Evolution/Baileys espelhando de volta uma
 * mensagem que o próprio número do canal enviou. Compara só contra o canal que
 * recebeu o evento, nunca contra os demais canais da empresa: um canal
 * diferente mandando mensagem de verdade para este número é uma conversa
 * legítima, não um eco. Puro (sem DB) para ser testável isoladamente.
 */
export function isSameChannelPhone(
  channelDisplayPhone: string | null | undefined,
  phone: string,
): boolean {
  if (!channelDisplayPhone) return false;
  const a = normalizePhone(channelDisplayPhone);
  const b = normalizePhone(phone);
  return a.digits === b.digits || a.digits === b.withoutCountry || a.withoutCountry === b.digits;
}
