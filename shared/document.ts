/**
 * Validação de CPF e CNPJ (dígito verificador, módulo 11).
 *
 * Vive em `shared/` porque a mesma regra precisa valer nos dois lados: o
 * formulário do CRM não é o único caminho de escrita (importação de planilha,
 * PDV, cadastro a partir do Inbox), então o servidor também precisa recusar um
 * documento inválido em vez de gravá-lo.
 */

/** CPF válido? Aceita a entrada formatada ("000.000.000-00") ou só dígitos. */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(10))) return false;

  return true;
}

/** CNPJ válido? Aceita a entrada formatada ("00.000.000/0000-00") ou só dígitos. */
export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (d: string, weights: number[]) =>
    weights.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);

  const mod = (n: number) => {
    const r = n % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  return (
    mod(calc(digits, w1)) === parseInt(digits[12]) &&
    mod(calc(digits, w2)) === parseInt(digits[13])
  );
}

/**
 * Valida o campo `cpf` do cliente, que guarda tanto CPF (PF) quanto CNPJ (PJ) —
 * o tipo é decidido pela quantidade de dígitos. Um valor vazio é considerado
 * válido: o documento é opcional; quem exige presença é o schema, não isto.
 */
export function isValidDocument(document: string | null | undefined): boolean {
  if (!document) return true;

  const digits = document.replace(/\D/g, "");
  if (digits.length === 0) return true;
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);

  return false;
}
