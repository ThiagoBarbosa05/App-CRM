import { useQuery } from "@tanstack/react-query";
import {
  mapBlingTipoPagamentoToLocalMethod,
  type RestaurantPaymentMethod,
} from "@shared/bling-payment-method-map";

/**
 * Opção de pagamento apresentada no fechamento da comanda. Quando a unidade
 * tem conta Bling, as opções vêm de lá (`blingId` preenchido) e o `method`
 * local — usado na conferência de caixa e relatórios — é derivado do
 * `tipoPagamento`. Sem Bling, cai no conjunto local fixo.
 */
export interface PaymentOption {
  /** Chave estável para selects/estado: `bling-<id>` ou o método local. */
  value: string;
  label: string;
  method: RestaurantPaymentMethod;
  blingId?: string;
}

export const LOCAL_PAYMENT_OPTIONS: PaymentOption[] = [
  { value: "pix", label: "Pix", method: "pix" },
  { value: "cartao_credito", label: "Cartão de Crédito", method: "cartao_credito" },
  { value: "cartao_debito", label: "Cartão de Débito", method: "cartao_debito" },
  { value: "dinheiro", label: "Dinheiro", method: "dinheiro" },
];

interface BlingFormaPagamento {
  id: number;
  descricao: string;
  tipoPagamento: number;
}

/**
 * Formas de pagamento ativas da conta Bling da unidade. 409 (unidade sem
 * conexão/token) e falhas de API caem no fallback local — o fechamento nunca
 * fica travado por causa do Bling.
 */
export function useBlingPaymentMethods(enabled = true) {
  const query = useQuery<BlingFormaPagamento[]>({
    queryKey: ["/api/restaurant-pdv/bling-payment-methods"],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const blingOptions: PaymentOption[] | null =
    query.data && query.data.length > 0
      ? query.data.map((f) => ({
          value: `bling-${f.id}`,
          label: f.descricao,
          method: mapBlingTipoPagamentoToLocalMethod(f.tipoPagamento),
          blingId: String(f.id),
        }))
      : null;

  return {
    options: blingOptions ?? LOCAL_PAYMENT_OPTIONS,
    isBlingList: !!blingOptions,
    isLoading: query.isLoading,
  };
}
