import { format } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import type { RestaurantOrder, RestaurantOrderItem } from "../../shared/schema";
import {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderPayments,
  restaurantOrderBlingSyncLog,
  blingProductMappings,
  blingContactMappings,
  blingSellerMappings,
  pdvUnits,
} from "../../shared/schema";
import type {
  BlingPedidoVendaItemPayload,
  BlingPedidoVendaParcelaPayload,
  BlingPedidoVendaPayload,
} from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";
import { decryptToken } from "../lib/token-crypto";
import { createBlingPedidoVenda, getBlingPedidoVenda } from "../integrations/bling";
import type { DbExecutor } from "../db";
import { fromCents, toCents } from "../../shared/restaurant-order-totals";
import { compareBlingSalesOrderTotals } from "../../shared/bling-sales-order-check";

/**
 * Centavos de uma coluna monetária que pode ser nula.
 *
 * `toCents` recusa null/vazio de propósito (para o fechamento, valor ausente é
 * erro e não zero), mas aqui a coluna legitimamente vem nula: `serviceFeeAmount`
 * e `discountAmount` só existem quando há taxa/desconto.
 */
function optionalCents(value: string | null | undefined): number {
  return value ? toCents(value) : 0;
}

/** Reais, como o Bling espera nos campos de valor do pedido. */
function toReais(cents: number): number {
  return Number(fromCents(cents));
}

export interface ResolveBlingSalesOrderInput {
  order: RestaurantOrder;
  items: RestaurantOrderItem[];
  /** bling_product_mappings.bling_product_id, por product_id do CRM. */
  blingProductIdByProductId: Map<string, string>;
  contactBlingId: string | null;
  sellerBlingId: string | null;
  /**
   * Pagamentos da comanda, na ordem de criação. Cada um vira uma parcela;
   * quando presente, `blingPaymentMethodId` vai em `parcelas[].formaPagamento`.
   * Vazio → parcela única sem forma (comportamento legado).
   */
  payments?: { amount: string; blingPaymentMethodId?: string | null }[];
}

export type ResolveBlingSalesOrderResult =
  | { ok: true; payload: BlingPedidoVendaPayload }
  | { ok: false; reason: string };

function buildParcelas(
  payments: { amount: string; blingPaymentMethodId?: string | null }[],
  totalCents: number,
  closedDate: string,
): BlingPedidoVendaParcelaPayload[] {
  if (payments.length === 0) {
    return [{ dataVencimento: closedDate, valor: toReais(totalCents) }];
  }

  let remainingCents = totalCents;
  return payments.map((payment, index) => {
    const isLast = index === payments.length - 1;
    const cents = isLast ? remainingCents : toCents(payment.amount);
    remainingCents -= cents;
    return {
      dataVencimento: closedDate,
      valor: toReais(cents),
      ...(payment.blingPaymentMethodId
        ? { formaPagamento: { id: Number(payment.blingPaymentMethodId) } }
        : {}),
    };
  });
}

/**
 * Monta o payload de POST /pedidos/vendas a partir dos dados já carregados da
 * comanda. Nunca lança — qualquer vínculo faltando (item sem produto Bling,
 * contato não resolvido) vira `{ ok: false, reason }`, que o chamador trata
 * como divergência bloqueada, sem retry automático.
 */
