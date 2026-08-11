import { asc, inArray, or, sql, type SQL } from "drizzle-orm";
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
 * Versão em lote de `phoneMatchConditions`: mesmas duas condições (telefone e
 * telefone fixo), mas com as variantes de **todos** os telefones da lista numa
 * única `IN`. Um import de planilha com centenas de linhas vira uma consulta só,
 * em vez de `2 * N` condições combinadas com `or(...)`.
 *
 * Quem chama casa o resultado de volta em memória usando `phoneVariants` no
 * telefone gravado — as duas pontas usam a mesma função, então não há como o
 * SQL e o casamento em memória divergirem.
 */
export function phoneMatchConditionsBatch(
  phones: (string | null | undefined)[],
): SQL[] {
  const variants = new Set<string>();
  for (const phone of phones) {
    for (const variant of phoneVariants(phone ?? null)) variants.add(variant);
  }
  if (variants.size === 0) return [];

  const list = Array.from(variants);
  return [
    inArray(phoneDigitsSql(sql`${clients.phone}`), list),
    inArray(phoneDigitsSql(sql`${clients.fixedPhone}`), list),
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
 * Condição SQL de e-mail, comparando em minúsculas dos dois lados. O
 * `clients_email_unique` é case-sensitive, então um cadastro gravado como
 * `Fulano@Mail.com` não colide com `fulano@mail.com` — sem esta condição a
 * integração estoura `23505` e não consegue achar o cliente que causou o erro.
 * Como a coluna é UNIQUE, no máximo uma linha casa: é seguro usar como chave.
 */
export function emailMatchCondition(email: string | null | undefined): SQL | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return sql`lower(COALESCE(${clients.email}, '')) = ${normalized}`;
}

/** Dados de identidade de um contato vindo de uma origem externa. */
export interface ClientIdentityParams {
  cpf?: string | null;
  phones?: (string | null | undefined)[];
  email?: string | null;
}

/** As condições separadas por chave, para reuso entre `where` e `order by`. */
function identityParts(params: ClientIdentityParams): {
  cpf: SQL | null;
  phones: SQL[];
  email: SQL | null;
} {
  const phones: SQL[] = [];
  const seen = new Set<string>();
  for (const phone of params.phones ?? []) {
    const digits = toDigits(phone);
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    phones.push(...phoneMatchConditions(phone));
  }

  return {
    cpf: cpfMatchCondition(params.cpf ?? null),
    phones,
    email: emailMatchCondition(params.email ?? null),
  };
}

/**
 * Todas as condições de identidade de um contato (CPF + telefones + e-mail), na
 * ordem em que devem ser combinadas com `or(...)`. Vazio significa "não há dado
 * suficiente para procurar" — o chamador não deve buscar nem criar às cegas.
 */
export function clientIdentityConditions(params: ClientIdentityParams): SQL[] {
  const { cpf, phones, email } = identityParts(params);

  const conditions: SQL[] = [];
  if (cpf) conditions.push(cpf);
  conditions.push(...phones);
  if (email) conditions.push(email);

  return conditions;
}

/**
 * Ordenação a aplicar junto com `clientIdentityConditions`. Sem ela, um
 * `or(...) + limit(1)` devolve uma linha arbitrária quando o CPF casa num
 * cliente e o telefone casa noutro — e o mesmo contato pode alternar entre os
 * dois a cada pedido. A prioridade é CPF > telefone > e-mail, com o cadastro
 * mais antigo como desempate (é o canônico; os posteriores é que são as cópias).
 */
export function clientIdentityOrderBy(params: ClientIdentityParams): SQL[] {
  const { cpf, phones, email } = identityParts(params);

  const whens: SQL[] = [];
  let rank = 0;
  // `sql.raw` nos inteiros: como parâmetro ligado, o Postgres não consegue
  // inferir o tipo do `THEN` dentro de um `ORDER BY`.
  if (cpf) whens.push(sql`WHEN ${cpf} THEN ${sql.raw(String(rank++))}`);
  if (phones.length > 0) {
    whens.push(sql`WHEN ${or(...phones)} THEN ${sql.raw(String(rank++))}`);
  }
  if (email) whens.push(sql`WHEN ${email} THEN ${sql.raw(String(rank++))}`);

  if (whens.length === 0) return [asc(clients.createdAt)];

  return [
    sql`CASE ${sql.join(whens, sql` `)} ELSE ${sql.raw(String(rank))} END`,
    asc(clients.createdAt),
  ];
}
