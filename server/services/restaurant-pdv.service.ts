import { db, type DbExecutor } from "../db";
import {
  restaurantMenuItems,
  restaurantOrders,
  restaurantOrderItems,
  restaurantTables,
  restaurantOrderPayments,
  restaurantPdvSettings,
  pdvUnits,
  systemSettings,
  blingProductMappings,
  products,
  users,
} from "../../shared/schema";
import { eq, and, desc, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import type {
  RestaurantMenuItem,
  InsertRestaurantMenuItem,
  RestaurantOrder,
  RestaurantOrderItem,
} from "../../shared/schema";
import { restaurantOrderAuditService } from "./restaurant-order-audit.service";
import { sendOrderToBling } from "./bling-sales-order.service";
import { restaurantOrderPaymentsService } from "./restaurant-order-payments.service";
import { restaurantCashSessionService } from "./restaurant-cash-session.service";
import {
  calculateOrderTotals,
  toCents,
  fromCents,
  validatePaymentsAgainstTotal,
} from "../../shared/restaurant-order-totals";
import { isOrderInUnit } from "../../shared/restaurant-order-access";

export interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

/**
 * Carrega a comanda com a linha travada (`SELECT ... FOR UPDATE`) e confere o
 * status esperado dentro da mesma transação.
 *
 * É o que impede duas requisições concorrentes de fechar, mesclar ou cancelar a
 * mesma comanda: a segunda fica bloqueada até a primeira comitar e só então lê
 * o status já alterado.
 */
export async function lockOrderForUpdate(
  tx: DbExecutor,
  orderId: string,
  expectedStatus: RestaurantOrder["status"],
): Promise<RestaurantOrder> {
  const [order] = await tx
    .select()
    .from(restaurantOrders)
    .where(eq(restaurantOrders.id, orderId))
    .limit(1)
    .for("update");

  if (!order) {
    throw Object.assign(new Error("Comanda não encontrada"), { code: "NOT_FOUND" });
  }
  if (order.status !== expectedStatus) {
    throw Object.assign(
      new Error(
        order.status === "aberta"
          ? "Esta comanda está aberta"
          : "Esta comanda já foi fechada",
      ),
      { code: "ORDER_CLOSED" },
    );
  }
  return order;
}

/**
 * Recusa operar uma comanda de outra unidade PDV. A regra em si mora em
 * `shared/restaurant-order-access.ts` para ser testável sem banco.
 *
 * Usa a mensagem de "não encontrada": dizer "existe, mas não é sua" já entrega
 * a existência da comanda de outra unidade.
 */
export function assertOrderBelongsToUnit(
  order: Pick<RestaurantOrder, "unitId">,
  unitId?: string | null,
): void {
  if (!isOrderInUnit(order, unitId)) {
    throw Object.assign(new Error("Comanda não encontrada"), { code: "FORBIDDEN" });
  }
}

/**
 * Roda `fn` numa transação com a comanda travada e já validada: aberta, da
 * unidade certa e sem conta pedida. Toda mutação de comanda passa por aqui, de
 * modo que o guard de unidade e o de estado moram num lugar só — em vez de
 * espalhados por vinte controllers, onde esquecer um é invisível.
 */
async function withEditableOrder<T>(
  orderId: string,
  unitId: string | null | undefined,
  fn: (tx: DbExecutor, order: RestaurantOrder) => Promise<T>,
): Promise<T> {
  return withOpenOrder(orderId, unitId, async (tx, order) => {
    assertOrderNotAwaitingPayment(order);
    return fn(tx, order);
  });
}

/**
 * Como `withEditableOrder`, mas aceita comanda com a conta já pedida — para as
 * operações que existem justamente para mexer nesse estado (pedir/cancelar a
 * conta) e para o fechamento.
 */
async function withOpenOrder<T>(
  orderId: string,
  unitId: string | null | undefined,
  fn: (tx: DbExecutor, order: RestaurantOrder) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const order = await lockOrderForUpdate(tx, orderId, "aberta");
    assertOrderBelongsToUnit(order, unitId);
    return fn(tx, order);
  });
}

/**
 * Soma os pagamentos das comandas dadas, em centavos, usando o executor
 * recebido — para que a leitura participe da transação do chamador em vez de
 * enxergar um estado que pode mudar antes do UPDATE.
 */
