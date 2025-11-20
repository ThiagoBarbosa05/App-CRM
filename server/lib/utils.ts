/**
 * Gera um código de confirmação único de 6 dígitos
 * @returns String com 6 dígitos numéricos
 */
export function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Formata um número de telefone para apenas dígitos
 * @param phone - Número de telefone com ou sem formatação
 * @returns Número de telefone apenas com dígitos
 */
export function formatPhoneToDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
