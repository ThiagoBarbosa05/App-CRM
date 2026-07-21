import { db } from "../db";
import {
  restaurantMenuItems,
  restaurantOrders,
  restaurantOrderItems,
  restaurantTables,
  restaurantOrderPayments,
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
import { restaurantOrderPaymentsService } from "./restaurant-order-payments.service";
import { restaurantCashSessionService } from "./restaurant-cash-session.service";
import {
  calculateOrderTotals,
  toCents,
  fromCents,
} from "../../shared/restaurant-order-totals";

export interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

export const RESTAURANT_PDV_BLING_CONNECTION_SETTING_KEY =
  "restaurant_pdv_bling_connection_id";

export const restaurantPdvService = {
  async getRestaurantPdvBlingConnectionId(): Promise<string | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(
        eq(systemSettings.key, RESTAURANT_PDV_BLING_CONNECTION_SETTING_KEY),
      );
    return setting?.value ?? undefined;
  },
  async listMenuItems(activeOnly = true): Promise<RestaurantMenuItem[]> {
    return db
      .select()
      .from(restaurantMenuItems)
      .where(activeOnly ? eq(restaurantMenuItems.isActive, true) : undefined)
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
  }): Promise<RestaurantOrder> {
    // Nada acontece sem caixa aberto: a comanda que nasce fora de uma sessão
    // fecharia sem entrar em nenhuma conferência.
    await restaurantCashSessionService.assertSessionOpen();

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

      // Impede duplicata — usa SQL direto para garantir a comparação correta
      const dupResult = await db.execute(
        sql`SELECT id FROM restaurant_orders WHERE table_number = ${resolvedTableNumber} AND status = 'aberta' LIMIT 1`
      );
      if (dupResult.rows.length > 0) {
        throw Object.assign(
          new Error(`A Mesa ${resolvedTableNumber} já está aberta`),
          { code: "TABLE_OCCUPIED" },
        );
      }
    }

    const blingConnectionId = await this.getRestaurantPdvBlingConnectionId();

    const [created] = await db
      .insert(restaurantOrders)
      .values({
        tableId: data.tableId ?? null,
        tableNumber: resolvedTableNumber,
        peopleCount: data.peopleCount,
        waiterId: data.waiterId,
        blingConnectionId: blingConnectionId ?? null,
      })
      .returning();
    return created;
  },

  async getOrderWithItems(
    orderId: string,
  ): Promise<RestaurantOrderWithItems | null> {
    const [order] = await db
      .select()
      .from(restaurantOrders)
      .where(eq(restaurantOrders.id, orderId))
      .limit(1);

    if (!order) return null;

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
    status?: "aberta" | "fechada";
    waiterId?: string;
    from?: Date;
    to?: Date;
  }): Promise<(RestaurantOrder & { paymentsCount: number; waiterName: string | null })[]> {
    const conditions = [
      filters.status ? eq(restaurantOrders.status, filters.status) : undefined,
      filters.waiterId ? eq(restaurantOrders.waiterId, filters.waiterId) : undefined,
      filters.from ? gte(restaurantOrders.openedAt, filters.from) : undefined,
      filters.to ? lte(restaurantOrders.openedAt, filters.to) : undefined,
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
  ): Promise<RestaurantOrderItem> {
    const order = await this.assertOrderEditable(orderId);

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

      const [mapping] = await db
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

      const [product] = await db
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
    }

    const [created] = await db
      .insert(restaurantOrderItems)
      .values({
        orderId,
        menuItemId: data.menuItemId ?? null,
        productId: data.productId ?? null,
        name,
        notes: data.notes ?? null,
        unitPrice,
        quantity: data.quantity,
      })
      .returning();
    return created;
  },

  async updateItem(
    orderId: string,
    itemId: string,
    data: { unitPrice?: string; quantity?: number },
    actorId: string,
  ): Promise<RestaurantOrderItem | null> {
    await this.assertOrderEditable(orderId);

    // Estado anterior é lido antes do update para registrar o "de → para" na
    // auditoria: alterar preço de item é a via mais fácil de dar desconto sem
    // passar pelo fluxo de desconto, que exige gestor e já é auditado.
    const [before] = await db
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

    const [updated] = await db
      .update(restaurantOrderItems)
      .set({ ...data, updatedAt: new Date() })
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
      });
    }

    return updated;
  },

  async cancelItem(
    orderId: string,
    itemId: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    await this.assertOrderEditable(orderId);

    const [cancelled] = await db
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
    });
  },

  async applyDiscount(
    orderId: string,
    data: { discountPercent?: string; discountAmount?: string; reason: string },
    actorId: string,
  ): Promise<RestaurantOrder> {
    await this.assertOrderEditable(orderId);

    const [updated] = await db
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
    });

    return updated;
  },

  async removeDiscount(orderId: string, actorId: string): Promise<RestaurantOrder> {
    await this.assertOrderEditable(orderId);

    const [updated] = await db
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

    await restaurantOrderAuditService.logOrderAudit(orderId, "desconto_removido", actorId, {});

    return updated;
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
  ): Promise<RestaurantOrder> {
    const order = await this.assertOrderOpen(orderId);

    const items = await db
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

    const existingPayments = await restaurantOrderPaymentsService.listPayments(orderId);

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
      const paymentsTotalCents = allPayments.reduce((sum, p) => sum + toCents(p.amount), 0);
      if (Math.abs(paymentsTotalCents - totalCents) > 1) {
        throw Object.assign(
          new Error(
            `A soma dos pagamentos (${fromCents(paymentsTotalCents)}) não bate com o total da comanda (${fromCents(totalCents)})`,
          ),
          { code: "PAYMENTS_MISMATCH" },
        );
      }
      const distinctMethods = new Set(allPayments.map((p) => p.method));
      finalPaymentMethod = distinctMethods.size === 1 ? allPayments[0].method : null;
    }

    // Carimba a sessão de caixa que está recebendo o dinheiro.
    const cashSession = await restaurantCashSessionService.assertSessionOpen();

    const closed = await db.transaction(async (tx) => {
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
          amount: payment.amount,
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
        .where(eq(restaurantOrders.id, orderId))
        .returning();

      await restaurantOrderAuditService.logOrderAudit(orderId, "comanda_fechada", actorId, {
        metadata: { paymentMethod: finalPaymentMethod, total: fromCents(totalCents) },
        tx,
      });

      return updated;
    });

    return closed;
  },

  async assertOrderOpen(orderId: string): Promise<RestaurantOrder> {
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
    if (order.status !== "aberta") {
      throw Object.assign(new Error("Esta comanda já foi fechada"), {
        code: "ORDER_CLOSED",
      });
    }
    return order;
  },

  async assertOrderEditable(orderId: string): Promise<RestaurantOrder> {
    const order = await this.assertOrderOpen(orderId);
    if (order.paymentRequestedAt) {
      throw Object.assign(
        new Error("A conta já foi solicitada — cancele o pedido de conta para editar a comanda"),
        { code: "PAYMENT_REQUESTED" },
      );
    }
    return order;
  },

  async requestPayment(orderId: string, actorId: string): Promise<RestaurantOrder> {
    const order = await this.assertOrderOpen(orderId);
    if (order.paymentRequestedAt) return order;

    const [updated] = await db
      .update(restaurantOrders)
      .set({ paymentRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(restaurantOrders.id, orderId))
      .returning();

    await restaurantOrderAuditService.logOrderAudit(orderId, "pagamento_solicitado", actorId, {});
    return updated;
  },

  async cancelPaymentRequest(orderId: string, actorId: string): Promise<RestaurantOrder> {
    const order = await this.assertOrderOpen(orderId);
    if (!order.paymentRequestedAt) return order;

    const [updated] = await db
      .update(restaurantOrders)
      .set({ paymentRequestedAt: null, updatedAt: new Date() })
      .where(eq(restaurantOrders.id, orderId))
      .returning();

    await restaurantOrderAuditService.logOrderAudit(orderId, "pagamento_cancelado", actorId, {});
    return updated;
  },

  async transferItems(
    sourceOrderId: string,
    itemIds: string[],
    targetOrderId: string,
    actorId: string,
  ): Promise<void> {
    if (sourceOrderId === targetOrderId) {
      throw Object.assign(new Error("Mesa de origem e destino são a mesma"), {
        code: "INVALID_TARGET",
      });
    }

    await this.assertOrderEditable(sourceOrderId);
    await this.assertOrderEditable(targetOrderId);

    const moved = await db
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
      { metadata: { ...metadata, direction: "saida", targetOrderId } },
    );
    await restaurantOrderAuditService.logOrderAudit(
      targetOrderId,
      "itens_transferidos",
      actorId,
      { metadata: { ...metadata, direction: "entrada", sourceOrderId } },
    );
  },

  async mergeOrders(
    sourceOrderId: string,
    targetOrderId: string,
    actorId: string,
  ): Promise<void> {
    if (sourceOrderId === targetOrderId) {
      throw Object.assign(new Error("Mesa de origem e destino são a mesma"), {
        code: "INVALID_TARGET",
      });
    }

    await this.assertOrderEditable(sourceOrderId);
    await this.assertOrderEditable(targetOrderId);

    const sourcePaymentsCents = await restaurantOrderPaymentsService.getPaymentsTotalCents(
      sourceOrderId,
    );
    const targetPaymentsCents = await restaurantOrderPaymentsService.getPaymentsTotalCents(
      targetOrderId,
    );
    if (sourcePaymentsCents > 0 || targetPaymentsCents > 0) {
      throw Object.assign(
        new Error("Não é possível juntar mesas que já têm pagamentos registrados"),
        { code: "PAYMENTS_ALREADY_REGISTERED" },
      );
    }

    await db
      .update(restaurantOrderItems)
      .set({ orderId: targetOrderId, updatedAt: new Date() })
      .where(
        and(
          eq(restaurantOrderItems.orderId, sourceOrderId),
          eq(restaurantOrderItems.status, "ativo"),
        ),
      );

    await db
      .update(restaurantOrders)
      .set({
        status: "mesclada",
        mergedIntoOrderId: targetOrderId,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(restaurantOrders.id, sourceOrderId));

    await restaurantOrderAuditService.logOrderAudit(sourceOrderId, "mesas_mescladas", actorId, {
      metadata: { direction: "origem", targetOrderId },
    });
    await restaurantOrderAuditService.logOrderAudit(targetOrderId, "mesas_mescladas", actorId, {
      metadata: { direction: "destino", sourceOrderId },
    });
  },

  async forceCancelOrder(orderId: string, actorId: string): Promise<void> {
    const order = await this.assertOrderOpen(orderId);

    await db
      .update(restaurantOrders)
      .set({ status: "cancelada", closedAt: new Date() })
      .where(eq(restaurantOrders.id, orderId));

    await restaurantOrderAuditService.logOrderAudit(orderId, "mesa_excluida", actorId, {
      metadata: { tableNumber: order.tableNumber, cancelledBy: actorId },
    });
  },
};
