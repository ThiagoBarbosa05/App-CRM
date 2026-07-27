import { format } from "date-fns";
import type { RestaurantOrder, RestaurantOrderItem } from "../../shared/schema";
import type {
  BlingPedidoVendaItemPayload,
  BlingPedidoVendaPayload,
} from "../integrations/bling";

export interface ResolveBlingSalesOrderInput {
  order: RestaurantOrder;
  items: RestaurantOrderItem[];
  /** bling_product_mappings.bling_product_id, por product_id do CRM. */
  blingProductIdByProductId: Map<string, string>;
  contactBlingId: string | null;
  sellerBlingId: string | null;
}

export type ResolveBlingSalesOrderResult =
  | { ok: true; payload: BlingPedidoVendaPayload }
  | { ok: false; reason: string };

/**
 * Monta o payload de POST /pedidos/vendas a partir dos dados já carregados da
 * comanda. Nunca lança — qualquer vínculo faltando (item sem produto Bling,
 * contato não resolvido) vira `{ ok: false, reason }`, que o chamador trata
 * como divergência bloqueada, sem retry automático.
 */
export function resolveBlingSalesOrderPayload(
  input: ResolveBlingSalesOrderInput,
): ResolveBlingSalesOrderResult {
  const { order, items, blingProductIdByProductId, contactBlingId, sellerBlingId } = input;

  if (!contactBlingId) {
    return {
      ok: false,
      reason:
        "Nenhum contato Bling resolvido — vincule um cliente à comanda ou configure o Consumidor Final da unidade",
    };
  }

  const unresolvedItemNames: string[] = [];
  const itens: BlingPedidoVendaItemPayload[] = [];

  for (const item of items) {
    const blingProductId = item.productId
      ? blingProductIdByProductId.get(item.productId)
      : undefined;

    if (!blingProductId) {
      unresolvedItemNames.push(item.name);
      continue;
    }

    itens.push({
      produto: { id: Number(blingProductId) },
      descricao: item.name,
      quantidade: item.quantity,
      valor: Number(item.unitPrice),
    });
  }

  if (unresolvedItemNames.length > 0) {
    return {
      ok: false,
      reason: `Item(ns) sem produto vinculado ao Bling: ${unresolvedItemNames.join(", ")}`,
    };
  }

  if (!order.closedAt) {
    return { ok: false, reason: "Comanda sem data de fechamento" };
  }
  if (!order.total) {
    return { ok: false, reason: "Comanda sem total calculado" };
  }

  const closedDate = format(new Date(order.closedAt), "yyyy-MM-dd");

  const payload: BlingPedidoVendaPayload = {
    data: closedDate,
    dataSaida: closedDate,
    dataPrevista: closedDate,
    contato: { id: Number(contactBlingId) },
    itens,
    parcelas: [{ dataVencimento: closedDate, valor: Number(order.total) }],
    ...(sellerBlingId ? { vendedor: { id: Number(sellerBlingId) } } : {}),
  };

  return { ok: true, payload };
}
