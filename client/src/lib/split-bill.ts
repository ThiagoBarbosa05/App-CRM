/**
 * Divisão de conta do PDV Restaurante — aritmética pura, em centavos.
 *
 * O backend recusa o fechamento quando a soma dos pagamentos não bate com o
 * total da comanda (`PAYMENTS_MISMATCH`), então cada parcela é arredondada uma
 * única vez e a sobra é distribuída explicitamente. Dividir em float e
 * arredondar cada parcela perde centavos: R$ 100 / 3 daria 33,33 três vezes.
 */

/**
 * Quantas pessoas a divisão deve assumir por padrão, a partir do que a comanda
 * registrou na abertura da mesa.
 *
 * O número de pessoas é pedido ao abrir a mesa e era ignorado no fechamento: a
 * divisão começava sempre em 2, e uma mesa de seis precisava ser corrigida à
 * mão toda vez. Cai para 2 quando o valor não serve para dividir (mesa de uma
 * pessoa, ou dado inválido vindo do banco).
 */
export function initialSplitPeople(peopleCount: number): number {
  return Number.isFinite(peopleCount) && peopleCount >= 2 ? Math.floor(peopleCount) : 2;
}

/** Divide `totalCents` em `people` parcelas cujo somatório é exatamente o total. */
export function splitEqualCents(totalCents: number, people: number): number[] {
  const count = Math.max(people, 1);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;
  return Array.from(
    { length: count },
    (_, i) => baseCents + (i < remainderCents ? 1 : 0),
  );
}

export interface GroupSplitInput {
  /** Subtotal de cada grupo, em centavos, na ordem dos grupos. */
  groupSubtotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  serviceFeeCents: number;
  totalCents: number;
}

/**
 * Rateia desconto e taxa de serviço proporcionalmente ao subtotal de cada
 * grupo. O último grupo absorve a sobra do arredondamento para que a soma
 * feche exatamente com `totalCents`.
 */
export function splitByGroupsCents({
  groupSubtotalsCents,
  subtotalCents,
  discountCents,
  serviceFeeCents,
  totalCents,
}: GroupSplitInput): number[] {
  if (groupSubtotalsCents.length === 0) return [];
  if (subtotalCents === 0) return groupSubtotalsCents.map(() => 0);

  const rawCents = groupSubtotalsCents.map((groupSubtotalCents) => {
    const proportion = groupSubtotalCents / subtotalCents;
    return Math.round(
      groupSubtotalCents - discountCents * proportion + serviceFeeCents * proportion,
    );
  });

  const allButLast = rawCents.slice(0, -1);
  const lastCents = totalCents - allButLast.reduce((a, b) => a + b, 0);
  return [...allButLast, lastCents];
}
