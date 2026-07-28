import { format } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import type { RestaurantOrder, RestaurantOrderItem } from "../../shared/schema";
import {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderBlingSyncLog,
  blingProductMappings,
  blingContactMappings,
  blingSellerMappings,
  pdvUnits,
} from "../../shared/schema";
import type {
  BlingPedidoVendaItemPayload,
  BlingPedidoVendaPayload,
} from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";
import { decryptToken } from "../lib/token-crypto";
import { createBlingPedidoVenda } from "../integrations/bling";
import type { DbExecutor } from "../db";

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
 * Simula a criação do pedido de venda no Bling, sem chamar a API real. Usado
 * enquanto o PDV Restaurante está em fase de testes, para não gerar pedidos
 * de venda de teste na conta Bling real (ver `BLING_PEDIDO_VENDA_MOCK`).
 */
function createMockBlingPedidoVenda(
  orderId: string,
): { id: number; alertas: string[] } {
  const mockId = -Date.now();
  console.log(
    `[Bling Sync] MOCK ativo — pedido de venda simulado (id=${mockId}) para orderId ${orderId}`,
  );
  return { id: mockId, alertas: [] };
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

const MAX_SYNC_ATTEMPTS = 5;

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
      .select({ defaultClientId: pdvUnits.defaultClientId })
      .from(pdvUnits)
      .where(eq(pdvUnits.id, order.unitId))
      .limit(1);

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
      blingSyncError: params.reason,
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

/**
 * Tenta enviar o pedido de venda da comanda fechada ao Bling. Usada tanto na
 * tentativa imediata pós-fechamento quanto no cron de retry e no reenvio
 * manual do admin — sempre o mesmo caminho de código.
 *
 * `FOR UPDATE SKIP LOCKED`: se duas chamadas colidirem na mesma comanda
 * (tentativa imediata + cron, ou dois ticks do cron), quem chegar primeiro
 * processa; a outra pula a linha em vez de esperar ou duplicar o pedido de
 * venda no Bling.
 */
export async function sendOrderToBling(orderId: string): Promise<void> {
  // `box` em vez de `let` direto: TypeScript não consegue estreitar (narrow) uma variável
  // `let` reatribuída apenas dentro de uma closure aninhada seguida de `throw` — o resultado
  // é um falso `never` no `if (pendingRecovery.value)` do catch externo. Um objeto mutável
  // captado por referência não sofre esse problema de control-flow analysis.
  const pendingRecovery: { value: { order: RestaurantOrder; blingSalesOrderIdStr: string } | null } = {
    value: null,
  };

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, orderId), eq(restaurantOrders.status, "fechada")))
        .for("update", { skipLocked: true });

      if (!order) return;

      if (!order.blingConnectionId) {
        await recordSyncResult(tx, order, {
          result: "bloqueado",
          reason: "Comanda sem conta Bling vinculada (unidade sem catálogo configurado)",
        });
        return;
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

      const resolved = resolveBlingSalesOrderPayload({
        order,
        items,
        blingProductIdByProductId,
        contactBlingId,
        sellerBlingId,
      });

      if (!resolved.ok) {
        await recordSyncResult(tx, order, { result: "bloqueado", reason: resolved.reason });
        return;
      }

      try {
        const isBlingMock = process.env.BLING_PEDIDO_VENDA_MOCK === "true";

        let blingSalesOrderId: number;
        if (isBlingMock) {
          ({ id: blingSalesOrderId } = createMockBlingPedidoVenda(order.id));
        } else {
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

          ({ id: blingSalesOrderId } = await createBlingPedidoVenda(
            accessToken,
            resolved.payload,
            onTokenRefresh,
          ));
        }
        const blingSalesOrderIdStr = String(blingSalesOrderId);

        try {
          await recordSyncResult(tx, order, {
            result: "enviado",
            reason: null,
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
          pendingRecovery.value = { order, blingSalesOrderIdStr };
          throw recordErr;
        }
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
      const { order, blingSalesOrderIdStr } = pendingRecovery.value;
      try {
        await db.transaction(async (recoveryTx) => {
          await recordSyncResult(recoveryTx, order, {
            result: "enviado",
            reason: null,
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
      }
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[BlingSalesOrderSync] Transação falhou para orderId ${orderId} — nenhum registro de sincronização foi persistido para esta comanda: ${message}`,
    );
  }
}
