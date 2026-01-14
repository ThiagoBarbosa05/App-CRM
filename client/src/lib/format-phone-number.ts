/**
 * Normaliza um celular brasileiro para o formato internacional com código do país.
 * Exemplos:
 *  - "(22) 98852-3633"   -> "+5522988523633"
 *  - "+55 (22) 98852-3633" -> "+5522988523633"
 *  - "22 98852 3633"     -> "+5522988523633"
 *  - "5522988523633"     -> "+5522988523633"
 */
export function formatPhoneToDigits(input: string): string {
  // Mantém apenas dígitos
  let digits = input.replace(/\D+/g, "");

  // Se não começar com 55, adiciona o código do país
  if (!digits.startsWith("55")) {
    // Verifica se tem pelo menos 10 dígitos (DDD + número)
    if (digits.length >= 10) {
      digits = "55" + digits;
    }
  }

  // Se tiver mais de 13 dígitos, pega os últimos 13 (55 + 11 dígitos)
  if (digits.length > 13) {
    digits = digits.slice(-13);
  }

  // Garante que tenha pelo menos o mínimo necessário (55 + DDD + número)
  if (digits.length < 12) {
    console.warn(`Número de telefone muito curto: ${input}`);
  }

  // Retorna com o prefixo +
  return "+" + digits;
}
