/**
 * Normaliza um celular brasileiro para apenas dígitos com DDD.
 * Exemplos:
 *  - "(22) 98852-3633"   -> "22988523633"
 *  - "+55 (22) 98852-3633" -> "22988523633" (remove o +55)
 *  - "22 98852 3633"     -> "22988523633"
 */
export function formatPhoneToDigits(input: string): string {
  // Mantém apenas dígitos
  let digits = input.replace(/\D+/g, "");

  // Remove código do país (55) se vier com ele
  if (
    digits.startsWith("55") &&
    (digits.length === 13 || digits.length === 12)
  ) {
    // 55 + 11 dígitos (celular) ou 55 + 10 (fixo)
    digits = digits.slice(2);
  }

  // Opcional: garantir no máx. 11 dígitos (prioriza os finais, que são o número local)
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  return digits;
}