async function sumPaymentsCents(
  tx: DbExecutor,
  orderIds: string[],
): Promise<number> {
  const rows = await tx
    .select({ amount: restaurantOrderPayments.amount })
    .from(restaurantOrderPayments)
    .where(inArray(restaurantOrderPayments.orderId, orderIds));

  return rows.reduce((sum, row) => sum + toCents(row.amount), 0);
}

function assertOrderNotAwaitingPayment(order: RestaurantOrder): void {
  if (order.paymentRequestedAt) {
    throw Object.assign(
      new Error(
        "A conta já foi solicitada — cancele o pedido de conta para editar a comanda",
      ),
      { code: "PAYMENT_REQUESTED" },
    );
  }
}

/**
 * Trava as duas comandas de uma transferência/mesclagem na mesma transação.
 *
 * A ordem de travamento é sempre a mesma (ordenada por id) porque duas
 * operações cruzadas simultâneas — A→B e B→A — travariam uma linha cada e
 * ficariam esperando a outra para sempre.
 */
async function lockOrderPairForUpdate(
  tx: DbExecutor,
  sourceOrderId: string,
  targetOrderId: string,
  unitId: string | null | undefined,
): Promise<{ source: RestaurantOrder; target: RestaurantOrder }> {
  const sourceFirst = sourceOrderId < targetOrderId;
  const [firstId, secondId] = sourceFirst
    ? [sourceOrderId, targetOrderId]
    : [targetOrderId, sourceOrderId];

  const first = await lockOrderForUpdate(tx, firstId, "aberta");
  const second = await lockOrderForUpdate(tx, secondId, "aberta");

  const source = sourceFirst ? first : second;
  const target = sourceFirst ? second : first;

  for (const order of [source, target]) {
    assertOrderBelongsToUnit(order, unitId);
    assertOrderNotAwaitingPayment(order);
  }

  return { source, target };
}

export const RESTAURANT_PDV_BLING_CONNECTION_SETTING_KEY =
  "restaurant_pdv_bling_connection_id";

