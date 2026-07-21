/**
 * Cálculo de totais da comanda do PDV Restaurante.
 *
 * Fonte única de verdade: o backend usa os campos `*Cents` ao fechar a comanda
 * e o frontend usa os campos em reais para exibir. Como os dois saem da mesma
 * função, o valor mostrado ao cliente é sempre o valor cobrado — inclusive o
 * arredondamento, que é feito em centavos.
 */

export const DEFAULT_SERVICE_FEE_PERCENT = 10;

export interface OrderTotalsItem {
  unitPrice: string | number;
  quantity: number;
}

export interface OrderTotalsInput {
  items: OrderTotalsItem[];
  /** `serviceFeePercent` da comanda. Ausente = padrão de 10%. */
  serviceFeePercent?: string | number | null;
  discountAmount?: string | number | null;
  discountPercent?: string | number | null;
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  discountedSubtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  /** Mesmos valores em reais, para exibição. */
  subtotal: number;
  discountAmount: number;
  discountedSubtotal: number;
  serviceFee: number;
  total: number;
  serviceFeePercent: number;
  hasDiscount: boolean;
}

export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 10 → "10%"; 12.5 → "12,5%" (sem casas decimais penduradas) */
export function formatPercent(percent: number): string {
  return `${String(percent).replace(".", ",")}%`;
}

export function calculateOrderTotals({
  items,
  serviceFeePercent,
  discountAmount,
  discountPercent,
}: OrderTotalsInput): OrderTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
    0,
  );

  let discountCents = 0;
  if (discountAmount) {
    discountCents = toCents(discountAmount);
  } else if (discountPercent) {
    discountCents = Math.round(subtotalCents * (Number(discountPercent) / 100));
  }
  // Desconto nunca pode superar o subtotal (evita total negativo).
  discountCents = Math.min(discountCents, subtotalCents);

  const discountedSubtotalCents = subtotalCents - discountCents;

  const percent =
    serviceFeePercent == null || serviceFeePercent === ""
      ? DEFAULT_SERVICE_FEE_PERCENT
      : Number(serviceFeePercent);

  const serviceFeeCents = Math.round(discountedSubtotalCents * (percent / 100));
  const totalCents = discountedSubtotalCents + serviceFeeCents;

  return {
    subtotalCents,
    discountCents,
    discountedSubtotalCents,
    serviceFeeCents,
    totalCents,
    subtotal: subtotalCents / 100,
    discountAmount: discountCents / 100,
    discountedSubtotal: discountedSubtotalCents / 100,
    serviceFee: serviceFeeCents / 100,
    total: totalCents / 100,
    serviceFeePercent: percent,
    hasDiscount: discountCents > 0,
  };
}
