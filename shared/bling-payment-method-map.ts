/**
 * Mapeia o `tipoPagamento` de uma forma de pagamento do Bling (API v3)
 * para o método local usado na conferência de caixa e relatórios do PDV.
 * Tipos não mapeados (boleto, vale, transferência etc.) caem em "outros".
 */
export type RestaurantPaymentMethod =
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "dinheiro"
  | "outros";

const TIPO_PAGAMENTO_TO_METHOD: Record<number, RestaurantPaymentMethod> = {
  1: "dinheiro",
  3: "cartao_credito",
  4: "cartao_debito",
  17: "pix", // PIX dinâmico
  20: "pix", // PIX estático
};

export function mapBlingTipoPagamentoToLocalMethod(
  tipoPagamento: number,
): RestaurantPaymentMethod {
  return TIPO_PAGAMENTO_TO_METHOD[tipoPagamento] ?? "outros";
}