export function resolveBlingSalesOrderPayload(
  input: ResolveBlingSalesOrderInput,
): ResolveBlingSalesOrderResult {
  const {
    order,
    items,
    blingProductIdByProductId,
    contactBlingId,
    sellerBlingId,
    payments = [],
  } = input;

  if (!contactBlingId) {
    return {
      ok: false,
      reason:
        "Nenhum contato Bling resolvido — vincule um cliente à comanda ou configure o " +
        "Consumidor Final da unidade em PDV → Configurações → Unidades",
    };
  }

  const unresolvedItemNames: string[] = [];
  const itens: BlingPedidoVendaItemPayload[] = [];
  let itemsSubtotalCents = 0;

  for (const item of items) {
    const blingProductId = item.productId
      ? blingProductIdByProductId.get(item.productId)
      : undefined;

    if (!blingProductId) {
      unresolvedItemNames.push(item.name);
      continue;
    }

    const unitPriceCents = toCents(item.unitPrice);
    itemsSubtotalCents += unitPriceCents * item.quantity;

    itens.push({
      produto: { id: Number(blingProductId) },
      descricao: item.name,
      quantidade: item.quantity,
      valor: toReais(unitPriceCents),
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

  const totalCents = toCents(order.total);
  const subtotalCents = order.subtotal ? toCents(order.subtotal) : itemsSubtotalCents;
  const serviceFeeCents = optionalCents(order.serviceFeeAmount);

  // Mesma precedência de `calculateOrderTotals`: `discountAmount` manda; na
  // falta dele, deriva do percentual. Não dá para ler só a coluna de valor —
  // `closeOrder` não a grava, então comanda com desconto só percentual chega
  // aqui com `discountAmount` nulo e o desconto sumiria do pedido.
  let discountCents = 0;
  if (order.discountAmount) {
    discountCents = toCents(order.discountAmount);
  } else if (order.discountPercent) {
    discountCents = Math.round(subtotalCents * (Number(order.discountPercent) / 100));
  }
  discountCents = Math.min(discountCents, subtotalCents);

  // A identidade que o pedido no Bling precisa reproduzir. Se não fecha aqui,
  // fecharia errado lá — e um pedido de venda com valor errado é problema
  // fiscal, não cosmético. Não dispara no fluxo normal: a mesma conta já foi
  // feita por `calculateOrderTotals` no fechamento.
  const expectedTotalCents = subtotalCents - discountCents + serviceFeeCents;
  if (expectedTotalCents !== totalCents) {
    return {
      ok: false,
      reason:
        `Totais internos inconsistentes: subtotal ${fromCents(subtotalCents)} ` +
        `− desconto ${fromCents(discountCents)} + taxa ${fromCents(serviceFeeCents)} ` +
        `= ${fromCents(expectedTotalCents)}, mas o total da comanda é ${fromCents(totalCents)}`,
    };
  }

  // Uma parcela por pagamento, com a forma de pagamento do Bling quando o
  // fechamento a registrou. A última parcela absorve a diferença de centavos
  // (a validação do fechamento tolera 1 centavo), mantendo soma = total —
  // invariante conferida depois por `compareBlingSalesOrderTotals`.
  let parcelas: BlingPedidoVendaParcelaPayload[];
  try {
    parcelas = buildParcelas(payments, totalCents, closedDate);
  } catch (err) {
    return {
      ok: false,
      reason: `Pagamento da comanda com valor inválido: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const payload: BlingPedidoVendaPayload = {
    data: closedDate,
    dataSaida: closedDate,
    dataPrevista: closedDate,
    contato: { id: Number(contactBlingId) },
    itens,
    // A taxa de serviço vai em "outras despesas" para que o total calculado
    // pelo Bling (produtos − desconto + outras despesas) bata com o total da
    // comanda. Antes nada disso era enviado: o Bling gravava o pedido valendo
    // só o subtotal, com uma parcela cobrando o total — divergente por
    // construção em toda comanda com taxa.
    ...(serviceFeeCents > 0 ? { outrasDespesas: toReais(serviceFeeCents) } : {}),
    ...(discountCents > 0
      ? { desconto: { valor: toReais(discountCents), unidade: "REAL" as const } }
      : {}),
    parcelas,
    ...(sellerBlingId ? { vendedor: { id: Number(sellerBlingId) } } : {}),
  };

  return { ok: true, payload };
}

/** Exportada para o cron usar a mesma regra — eram duas constantes iguais. */
export const MAX_SYNC_ATTEMPTS = 5;

/**
 * A comanda já tem pedido de venda no Bling? Então não POSTar de novo.
 *
 * Puro para poder ser testado sem banco. É o guard que impede o pior desfecho
 * possível deste módulo: dois pedidos de venda para a mesma comanda. Antes não
 * existia — o cron só não duplicava por acidente (filtra por status), e um
 * reenvio manual criaria o segundo pedido.
 */
export function shouldSkipBlingSend(
  order: Pick<RestaurantOrder, "blingSyncStatus" | "blingSalesOrderId">,
): boolean {
  return order.blingSyncStatus === "enviado" && !!order.blingSalesOrderId;
}

async function resolveContactBlingId(
  tx: DbExecutor,
  order: RestaurantOrder,
  connectionId: string,
): Promise<string | null> {
  if (order.clientId) {
    const [row] = await tx
      .select({ blingContactId: blingContactMappings.blingContactId })
      .from(blingContactMappings)
      .where(
        and(
          eq(blingContactMappings.connectionId, connectionId),
          eq(blingContactMappings.clientId, order.clientId),
        ),
      )
      .limit(1);
    if (row) return row.blingContactId;
  }

  if (order.unitId) {
    const [unit] = await tx
      .select({
        defaultBlingContactId: pdvUnits.defaultBlingContactId,
        defaultClientId: pdvUnits.defaultClientId,
      })
      .from(pdvUnits)
      .where(eq(pdvUnits.id, order.unitId))
      .limit(1);

    // Contato escolhido direto na busca do Bling: já é o id de lá, sem
    // espelho local a consultar.
    if (unit?.defaultBlingContactId) return unit.defaultBlingContactId;

    // Legado: unidade configurada quando o Consumidor Final ainda era um
    // cliente do CRM.
    if (unit?.defaultClientId) {
      const [row] = await tx
        .select({ blingContactId: blingContactMappings.blingContactId })
        .from(blingContactMappings)
        .where(
          and(
            eq(blingContactMappings.connectionId, connectionId),
            eq(blingContactMappings.clientId, unit.defaultClientId),
          ),
        )
        .limit(1);
      if (row) return row.blingContactId;
    }
  }

  return null;
}

async function resolveSellerBlingId(
  tx: DbExecutor,
  order: RestaurantOrder,
  connectionId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ blingVendedorId: blingSellerMappings.blingVendedorId })
    .from(blingSellerMappings)
    .where(
      and(
        eq(blingSellerMappings.connectionId, connectionId),
        eq(blingSellerMappings.userId, order.waiterId),
      ),
    )
    .limit(1);
  if (row) return row.blingVendedorId;

  if (order.unitId) {
    const [unit] = await tx
      .select({ defaultSellerId: pdvUnits.defaultSellerId })
      .from(pdvUnits)
      .where(eq(pdvUnits.id, order.unitId))
      .limit(1);

    if (unit?.defaultSellerId) {
      const [fallbackRow] = await tx
        .select({ blingVendedorId: blingSellerMappings.blingVendedorId })
        .from(blingSellerMappings)
        .where(
          and(
            eq(blingSellerMappings.connectionId, connectionId),
            eq(blingSellerMappings.userId, unit.defaultSellerId),
          ),
        )
        .limit(1);
      if (fallbackRow) return fallbackRow.blingVendedorId;
    }
  }

  return null;
}

async function recordSyncResult(
  tx: DbExecutor,
  order: RestaurantOrder,
  params: {
    result: "enviado" | "bloqueado" | "erro";
    reason: string | null;
    blingSalesOrderId?: string | null;
    attempts?: number;
    finalStatus?: "enviado" | "bloqueado" | "erro";
  },
): Promise<void> {
  const finalStatus = params.finalStatus ?? params.result;

  await tx
    .update(restaurantOrders)
    .set({
      blingSyncStatus: finalStatus,
      blingSalesOrderId: params.blingSalesOrderId ?? order.blingSalesOrderId,
      // Num envio bem-sucedido o `reason` é um ALERTA do Bling, não um erro.
      // Gravá-lo em `blingSyncError` pintaria a comanda de vermelho na tela
      // por causa de um aviso; o texto vai para o log e para o detalhe da
      // conferência, que é onde se lê aviso.
      blingSyncError: finalStatus === "enviado" ? null : params.reason,
      blingCheckDetail: finalStatus === "enviado" ? params.reason : order.blingCheckDetail,
      blingSyncAttempts: params.attempts ?? order.blingSyncAttempts,
      blingSyncAttemptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(restaurantOrders.id, order.id));

  await tx.insert(restaurantOrderBlingSyncLog).values({
    orderId: order.id,
    unitId: order.unitId,
    result: params.result,
    reason: params.reason,
    blingSalesOrderId: params.blingSalesOrderId ?? null,
  });
}

/** Desfecho da tentativa de envio — o ramo `sent` alimenta a conferência. */
type SendAttemptResult =
  | {
      kind: "sent";
      order: RestaurantOrder;
      connectionId: string;
      blingSalesOrderId: string;
      alertas: string[];
    }
  | { kind: "skipped" }
  | { kind: "blocked" }
  | { kind: "error" };

/**
 * Tenta enviar o pedido de venda da comanda fechada ao Bling. Usada tanto na
 * tentativa imediata pós-fechamento quanto no cron de retry e no reenvio
 * manual do admin — sempre o mesmo caminho de código.
 *
 * `FOR UPDATE SKIP LOCKED`: se duas chamadas colidirem na mesma comanda
 * (tentativa imediata + cron, ou dois ticks do cron), quem chegar primeiro
 * processa; a outra pula a linha em vez de esperar ou duplicar o pedido de
 * venda no Bling.
 *
 * Separada de `sendOrderToBling` porque tudo aqui roda dentro da transação que
 * segura o lock: a conferência (que é outra chamada HTTP) precisa acontecer
 * depois do commit, não aqui dentro.
 */
async function attemptSendOrderToBling(orderId: string): Promise<SendAttemptResult> {
  // `box` em vez de `let` direto: TypeScript não consegue estreitar (narrow) uma variável
  // `let` reatribuída apenas dentro de uma closure aninhada seguida de `throw` — o resultado
  // é um falso `never` no `if (pendingRecovery.value)` do catch externo. Um objeto mutável
  // captado por referência não sofre esse problema de control-flow analysis.
  const pendingRecovery: {
    value: {
      order: RestaurantOrder;
      connectionId: string;
      blingSalesOrderIdStr: string;
      alertas: string[];
    } | null;
  } = { value: null };

  try {
    return await db.transaction(async (tx): Promise<SendAttemptResult> => {
      const [order] = await tx
        .select()
        .from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, orderId), eq(restaurantOrders.status, "fechada")))
        .for("update", { skipLocked: true });

      if (!order) return { kind: "skipped" };

      // Nunca POSTar duas vezes a mesma comanda: o pedido de venda já existe
      // no Bling e um segundo seria dinheiro duplicado no ERP.
      if (shouldSkipBlingSend(order)) {
        console.log(
          `[BlingSalesOrderSync] Comanda ${order.id} já tem pedido de venda ` +
            `${order.blingSalesOrderId} — envio ignorado.`,
        );
        return { kind: "skipped" };
      }

      if (!order.blingConnectionId) {
        await recordSyncResult(tx, order, {
          result: "bloqueado",
          reason: "Comanda sem conta Bling vinculada (unidade sem catálogo configurado)",
        });
        return { kind: "blocked" };
      }
      const connectionId = order.blingConnectionId;

      const items = await tx
        .select()
        .from(restaurantOrderItems)
        .where(
          and(
            eq(restaurantOrderItems.orderId, orderId),
            eq(restaurantOrderItems.status, "ativo"),
          ),
        );

      const productIds = items
        .map((item) => item.productId)
        .filter((id): id is string => !!id);

      const mappingRows =
        productIds.length > 0
          ? await tx
              .select({
                productId: blingProductMappings.productId,
                blingProductId: blingProductMappings.blingProductId,
              })
              .from(blingProductMappings)
              .where(
                and(
                  eq(blingProductMappings.connectionId, connectionId),
                  inArray(blingProductMappings.productId, productIds),
                ),
              )
          : [];

      const blingProductIdByProductId = new Map(
        mappingRows.map((row) => [row.productId, row.blingProductId]),
      );

      const [contactBlingId, sellerBlingId] = await Promise.all([
        resolveContactBlingId(tx, order, connectionId),
        resolveSellerBlingId(tx, order, connectionId),
      ]);

      const payments = await tx
        .select({
          amount: restaurantOrderPayments.amount,
          blingPaymentMethodId: restaurantOrderPayments.blingPaymentMethodId,
        })
        .from(restaurantOrderPayments)
        .where(eq(restaurantOrderPayments.orderId, orderId))
        .orderBy(restaurantOrderPayments.createdAt);

      const resolved = resolveBlingSalesOrderPayload({
        order,
        items,
        blingProductIdByProductId,
        contactBlingId,
        sellerBlingId,
        payments,
      });

      if (!resolved.ok) {
        await recordSyncResult(tx, order, { result: "bloqueado", reason: resolved.reason });
        return { kind: "blocked" };
      }

      try {
        const connection = await blingConnectionsService.getById(connectionId);
        if (!connection?.accessTokenEncrypted) {
          throw new Error("Conexão Bling sem token de acesso");
        }

        let accessToken = decryptToken(connection.accessTokenEncrypted);
        const onTokenRefresh = async (): Promise<string> => {
          await blingConnectionsService.refreshConnection(connectionId);
          const refreshed = await blingConnectionsService.getById(connectionId);
          if (!refreshed?.accessTokenEncrypted) {
            throw new Error("Não foi possível renovar o token do Bling");
          }
          accessToken = decryptToken(refreshed.accessTokenEncrypted);
          return accessToken;
        };

        const { id: blingSalesOrderId, alertas = [] } = await createBlingPedidoVenda(
          accessToken,
          resolved.payload,
          onTokenRefresh,
        );
        const blingSalesOrderIdStr = String(blingSalesOrderId);
        // Os alertas eram descartados. São eles que trazem avisos do tipo
        // "parcela divergente do total" — o primeiro sinal de que o pedido
        // saiu com valor diferente do cobrado.
        const alertaReason =
          alertas.length > 0 ? `Alertas do Bling: ${alertas.join("; ")}` : null;

        try {
          await recordSyncResult(tx, order, {
            result: "enviado",
            reason: alertaReason,
            blingSalesOrderId: blingSalesOrderIdStr,
            attempts: order.blingSyncAttempts,
          });
        } catch (recordErr) {
          const recordErrMessage =
            recordErr instanceof Error ? recordErr.message : String(recordErr);
          console.error(
            `[BlingSalesOrderSync] Pedido de venda ${blingSalesOrderIdStr} foi criado no Bling ` +
              `para orderId ${order.id}, mas a gravação do resultado dentro da transação falhou ` +
              `(${recordErrMessage}). A transação será revertida e o resultado será gravado ` +
              `separadamente após a liberação do lock, para não duplicar o pedido e não travar ` +
              `a linha indefinidamente.`,
          );
          // Não grava aqui: `tx` ainda segura o lock da linha (FOR UPDATE), e uma escrita numa
          // conexão separada nesse momento ficaria esperando esse mesmo lock — um deadlock de
          // aplicação que o Postgres não detecta (não há ciclo no nível do lock manager, só no
          // nível do código). Em vez disso, guarda os dados e relança para que a transação
          // reverta e libere o lock; a gravação de verdade acontece depois, fora do `tx`.
          pendingRecovery.value = { order, connectionId, blingSalesOrderIdStr, alertas };
          throw recordErr;
        }

        return {
          kind: "sent",
          order,
          connectionId,
          blingSalesOrderId: blingSalesOrderIdStr,
          alertas,
        };
      } catch (err) {
        if (pendingRecovery.value) {
          // Este é o `recordErr` relançado acima — não tenta gravar "erro" numa tx já
          // envenenada; a recuperação acontece fora, depois que a transação reverter.
          throw err;
        }
        const attempts = order.blingSyncAttempts + 1;
        const finalStatus = attempts >= MAX_SYNC_ATTEMPTS ? "bloqueado" : "erro";
        await recordSyncResult(tx, order, {
          result: "erro",
          reason: err instanceof Error ? err.message : String(err),
          attempts,
          finalStatus,
        });
        return { kind: "error" };
      }
    });
  } catch (err) {
    if (pendingRecovery.value) {
      // O lock já foi liberado (a transação reverteu antes de chegar aqui). Grava o sucesso
      // numa transação curta separada, para manter a atualização da comanda e a linha de
      // auditoria atômicas entre si, sem segurar o lock original.
      //
      // Residual conhecido: entre o rollback acima e o commit desta transação de recuperação
      // existe uma janela mínima em que um chamador concorrente poderia adquirir o lock (agora
      // livre) e reenviar a mesma comanda ao Bling antes desta gravação terminar — bem mais
      // estreita que a janela original (é a duração de uma escrita local, não de uma chamada
      // HTTP externa), mas não nula. Fechar isso por completo exigiria uma chave de
      // idempotência no payload do Bling ou um novo estado "em andamento", nenhum dos dois
      // faz parte desta correção.
      const { order, connectionId, blingSalesOrderIdStr, alertas } = pendingRecovery.value;
      try {
        await db.transaction(async (recoveryTx) => {
          await recordSyncResult(recoveryTx, order, {
            result: "enviado",
            reason: alertas.length > 0 ? `Alertas do Bling: ${alertas.join("; ")}` : null,
            blingSalesOrderId: blingSalesOrderIdStr,
            attempts: order.blingSyncAttempts,
          });
        });
      } catch (recoveryErr) {
        const recoveryMessage =
          recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
        console.error(
          `[BlingSalesOrderSync] Pedido de venda ${blingSalesOrderIdStr} foi criado no Bling ` +
            `para orderId ${order.id}, mas não foi possível registrar isso mesmo após a ` +
            `transação reverter (${recoveryMessage}). Nenhum registro foi persistido — ` +
            `intervenção manual necessária para evitar duplicar o pedido no próximo retry.`,
        );
        return { kind: "error" };
      }
      // `sent` mesmo vindo pelo caminho de recuperação: o pedido existe no
      // Bling e precisa ser conferido como qualquer outro.
      return {
        kind: "sent",
        order,
        connectionId,
        blingSalesOrderId: blingSalesOrderIdStr,
        alertas,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[BlingSalesOrderSync] Transação falhou para orderId ${orderId} — nenhum registro de sincronização foi persistido para esta comanda: ${message}`,
    );
    return { kind: "error" };
  }
}

/**
 * Lê o pedido de volta do Bling e confere o total contra o da comanda.
 *
 * Roda FORA da transação de envio de propósito: aquela transação segura o lock
 * `FOR UPDATE` da comanda, e uma segunda chamada HTTP lá dentro dobraria o
 * tempo com a linha travada — justamente o cenário que faz o cron pular a
 * comanda e a gravação pós-POST falhar.
 *
 * Nunca mexe em `blingSyncStatus`. Divergência não é falha de envio: o pedido
 * existe no Bling, e voltar para `erro` faria o cron criar um segundo.
 */
export async function verifyBlingSalesOrder(params: {
  orderId: string;
  connectionId: string;
  blingSalesOrderId: string;
  alertas?: string[];
}): Promise<void> {
  const { orderId, connectionId, blingSalesOrderId, alertas = [] } = params;

  try {
    const [order] = await db
      .select()
      .from(restaurantOrders)
      .where(eq(restaurantOrders.id, orderId))
      .limit(1);

    if (!order || !order.total) return;

    const connection = await blingConnectionsService.getById(connectionId);
    if (!connection?.accessTokenEncrypted) {
      throw new Error("Conexão Bling sem token de acesso");
    }

    let accessToken = decryptToken(connection.accessTokenEncrypted);
    const onTokenRefresh = async (): Promise<string> => {
      await blingConnectionsService.refreshConnection(connectionId);
      const refreshed = await blingConnectionsService.getById(connectionId);
      if (!refreshed?.accessTokenEncrypted) {
        throw new Error("Não foi possível renovar o token do Bling");
      }
      accessToken = decryptToken(refreshed.accessTokenEncrypted);
      return accessToken;
    };

    const blingOrder = await getBlingPedidoVenda(
      accessToken,
      Number(blingSalesOrderId),
      onTokenRefresh,
    );

    const subtotalCents = order.subtotal ? toCents(order.subtotal) : 0;
    const result = compareBlingSalesOrderTotals({
      blingOrder,
      expected: {
        totalCents: toCents(order.total),
        subtotalCents,
        serviceFeeCents: optionalCents(order.serviceFeeAmount),
        discountCents: optionalCents(order.discountAmount),
      },
      alertas,
    });

    await recordCheckResult(order, result);

    if (result.status === "divergente") {
      console.warn(
        `[BlingSalesOrderSync] Divergência na comanda ${order.id} / pedido ` +
          `${blingSalesOrderId}: ${result.detail}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[BlingSalesOrderSync] Falha ao conferir o pedido ${blingSalesOrderId} da comanda ${orderId}: ${message}`,
    );
    try {
      const [order] = await db
        .select()
        .from(restaurantOrders)
        .where(eq(restaurantOrders.id, orderId))
        .limit(1);
      if (order) {
        await recordCheckResult(order, {
          status: "erro_conferencia",
          detail: `Não foi possível conferir o pedido no Bling: ${message}`,
          blingOrderNumber: null,
        });
      }
    } catch {
      // Já logado acima; não há mais o que fazer sem mascarar o erro original.
    }
  }
}

async function recordCheckResult(
  order: RestaurantOrder,
  result: {
    status: "ok" | "divergente" | "erro_conferencia" | null;
    detail: string | null;
    blingOrderNumber: string | null;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(restaurantOrders)
      .set({
        blingCheckStatus: result.status,
        blingCheckDetail: result.detail,
        blingCheckedAt: new Date(),
        blingSalesOrderNumber: result.blingOrderNumber ?? order.blingSalesOrderNumber,
        updatedAt: new Date(),
      })
      .where(eq(restaurantOrders.id, order.id));

    // Só registra no log o que é um veredito de conferência de verdade —
    // "não aplicável (mock)" não é evento de auditoria.
    if (result.status === "ok" || result.status === "divergente") {
      await tx.insert(restaurantOrderBlingSyncLog).values({
        orderId: order.id,
        unitId: order.unitId,
        result: result.status === "ok" ? "conferido" : "divergente",
        reason: result.detail,
        blingSalesOrderId: order.blingSalesOrderId,
      });
    }
  });
}

/**
 * Envia o pedido de venda ao Bling e, se criado, confere o total de volta.
 *
 * Assinatura pública inalterada — `closeOrder`, o cron e o reenvio manual
 * continuam chamando só isto.
 */
export async function sendOrderToBling(orderId: string): Promise<void> {
  const attempt = await attemptSendOrderToBling(orderId);
  if (attempt.kind !== "sent") return;

  await verifyBlingSalesOrder({
    orderId,
    connectionId: attempt.connectionId,
    blingSalesOrderId: attempt.blingSalesOrderId,
    alertas: attempt.alertas,
  });
}

export interface RetryBlingSyncResult {
  action: "reenviado" | "conferido";
  /** A comanda recarregada, para a tela refletir o novo status sem refetch. */
  order: RestaurantOrder;
}

/**
 * Reenvio manual pelo gestor — o caminho para destravar comanda `bloqueado`,
 * que o cron nunca retenta (o motivo do bloqueio é configuração, e retentar
 * sozinho só queimaria tentativas).
 *
 * Comanda já enviada não é re-POSTada: roda só a conferência. Assim o botão
 * serve tanto para destravar quanto para reconferir, em vez de devolver um
 * 409 inútil quando o gestor quer justamente checar a divergência.
 */
export async function retryBlingSalesOrderSync(
  orderId: string,
): Promise<RetryBlingSyncResult> {
  const [order] = await db
    .select()
    .from(restaurantOrders)
    .where(eq(restaurantOrders.id, orderId))
    .limit(1);

  if (!order) {
    throw Object.assign(new Error("Comanda não encontrada"), { code: "NOT_FOUND" });
  }
  if (order.status !== "fechada") {
    throw Object.assign(
      new Error("Só comanda fechada gera pedido de venda no Bling"),
      { code: "ORDER_NOT_CLOSED" },
    );
  }

  if (shouldSkipBlingSend(order) && order.blingSalesOrderId) {
    if (!order.blingConnectionId) {
      throw Object.assign(new Error("Comanda sem conta Bling vinculada"), {
        code: "NO_BLING_CONNECTION",
      });
    }
    await verifyBlingSalesOrder({
      orderId,
      connectionId: order.blingConnectionId,
      blingSalesOrderId: order.blingSalesOrderId,
    });
    return { action: "conferido", order: await reloadOrder(orderId) };
  }

  // Zerar as tentativas é o que tira a comanda do teto de 5 e a devolve ao
  // cron caso este envio também falhe.
  await db
    .update(restaurantOrders)
    .set({
      blingSyncStatus: "pendente",
      blingSyncError: null,
      blingSyncAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(restaurantOrders.id, orderId));

  await sendOrderToBling(orderId);
  return { action: "reenviado", order: await reloadOrder(orderId) };
}

async function reloadOrder(orderId: string): Promise<RestaurantOrder> {
  const [order] = await db
    .select()
    .from(restaurantOrders)
    .where(eq(restaurantOrders.id, orderId))
    .limit(1);
  if (!order) {
    throw Object.assign(new Error("Comanda não encontrada"), { code: "NOT_FOUND" });
  }
  return order;
}
