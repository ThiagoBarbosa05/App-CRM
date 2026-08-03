/**
 * Conferência do pedido de venda criado no Bling contra a comanda que o gerou.
 *
 * Existe porque o pedido é criado por uma chamada externa cujo total é
 * calculado do lado de lá: mandamos itens, desconto e "outras despesas", e o
 * Bling soma. Se a soma dele não bater com o que o cliente pagou, o ERP fica
 * com um valor diferente do caixa — e ninguém descobre até a conciliação
 * contábil.
 *
 * Vive em `shared/` e não no service porque o service importa `server/db` no
 * topo; a regra de "o que conta como divergência" merece teste próprio, sem
 * arrastar a conexão para dentro dele.
 */

import { fromCents, toCents } from "./restaurant-order-totals";

/**
 * Tolerância de 1 centavo, pelo mesmo motivo de `PAYMENTS_TOLERANCE_CENTS`:
 * arredondamento de rateio, não margem para erro de valor.
 */
export const BLING_CHECK_TOLERANCE_CENTS = 1;

export interface BlingOrderTotalsSnapshot {
  numero?: number | null;
  total: number;
  totalProdutos: number;
  outrasDespesas: number;
  desconto?: { valor: number | string } | null;
}

export interface BlingCheckExpectation {
  totalCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  discountCents: number;
}

export interface BlingCheckResult {
  status: "ok" | "divergente";
  detail: string | null;
  blingOrderNumber: string | null;
}

function money(cents: number): string {
  return `R$ ${fromCents(cents)}`;
}

/** `null`/vazio viram 0 — campo ausente no Bling é zero, não erro. */
function safeCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return toCents(value);
}

/**
 * Compara o pedido gravado no Bling com o que a comanda esperava.
 *
 * O veredito é dado só pelo total. Os campos individuais entram no detalhe
 * porque é o que transforma "divergiu" em algo acionável: se `outrasDespesas`
 * foi gravado certo mas o total não o inclui, o Bling não soma esse campo e a
 * taxa precisa ir de outro jeito; se veio zerado, o campo foi rejeitado; se
 * veio 100× maior, a unidade é centavos e não reais. Sem esse recorte, a tela
 * diria "divergente" e ninguém saberia o que fazer.
 */
export function compareBlingSalesOrderTotals(input: {
  blingOrder: BlingOrderTotalsSnapshot;
  expected: BlingCheckExpectation;
  alertas?: string[];
}): BlingCheckResult {
  const { blingOrder, expected, alertas = [] } = input;

  const blingTotalCents = safeCents(blingOrder.total);
  const diffCents = blingTotalCents - expected.totalCents;

  const notes: string[] = [];
  if (alertas.length > 0) notes.push(`Alertas do Bling: ${alertas.join("; ")}`);

  const blingOrderNumber =
    blingOrder.numero === null || blingOrder.numero === undefined
      ? null
      : String(blingOrder.numero);

  if (Math.abs(diffCents) <= BLING_CHECK_TOLERANCE_CENTS) {
    return {
      status: "ok",
      detail: notes.length > 0 ? notes.join(" | ") : null,
      blingOrderNumber,
    };
  }

  notes.push(
    `Total no Bling ${money(blingTotalCents)} ≠ total da comanda ` +
      `${money(expected.totalCents)} (diferença de ${money(Math.abs(diffCents))})`,
  );

  const blingProdutosCents = safeCents(blingOrder.totalProdutos);
  if (blingProdutosCents !== expected.subtotalCents) {
    notes.push(
      `produtos ${money(blingProdutosCents)} ≠ subtotal ${money(expected.subtotalCents)}`,
    );
  }

  const blingDespesasCents = safeCents(blingOrder.outrasDespesas);
  if (blingDespesasCents !== expected.serviceFeeCents) {
    notes.push(
      `outras despesas ${money(blingDespesasCents)} ≠ taxa de serviço ` +
        `${money(expected.serviceFeeCents)}`,
    );
  } else if (expected.serviceFeeCents > 0 && diffCents === -expected.serviceFeeCents) {
    // O campo foi gravado certo, mas o total não o contém: o Bling registra
    // "outras despesas" sem somar ao total do pedido.
    notes.push(
      "outras despesas gravadas corretamente, mas NÃO somadas ao total pelo Bling " +
        "— a taxa de serviço precisa ser enviada de outra forma",
    );
  }

  const blingDescontoCents = safeCents(blingOrder.desconto?.valor);
  if (blingDescontoCents !== expected.discountCents) {
    notes.push(
      `desconto ${money(blingDescontoCents)} ≠ ${money(expected.discountCents)}`,
    );
  }

  return { status: "divergente", detail: notes.join(" | "), blingOrderNumber };
}
