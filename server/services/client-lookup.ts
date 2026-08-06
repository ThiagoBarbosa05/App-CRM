import { inArray, sql, type SQL } from "drizzle-orm";
import { clients } from "@shared/schema";
import { normalizePhoneE164 } from "@shared/phone";
import { phoneVariants } from "../lib/phone";

/**
 * Busca de cliente por telefone/documento — usada por toda origem que cria
 * cliente automaticamente (Bling, Connect, indicações).
 *
 * Existe porque cada integração tinha o seu próprio normalizador: Bling só
 * removia o `55`, Connect só tirava a formatação, indicações comparavam a string
 * crua. Nenhum deles cobria a variação do 9º dígito, e como cada origem também
 * *gravava* num formato diferente, o mesmo cliente entrava duas vezes — o
 * `clients_phone_unique` é sobre o texto cru e não dispara entre `21975865422` e
 * `+5521975865422`.
 */

/**
 * Formato canônico de gravação: E.164 (`+55DDDNÚMERO`). Cai para os dígitos crus
 * quando o número não é um telefone brasileiro reconhecível, para não descartar
 * o dado. Mesma regra de `normalizePhoneField` em `clients-data.ts`, que já é o
 * que o cadastro manual usa.
 */
export function toStoredPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return normalizePhoneE164(phone) ?? digits;
}

/** Só dígitos; retorna null quando não sobra nada. */
export function toDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

/** CPF válido para comparação: exatamente 11 dígitos e não todos iguais. */
export function toComparableCpf(cpf: string | null | undefined): string | null {
  const digits = toDigits(cpf);
  if (!digits || digits.length !== 11) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits;
}

/** Coluna de telefone reduzida a dígitos, do lado do banco. */
function phoneDigitsSql(column: SQL | ReturnType<typeof sql>): SQL {
  return sql`regexp_replace(COALESCE(${column}, ''), '[^0-9]', '', 'g')`;
}

/**
 * Condições SQL que casam um telefone contra `clients.phone` e
 * `clients.fixedPhone` em qualquer formato já gravado — com/sem DDI e com/sem o
 * 9º dígito — via `phoneVariants`. Retorna vazio quando não há o que comparar.
 */
export function phoneMatchConditions(phone: string | null | undefined): SQL[] {
  const variants = phoneVariants(phone ?? null);
  if (variants.length === 0) return [];

  return [
    inArray(phoneDigitsSql(sql`${clients.phone}`), variants),
    inArray(phoneDigitsSql(sql`${clients.fixedPhone}`), variants),
  ];
}

/**
 * Condição SQL de CPF, normalizando **os dois lados**. Comparar contra a coluna
 * crua (`eq(clients.cpf, ...)`) não acha um cadastro salvo como
 * `127.022.387-93`, que é como o cadastro manual antigo gravava.
 */
export function cpfMatchCondition(cpf: string | null | undefined): SQL | null {
  const normalized = toComparableCpf(cpf);
  if (!normalized) return null;
  return sql`regexp_replace(COALESCE(${clients.cpf}, ''), '[^0-9]', '', 'g') = ${normalized}`;
}

/**
 * Todas as condições de identidade de um contato (CPF + telefones), na ordem em
 * que devem ser combinadas com `or(...)`. Vazio significa "não há dado
 * suficiente para procurar" — o chamador não deve buscar nem criar às cegas.
 */
export function clientIdentityConditions(params: {
  cpf?: string | null;
  phones?: (string | null | undefined)[];
}): SQL[] {
  const conditions: SQL[] = [];

  const cpfCondition = cpfMatchCondition(params.cpf ?? null);
  if (cpfCondition) conditions.push(cpfCondition);

  const seen = new Set<string>();
  for (const phone of params.phones ?? []) {
    const digits = toDigits(phone);
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    conditions.push(...phoneMatchConditions(phone));
  }

  return conditions;
}
