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

/**
 * Formato aceito para valores monetários que chegam do cliente: ponto decimal,
 * até 2 casas. `"33,34"` (pt-BR) é recusado de propósito — quem digita com
 * vírgula é o usuário, e a conversão é responsabilidade da UI (`parseBRL`).
 */
export const MONEY_STRING_REGEX = /^-?\d+(\.\d{1,2})?$/;

export function isValidMoneyString(value: unknown): value is string {
  return typeof value === "string" && MONEY_STRING_REGEX.test(value);
}

/**
 * Converte para centavos, recusando entrada inválida.
 *
 * Antes retornava `NaN` silenciosamente, e `NaN` contamina toda comparação:
 * `Math.abs(NaN - total) > 1` é `false`, então a validação da soma dos
 * pagamentos no fechamento da comanda passava batido. Dinheiro não pode
 * depender de uma comparação que falha para o lado permissivo — aqui a entrada
 * inválida vira erro explícito.
 */
export function toCents(value: string | number): number {
  // `Number("")` e `Number(null)` são 0 em JS — para dinheiro isso é entrada
  // ausente, não zero, então precisam ser recusados antes da conversão.
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (trimmed === "" || trimmed == null) {
    throw Object.assign(new Error("Valor monetário ausente"), {
      code: "INVALID_AMOUNT",
    });
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw Object.assign(
      new Error(`Valor monetário inválido: ${JSON.stringify(value)}`),
      { code: "INVALID_AMOUNT" },
    );
  }
  return Math.round(num * 100);
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

/**
 * Tolerância de 1 centavo na conferência da soma dos pagamentos.
 *
 * Existe porque a divisão de conta rateia centavos entre pessoas e o
 * arredondamento pode sobrar 1 centavo. Não é margem para erro de digitação.
 */
export const PAYMENTS_TOLERANCE_CENTS = 1;

export interface OrderPaymentInput {
  method: "pix" | "cartao_credito" | "cartao_debito" | "dinheiro";
  amount: string | number;
}

export interface PaymentsValidationResult {
  paymentsTotalCents: number;
  /** Método único quando todos coincidem; `null` quando a conta foi dividida. */
  finalPaymentMethod: OrderPaymentInput["method"] | null;
}

/**
 * Confere a soma dos pagamentos contra o total da comanda e deriva a forma de
 * pagamento a gravar. Pura de propósito: é a regra que decide se dinheiro entra
 * no caixa, e testá-la não deve exigir banco.
 *
 * Lança `PAYMENTS_MISMATCH` quando a soma não bate. Valores inválidos explodem
 * em `toCents` com `INVALID_AMOUNT` — antes viravam `NaN`, e a comparação
 * `Math.abs(NaN - total) > 1` retornava `false`, deixando passar qualquer soma.
 */
export function validatePaymentsAgainstTotal(
  payments: OrderPaymentInput[],
  totalCents: number,
): PaymentsValidationResult {
  const paymentsTotalCents = payments.reduce(
    (sum, p) => sum + toCents(p.amount),
    0,
  );

  if (Math.abs(paymentsTotalCents - totalCents) > PAYMENTS_TOLERANCE_CENTS) {
    throw Object.assign(
      new Error(
        `A soma dos pagamentos (${fromCents(paymentsTotalCents)}) não bate com o total da comanda (${fromCents(totalCents)})`,
      ),
      { code: "PAYMENTS_MISMATCH" },
    );
  }

  const distinctMethods = new Set(payments.map((p) => p.method));

  return {
    paymentsTotalCents,
    finalPaymentMethod: distinctMethods.size === 1 ? payments[0].method : null,
  };
}
