/**
 * Gera um código de confirmação único de 6 dígitos
 * @returns String com 6 dígitos numéricos
 */
export function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