export const restaurantPdvService = {
  /** Lê a conexão Bling da unidade PDV. Fallback para system_settings (legado). */
  async getRestaurantPdvBlingConnectionId(unitId?: string | null): Promise<string | undefined> {
    if (unitId) {
      const [unit] = await db
        .select({ blingConnectionId: pdvUnits.blingConnectionId })
        .from(pdvUnits)
        .where(eq(pdvUnits.id, unitId))
        .limit(1);
      if (unit?.blingConnectionId) return unit.blingConnectionId;
    }
    // Fallback legado
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, RESTAURANT_PDV_BLING_CONNECTION_SETTING_KEY));
    return setting?.value ?? undefined;
  },
  async listMenuItems(activeOnly = true, unitId?: string): Promise<RestaurantMenuItem[]> {
    const conditions = [
      activeOnly ? eq(restaurantMenuItems.isActive, true) : undefined,
      unitId ? eq(restaurantMenuItems.unitId, unitId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    return db
      .select()
      .from(restaurantMenuItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(restaurantMenuItems.category, restaurantMenuItems.name);
  },

  async createMenuItem(
    data: InsertRestaurantMenuItem,
  ): Promise<RestaurantMenuItem> {
    const [created] = await db
      .insert(restaurantMenuItems)
      .values(data)
      .returning();
    return created;
  },

  async updateMenuItem(
    id: string,
    data: Partial<InsertRestaurantMenuItem>,
  ): Promise<RestaurantMenuItem | null> {
    const [updated] = await db
      .update(restaurantMenuItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(restaurantMenuItems.id, id))
      .returning();
    return updated ?? null;
  },

  async deactivateMenuItem(id: string): Promise<void> {
    await db
      .update(restaurantMenuItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(restaurantMenuItems.id, id));
  },

  async openOrder(data: {
    tableId: string | null;
    tableNumber?: number;
    peopleCount: number;
    waiterId: string;
    unitId?: string | null;
    clientId?: string | null;
    clientName?: string | null;
  }): Promise<RestaurantOrder> {
    // Nada acontece sem caixa aberto: a comanda que nasce fora de uma sessão
    // fecharia sem entrar em nenhuma conferência.
    await restaurantCashSessionService.assertSessionOpen(data.waiterId, data.unitId ?? undefined);

    let resolvedTableNumber: number;

    if (data.tableId) {
      const [table] = await db
        .select()
        .from(restaurantTables)
        .where(eq(restaurantTables.id, data.tableId))
        .limit(1);

      if (!table || !table.isActive) {
        throw Object.assign(new Error("Mesa não encontrada"), { code: "NOT_FOUND" });
      }

      const [existingOpenOrder] = await db
        .select({ id: restaurantOrders.id })
        .from(restaurantOrders)
        .where(
          and(
            eq(restaurantOrders.tableId, data.tableId),
            eq(restaurantOrders.status, "aberta"),
          ),
        )
        .limit(1);

      if (existingOpenOrder) {
        throw Object.assign(new Error("Esta mesa já está ocupada"), {
          code: "TABLE_OCCUPIED",
        });
      }

      resolvedTableNumber = table.number;
    } else {
      // Mesa avulsa — sem vínculo a uma mesa cadastrada
      resolvedTableNumber = data.tableNumber!;

      // A checagem é por (unidade, número): sem o filtro de unidade, a mesa 5 de
      // um restaurante bloqueava a mesa 5 de outro. Só compara com outras
      // avulsas — mesa cadastrada tem `tableId` e é tratada no ramo acima.
      const [duplicate] = await db
        .select({ id: restaurantOrders.id })
        .from(restaurantOrders)
        .where(
          and(
            isNull(restaurantOrders.tableId),
            eq(restaurantOrders.tableNumber, resolvedTableNumber),
            eq(restaurantOrders.status, "aberta"),
            data.unitId
              ? eq(restaurantOrders.unitId, data.unitId)
              : isNull(restaurantOrders.unitId),
          ),
        )
        .limit(1);

      if (duplicate) {
        throw Object.assign(
          new Error(`A Mesa ${resolvedTableNumber} já está aberta`),
          { code: "TABLE_OCCUPIED" },
        );
      }
    }

    const blingConnectionId = await this.getRestaurantPdvBlingConnectionId(data.unitId);

    // Lê a taxa de serviço padrão da unidade PDV; fallback para settings legado; fallback 10%.
    let serviceFeePercent = "10.00";
    if (data.unitId) {
      const [unit] = await db.select().from(pdvUnits).where(eq(pdvUnits.id, data.unitId)).limit(1);
      serviceFeePercent = unit?.defaultServiceFeePercent ?? "10.00";
    } else {
      const [pdvSettings] = await db.select().from(restaurantPdvSettings).limit(1);
      serviceFeePercent = pdvSettings?.defaultServiceFeePercent ?? "10.00";
    }

    try {
      const [created] = await db
        .insert(restaurantOrders)
        .values({
          tableId: data.tableId ?? null,
          tableNumber: resolvedTableNumber,
          peopleCount: data.peopleCount,
          waiterId: data.waiterId,
          blingConnectionId: blingConnectionId ?? null,
          clientId: data.clientId ?? null,
          clientName: data.clientName ?? null,
          serviceFeePercent,
          unitId: data.unitId ?? null,
        })
        .returning();
      return created;
    } catch (error: any) {
      // A checagem acima roda fora de transação, então duas aberturas
      // simultâneas passam as duas. Quem garante de verdade é o índice único
      // parcial (`scripts/create-restaurant-pdv-constraints.mjs`); aqui só
      // traduzimos a violação para o mesmo erro de negócio da checagem.
      if (error?.code === "23505") {
        throw Object.assign(
          new Error(`A Mesa ${resolvedTableNumber} já está aberta`),
          { code: "TABLE_OCCUPIED" },
        );
      }
      throw error;
    }
  },

  async getOrderWithItems(
    orderId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrderWithItems | null> {
    const [order] = await db
      .select()
      .from(restaurantOrders)
      .where(eq(restaurantOrders.id, orderId))
      .limit(1);

    if (!order) return null;
    // Devolve "não encontrada" em vez de 403: confirmar que a comanda existe já
    // entrega informação de outra unidade.
    if (unitId && order.unitId != null && order.unitId !== unitId) return null;

    const items = await db
      .select()
      .from(restaurantOrderItems)
      .where(
        and(
          eq(restaurantOrderItems.orderId, orderId),
          eq(restaurantOrderItems.status, "ativo"),
        ),
      )
      .orderBy(restaurantOrderItems.createdAt);

    return { ...order, items };
  },

  async listOrders(filters: {
    /** Derivado do enum do schema para não sair de sincronia com o banco. */
    status?: RestaurantOrder["status"];
    waiterId?: string;
    from?: Date;
    to?: Date;
    unitId?: string;
  }): Promise<(RestaurantOrder & { paymentsCount: number; waiterName: string | null })[]> {
    const conditions = [
      filters.status ? eq(restaurantOrders.status, filters.status) : undefined,
      filters.waiterId ? eq(restaurantOrders.waiterId, filters.waiterId) : undefined,
      filters.from ? gte(restaurantOrders.openedAt, filters.from) : undefined,
      filters.to ? lte(restaurantOrders.openedAt, filters.to) : undefined,
      filters.unitId ? eq(restaurantOrders.unitId, filters.unitId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const rows = await db
      .select({
        order: restaurantOrders,
        paymentsCount: sql<number>`count(${restaurantOrderPayments.id})`,
        waiterName: users.name,
      })
      .from(restaurantOrders)
      .leftJoin(
        restaurantOrderPayments,
        eq(restaurantOrderPayments.orderId, restaurantOrders.id),
      )
      .leftJoin(users, eq(restaurantOrders.waiterId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(restaurantOrders.id, users.name)
      .orderBy(desc(restaurantOrders.openedAt));

    return rows.map((row) => ({
      ...row.order,
      paymentsCount: Number(row.paymentsCount),
      waiterName: row.waiterName,
    }));
  },

  async addItem(
    orderId: string,
    data: {
      menuItemId?: string | null;
      productId?: string | null;
      name: string;
      unitPrice: string;
      quantity: number;
      notes?: string | null;
    },
    unitId?: string | null,
    actorId?: string,
  ): Promise<RestaurantOrderItem> {
    return withEditableOrder(orderId, unitId, async (tx, order) => {
      let name = data.name;
      let unitPrice = data.unitPrice;

      if (data.productId) {
        if (!order.blingConnectionId) {
          throw Object.assign(
            new Error(
              "Esta comanda não tem uma conta Bling vinculada; não é possível adicionar produtos do catálogo.",
            ),
            { code: "NO_BLING_CONNECTION" },
          );
        }

        const [mapping] = await tx
          .select({ id: blingProductMappings.id })
          .from(blingProductMappings)
          .where(
            and(
              eq(blingProductMappings.connectionId, order.blingConnectionId),
              eq(blingProductMappings.productId, data.productId),
            ),
          )
          .limit(1);

        if (!mapping) {
          throw Object.assign(
            new Error("Produto não vinculado à conta Bling desta comanda."),
            { code: "PRODUCT_NOT_LINKED" },
          );
        }

        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, data.productId))
          .limit(1);

        if (!product) {
          throw Object.assign(new Error("Produto não encontrado"), {
            code: "NOT_FOUND",
          });
        }

        name = product.name;
        unitPrice = product.negotiatedPrice;
      } else if (data.menuItemId) {
        // Preço vem do cardápio, nunca do cliente. Antes o valor enviado era
        // gravado como veio, o que anulava a regra de que só gestor altera
        // preço (`updateOrderItemController`): bastava ao garçom JÁ adicionar o
        // item com o preço que quisesse.
        const [menuItem] = await tx
          .select()
          .from(restaurantMenuItems)
          .where(eq(restaurantMenuItems.id, data.menuItemId))
          .limit(1);

        if (!menuItem || !menuItem.isActive) {
          throw Object.assign(new Error("Item do cardápio não encontrado"), {
            code: "NOT_FOUND",
          });
        }

        name = menuItem.name;
        unitPrice = menuItem.price;
      }

      const [created] = await tx
        .insert(restaurantOrderItems)
        .values({
          orderId,
          menuItemId: data.menuItemId ?? null,
          productId: data.productId ?? null,
          name,
          notes: data.notes ?? null,
          // Normaliza o formato para a coluna `numeric`; item avulso ainda usa o
          // preço digitado, mas já validado no controller.
          unitPrice: fromCents(toCents(unitPrice)),
          quantity: data.quantity,
        })
        .returning();

      // Item avulso é o único caminho em que o preço vem do operador — cardápio
      // e catálogo são relidos do banco acima. Fica auditado para que um preço
      // fora da tabela seja conferível depois, já que a operação segue liberada
      // ao garçom.
      if (!data.menuItemId && !data.productId && actorId) {
        await restaurantOrderAuditService.logOrderAudit(orderId, "item_editado", actorId, {
          metadata: {
            itemId: created.id,
            itemName: created.name,
            avulso: true,
            unitPrice: created.unitPrice,
            quantity: created.quantity,
          },
          tx,
        });
      }

      return created;
    });
  },

  async updateItem(
    orderId: string,
    itemId: string,
    data: { unitPrice?: string; quantity?: number },
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrderItem | null> {
    return withEditableOrder(orderId, unitId, async (tx) => {
      // Estado anterior é lido antes do update para registrar o "de → para" na
      // auditoria: alterar preço de item é a via mais fácil de dar desconto sem
      // passar pelo fluxo de desconto, que exige gestor e já é auditado.
      const [before] = await tx
        .select()
        .from(restaurantOrderItems)
        .where(
          and(
            eq(restaurantOrderItems.id, itemId),
            eq(restaurantOrderItems.orderId, orderId),
          ),
        )
        .limit(1);

      if (!before) return null;

      const [updated] = await tx
        .update(restaurantOrderItems)
        .set({
          ...data,
          ...(data.unitPrice !== undefined
            ? { unitPrice: fromCents(toCents(data.unitPrice)) }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(restaurantOrderItems.id, itemId),
            eq(restaurantOrderItems.orderId, orderId),
          ),
        )
        .returning();

      if (!updated) return null;

      const priceChanged = toCents(before.unitPrice) !== toCents(updated.unitPrice);
      const quantityChanged = before.quantity !== updated.quantity;

      if (priceChanged || quantityChanged) {
        await restaurantOrderAuditService.logOrderAudit(orderId, "item_editado", actorId, {
          metadata: {
            itemId,
            itemName: updated.name,
            ...(priceChanged
              ? { unitPriceFrom: before.unitPrice, unitPriceTo: updated.unitPrice }
              : {}),
            ...(quantityChanged
              ? { quantityFrom: before.quantity, quantityTo: updated.quantity }
              : {}),
          },
          tx,
        });
      }

      return updated;
    });
  },

  async cancelItem(
    orderId: string,
    itemId: string,
    reason: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<void> {
    await withEditableOrder(orderId, unitId, async (tx) => {
      const [cancelled] = await tx
        .update(restaurantOrderItems)
        .set({
          status: "cancelado",
          cancelReason: reason,
          cancelledBy: actorId,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(restaurantOrderItems.id, itemId),
            eq(restaurantOrderItems.orderId, orderId),
            eq(restaurantOrderItems.status, "ativo"),
          ),
        )
        .returning({ id: restaurantOrderItems.id, name: restaurantOrderItems.name });

      if (!cancelled) {
        throw Object.assign(new Error("Item não encontrado ou já cancelado"), {
          code: "NOT_FOUND",
        });
      }

      await restaurantOrderAuditService.logOrderAudit(orderId, "item_cancelado", actorId, {
        reason,
        metadata: { itemId, itemName: cancelled.name },
        tx,
      });
    });
  },

  async applyDiscount(
    orderId: string,
    data: { discountPercent?: string; discountAmount?: string; reason: string },
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    return withEditableOrder(orderId, unitId, async (tx) => {
      const [updated] = await tx
        .update(restaurantOrders)
        .set({
          discountPercent: data.discountPercent ?? null,
          discountAmount: data.discountAmount ?? null,
          discountReason: data.reason,
          discountAppliedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      await restaurantOrderAuditService.logOrderAudit(orderId, "desconto_aplicado", actorId, {
        reason: data.reason,
        metadata: { discountPercent: data.discountPercent, discountAmount: data.discountAmount },
        tx,
      });

      return updated;
    });
  },

  async removeDiscount(
    orderId: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    return withEditableOrder(orderId, unitId, async (tx) => {
      const [updated] = await tx
        .update(restaurantOrders)
        .set({
          discountPercent: null,
          discountAmount: null,
          discountReason: null,
          discountAppliedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      await restaurantOrderAuditService.logOrderAudit(orderId, "desconto_removido", actorId, {
        tx,
      });

      return updated;
    });
  },

  async closeOrder(
    orderId: string,
    paymentMethod: "pix" | "cartao_credito" | "cartao_debito" | "dinheiro" | undefined,
    actorId: string,
    payments?: {
      method: "pix" | "cartao_credito" | "cartao_debito" | "dinheiro";
      amount: string;
      payerLabel?: string | null;
    }[],
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    // Ler, decidir e escrever tudo dentro da transação, com a linha da comanda
    // travada. Antes `assertOrderOpen` lia FORA da transação e o UPDATE filtrava
    // só por id: dois cliques em "Fechar Comanda" — ou dois garçons na mesma
    // mesa — passavam ambos pelo assert e inseriam pagamentos duplicados,
    // inflando a conferência de caixa.
    const closed = await db.transaction(async (tx) => {
      const order = await lockOrderForUpdate(tx, orderId, "aberta");
      assertOrderBelongsToUnit(order, unitId);

      const items = await tx
        .select()
        .from(restaurantOrderItems)
        .where(
          and(
            eq(restaurantOrderItems.orderId, orderId),
            eq(restaurantOrderItems.status, "ativo"),
          ),
        );

      if (items.length === 0) {
        throw Object.assign(new Error("Não é possível fechar uma comanda sem itens"), {
          code: "NO_ITEMS",
        });
      }

      const { subtotalCents, serviceFeeCents, totalCents } = calculateOrderTotals({
        items,
        serviceFeePercent: order.serviceFeePercent,
        discountAmount: order.discountAmount,
        discountPercent: order.discountPercent,
      });

      const existingPayments = await tx
        .select()
        .from(restaurantOrderPayments)
        .where(eq(restaurantOrderPayments.orderId, orderId));

      // Pagamentos da divisão de conta chegam junto com o fechamento: registrar e
      // fechar precisa ser tudo-ou-nada. Antes eram requisições separadas — se o
      // fechamento falhasse (ex.: soma divergente), os pagamentos já gravados
      // ficavam órfãos e a comanda travava.
      const allPayments = [
        ...existingPayments.map((p) => ({ method: p.method, amount: p.amount })),
        ...(payments ?? []),
      ];

      let finalPaymentMethod: typeof paymentMethod | null = paymentMethod ?? null;

      if (allPayments.length === 0) {
        if (!paymentMethod) {
          throw Object.assign(
            new Error("Informe a forma de pagamento ou registre os pagamentos da comanda"),
            { code: "NO_PAYMENT_METHOD" },
          );
        }
      } else {
        finalPaymentMethod = validatePaymentsAgainstTotal(
          allPayments,
          totalCents,
        ).finalPaymentMethod;
      }

      // Carimba a sessão de caixa do operador que está recebendo o dinheiro.
      const cashSession = await restaurantCashSessionService.assertSessionOpen(
        actorId,
        unitId ?? undefined,
      );

      if (allPayments.length === 0 && paymentMethod) {
        await tx.insert(restaurantOrderPayments).values({
          orderId,
          method: paymentMethod,
          amount: fromCents(totalCents),
        });
      }

      for (const payment of payments ?? []) {
        await tx.insert(restaurantOrderPayments).values({
          orderId,
          method: payment.method,
          // Normaliza para o formato da coluna `numeric` — o valor veio do
          // cliente e já passou pela validação de formato no controller.
          amount: fromCents(toCents(payment.amount)),
          payerLabel: payment.payerLabel ?? null,
        });
      }

      const [updated] = await tx
        .update(restaurantOrders)
        .set({
          status: "fechada",
          paymentMethod: finalPaymentMethod,
          cashSessionId: cashSession.id,
          subtotal: fromCents(subtotalCents),
          serviceFeeAmount: fromCents(serviceFeeCents),
          total: fromCents(totalCents),
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        // Guard redundante com o `FOR UPDATE` de propósito: se algum caminho
        // futuro fechar sem travar a linha, o UPDATE ainda não sobrescreve uma
        // comanda já fechada.
        .where(
          and(
            eq(restaurantOrders.id, orderId),
            eq(restaurantOrders.status, "aberta"),
          ),
        )
        .returning();

      if (!updated) {
        throw Object.assign(new Error("Esta comanda já foi fechada"), {
          code: "ORDER_CLOSED",
        });
      }

      await restaurantOrderAuditService.logOrderAudit(orderId, "comanda_fechada", actorId, {
        metadata: { paymentMethod: finalPaymentMethod, total: fromCents(totalCents) },
        tx,
      });

      return updated;
    });

    // Fire-and-forget: o fechamento nunca espera nem falha por causa do
    // Bling. Falha vira `bling_sync_status = 'erro'`/`'bloqueado'`, coberta
    // pelo cron de retry (bling-sales-order-sync-scheduler.ts).
    sendOrderToBling(closed.id).catch((err) => {
      console.error(
        `[Bling Sync] Falha ao iniciar envio da comanda ${closed.id}:`,
        err,
      );
    });

    return closed;
  },

  /**
   * `unitId` é o da requisição (`req.pdvUnitId`). Passá-lo é o que impede um
   * operador de uma unidade manipular a comanda de outra — sem ele a checagem
   * simplesmente não acontece, então trate a omissão como decisão consciente.
   */
  async assertOrderOpen(
    orderId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    const [order] = await db
      .select()
      .from(restaurantOrders)
      .where(eq(restaurantOrders.id, orderId))
      .limit(1);

    if (!order) {
      throw Object.assign(new Error("Comanda não encontrada"), {
        code: "NOT_FOUND",
      });
    }
    assertOrderBelongsToUnit(order, unitId);
    if (order.status !== "aberta") {
      throw Object.assign(new Error("Esta comanda já foi fechada"), {
        code: "ORDER_CLOSED",
      });
    }
    return order;
  },

  async assertOrderEditable(
    orderId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    const order = await this.assertOrderOpen(orderId, unitId);
    assertOrderNotAwaitingPayment(order);
    return order;
  },

  async requestPayment(
    orderId: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    return withOpenOrder(orderId, unitId, async (tx, order) => {
      if (order.paymentRequestedAt) return order;

      const [updated] = await tx
        .update(restaurantOrders)
        .set({ paymentRequestedAt: new Date(), updatedAt: new Date() })
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      await restaurantOrderAuditService.logOrderAudit(
        orderId,
        "pagamento_solicitado",
        actorId,
        { tx },
      );
      return updated;
    });
  },

  async cancelPaymentRequest(
    orderId: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    return withOpenOrder(orderId, unitId, async (tx, order) => {
      if (!order.paymentRequestedAt) return order;

      const [updated] = await tx
        .update(restaurantOrders)
        .set({ paymentRequestedAt: null, updatedAt: new Date() })
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      await restaurantOrderAuditService.logOrderAudit(
        orderId,
        "pagamento_cancelado",
        actorId,
        { tx },
      );
      return updated;
    });
  },

  /**
   * Vincula (ou desvincula) o cliente da comanda.
   *
   * Passava por `UPDATE` direto no controller, sem checar status: dava para
   * trocar o cliente de uma comanda **já fechada**, o que reescreve a quem a
   * venda pertence depois do fato — com efeito fiscal e de cashback.
   */
  async updateOrderClient(
    orderId: string,
    data: { clientId: string | null; clientName: string | null },
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    return withOpenOrder(orderId, unitId, async (tx, order) => {
      const [updated] = await tx
        .update(restaurantOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      await restaurantOrderAuditService.logOrderAudit(orderId, "cliente_vinculado", actorId, {
        metadata: {
          clientIdFrom: order.clientId,
          clientIdTo: data.clientId,
          clientNameTo: data.clientName,
        },
        tx,
      });

      return updated;
    });
  },

  async updateOrderPeopleCount(
    orderId: string,
    peopleCount: number,
    actorId: string,
    unitId?: string | null,
  ): Promise<RestaurantOrder> {
    return withOpenOrder(orderId, unitId, async (tx, order) => {
      const [updated] = await tx
        .update(restaurantOrders)
        .set({ peopleCount, updatedAt: new Date() })
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      if (order.peopleCount !== peopleCount) {
        await restaurantOrderAuditService.logOrderAudit(orderId, "pessoas_alteradas", actorId, {
          metadata: { from: order.peopleCount, to: peopleCount },
          tx,
        });
      }

      return updated;
    });
  },

  async transferItems(
    sourceOrderId: string,
    itemIds: string[],
    targetOrderId: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<void> {
    if (sourceOrderId === targetOrderId) {
      throw Object.assign(new Error("Mesa de origem e destino são a mesma"), {
        code: "INVALID_TARGET",
      });
    }

    await db.transaction(async (tx) => {
      await lockOrderPairForUpdate(tx, sourceOrderId, targetOrderId, unitId);

      const moved = await tx
        .update(restaurantOrderItems)
        .set({ orderId: targetOrderId, updatedAt: new Date() })
        .where(
          and(
            eq(restaurantOrderItems.orderId, sourceOrderId),
            eq(restaurantOrderItems.status, "ativo"),
            inArray(restaurantOrderItems.id, itemIds),
          ),
        )
        .returning({ id: restaurantOrderItems.id });

      if (moved.length === 0) {
        throw Object.assign(new Error("Nenhum item válido para transferir"), {
          code: "NOT_FOUND",
        });
      }

      const metadata = { itemIds: moved.map((m) => m.id) };
      await restaurantOrderAuditService.logOrderAudit(
        sourceOrderId,
        "itens_transferidos",
        actorId,
        { metadata: { ...metadata, direction: "saida", targetOrderId }, tx },
      );
      await restaurantOrderAuditService.logOrderAudit(
        targetOrderId,
        "itens_transferidos",
        actorId,
        { metadata: { ...metadata, direction: "entrada", sourceOrderId }, tx },
      );
    });
  },

  async mergeOrders(
    sourceOrderId: string,
    targetOrderId: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<void> {
    if (sourceOrderId === targetOrderId) {
      throw Object.assign(new Error("Mesa de origem e destino são a mesma"), {
        code: "INVALID_TARGET",
      });
    }

    await db.transaction(async (tx) => {
      await lockOrderPairForUpdate(tx, sourceOrderId, targetOrderId, unitId);

      // Lido dentro da transação de propósito: fora dela, um pagamento gravado
      // entre a checagem e a mesclagem escaparia deste guard.
      const paymentsCents = await sumPaymentsCents(tx, [sourceOrderId, targetOrderId]);
      if (paymentsCents > 0) {
        throw Object.assign(
          new Error("Não é possível juntar mesas que já têm pagamentos registrados"),
          { code: "PAYMENTS_ALREADY_REGISTERED" },
        );
      }

      await tx
        .update(restaurantOrderItems)
        .set({ orderId: targetOrderId, updatedAt: new Date() })
        .where(
          and(
            eq(restaurantOrderItems.orderId, sourceOrderId),
            eq(restaurantOrderItems.status, "ativo"),
          ),
        );

      const [merged] = await tx
        .update(restaurantOrders)
        .set({
          status: "mesclada",
          mergedIntoOrderId: targetOrderId,
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(restaurantOrders.id, sourceOrderId),
            eq(restaurantOrders.status, "aberta"),
          ),
        )
        .returning({ id: restaurantOrders.id });

      if (!merged) {
        throw Object.assign(new Error("Esta comanda já foi fechada"), {
          code: "ORDER_CLOSED",
        });
      }

      await restaurantOrderAuditService.logOrderAudit(sourceOrderId, "mesas_mescladas", actorId, {
        metadata: { direction: "origem", targetOrderId },
        tx,
      });
      await restaurantOrderAuditService.logOrderAudit(targetOrderId, "mesas_mescladas", actorId, {
        metadata: { direction: "destino", sourceOrderId },
        tx,
      });
    });
  },

  async forceCancelOrder(
    orderId: string,
    actorId: string,
    unitId?: string | null,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const order = await lockOrderForUpdate(tx, orderId, "aberta");
      assertOrderBelongsToUnit(order, unitId);

      // Mesma regra do `mergeOrders`: comanda cancelada nunca recebe
      // `cashSessionId`, então os pagamentos dela somem da conferência — mas o
      // dinheiro continua na gaveta e vira sobra de caixa sem explicação.
      // Remova os pagamentos antes de cancelar.
      //
      // A leitura corre dentro da transação com a comanda travada: antes havia
      // uma janela entre o check e o update em que um pagamento podia entrar e
      // sumir exatamente como o comentário acima diz que não pode acontecer.
      const paymentsCents = await sumPaymentsCents(tx, [orderId]);
      if (paymentsCents > 0) {
        throw Object.assign(
          new Error(
            `Esta comanda já tem ${fromCents(paymentsCents)} em pagamentos registrados. Remova os pagamentos antes de cancelar, senão o valor some da conferência de caixa.`,
          ),
          { code: "PAYMENTS_ALREADY_REGISTERED" },
        );
      }

      const [cancelled] = await tx
        .update(restaurantOrders)
        .set({ status: "cancelada", closedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(restaurantOrders.id, orderId),
            eq(restaurantOrders.status, "aberta"),
          ),
        )
        .returning({ id: restaurantOrders.id });

      if (!cancelled) {
        throw Object.assign(new Error("Esta comanda já foi fechada"), {
          code: "ORDER_CLOSED",
        });
      }

      await restaurantOrderAuditService.logOrderAudit(orderId, "mesa_excluida", actorId, {
        metadata: { tableNumber: order.tableNumber, cancelledBy: actorId },
        tx,
      });
    });
  },
};
