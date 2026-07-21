import { db } from "../db";
import {
  restaurantCashSessions,
  restaurantCashMovements,
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderPayments,
  users,
} from "../../shared/schema";
import { eq, and, desc, gte, lte, inArray, isNotNull, sql } from "drizzle-orm";
import type {
  RestaurantCashSession,
  RestaurantCashMovement,
} from "../../shared/schema";
import {
  buildCashSessionSummary,
  calculateCashDifference,
  calculateExpectedCash,
  type CashSessionSummary,
} from "../../shared/restaurant-cash-session";
import { fromCents, toCents } from "../../shared/restaurant-order-totals";
import { restaurantOrderAuditService } from "./restaurant-order-audit.service";
import {
  restaurantReportsService,
  type CancelledItemRow,
} from "./restaurant-reports.service";

export interface SessionOrderRow {
  id: string;
  orderNumber: number;
  tableNumber: number;
  waiterName: string | null;
  /** Nulo quando a comanda foi dividida entre formas diferentes. */
  paymentMethod: string | null;
  total: string | null;
  closedAt: Date | null;
}

export interface CashSessionDetail extends RestaurantCashSession {
  movements: RestaurantCashMovement[];
  /** Snapshot gravado (sessão fechada) ou cálculo ao vivo (sessão aberta). */
  summary: CashSessionSummary;
  /** Comandas fechadas da sessão, mais recentes primeiro. */
  closedOrders: SessionOrderRow[];
  /** Itens cancelados durante o turno — recortado por hora, não por comanda. */
  cancelledItems: CancelledItemRow[];
  openedByName: string | null;
  closedByName: string | null;
}

async function fetchWaiterNames(waiterIds: string[]): Promise<Record<string, string>> {
  if (waiterIds.length === 0) return {};
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, waiterIds));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/**
 * Comandas canceladas não recebem `cash_session_id` (nunca chegam a fechar),
 * então são localizadas pela janela de tempo da sessão via `closedAt`, que o
 * `forceCancelOrder` grava.
 */
async function fetchCancelledInWindow(from: Date, to: Date) {
  return db
    .select({
      id: restaurantOrders.id,
      /**
       * Somado dos itens, não lido de `restaurant_orders.subtotal`: aquela
       * coluna só é gravada no fechamento da comanda, e comanda cancelada
       * nunca passa por lá — ficava NULL, e o total cancelado da conferência
       * era sempre R$ 0,00. Calcular aqui também corrige o histórico, sem
       * depender de backfill.
       *
       * É o valor dos itens (sem taxa de serviço): a taxa nunca foi cobrada
       * numa comanda que não fechou.
       */
      subtotal: sql<string>`COALESCE(SUM(
        ${restaurantOrderItems.unitPrice} * ${restaurantOrderItems.quantity}
      ) FILTER (WHERE ${restaurantOrderItems.status} = 'ativo'), 0)`,
    })
    .from(restaurantOrders)
    .leftJoin(
      restaurantOrderItems,
      eq(restaurantOrderItems.orderId, restaurantOrders.id),
    )
    .where(
      and(
        eq(restaurantOrders.status, "cancelada"),
        isNotNull(restaurantOrders.closedAt),
        gte(restaurantOrders.closedAt, from),
        lte(restaurantOrders.closedAt, to),
      ),
    )
    .groupBy(restaurantOrders.id);
}

export const restaurantCashSessionService = {
  /** Sessão aberta de um usuário específico, opcionalmente filtrada por unidade. */
  async getCurrentSession(userId: string, unitId?: string): Promise<RestaurantCashSession | null> {
    const conditions = [
      eq(restaurantCashSessions.status, "aberto"),
      eq(restaurantCashSessions.openedBy, userId),
      unitId ? eq(restaurantCashSessions.unitId, unitId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const [session] = await db
      .select()
      .from(restaurantCashSessions)
      .where(and(...conditions))
      .limit(1);
    return session ?? null;
  },

  async openSession(
    openingFloat: string,
    actorId: string,
    unitId?: string,
  ): Promise<RestaurantCashSession> {
    if (toCents(openingFloat) < 0) {
      throw Object.assign(new Error("O fundo de troco não pode ser negativo"), {
        code: "INVALID_AMOUNT",
      });
    }

    const current = await this.getCurrentSession(actorId, unitId);
    if (current) {
      throw Object.assign(
        new Error("Você já tem um caixa aberto — feche-o antes de abrir outro"),
        { code: "SESSION_ALREADY_OPEN" },
      );
    }

    try {
      const [created] = await db
        .insert(restaurantCashSessions)
        .values({ openedBy: actorId, openingFloat, status: "aberto", unitId: unitId ?? null })
        .returning();
      return created;
    } catch (error: any) {
      if (error?.code === "23505") {
        throw Object.assign(
          new Error("Você já tem um caixa aberto — feche-o antes de abrir outro"),
          { code: "SESSION_ALREADY_OPEN" },
        );
      }
      throw error;
    }
  },

  async assertSessionOpen(userId: string, unitId?: string): Promise<RestaurantCashSession> {
    const session = await this.getCurrentSession(userId, unitId);
    if (!session) {
      throw Object.assign(
        new Error("Nenhum caixa aberto para este usuário — abra o caixa para operar"),
        { code: "NO_CASH_SESSION" },
      );
    }
    return session;
  },

  async addMovement(
    data: { type: "sangria" | "suprimento"; amount: string; reason: string },
    actorId: string,
    unitId?: string,
  ): Promise<RestaurantCashMovement> {
    const session = await this.assertSessionOpen(actorId, unitId);

    if (toCents(data.amount) <= 0) {
      throw Object.assign(new Error("O valor deve ser maior que zero"), {
        code: "INVALID_AMOUNT",
      });
    }

    if (data.type === "sangria") {
      const { expectedCents } = await this.calculateSessionCash(session);
      if (toCents(data.amount) > expectedCents) {
        throw Object.assign(
          new Error(
            `A sangria (${fromCents(toCents(data.amount))}) é maior que o dinheiro em caixa (${fromCents(expectedCents)})`,
          ),
          { code: "INSUFFICIENT_CASH" },
        );
      }
    }

    const [created] = await db
      .insert(restaurantCashMovements)
      .values({
        sessionId: session.id,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        actorId,
      })
      .returning();

    return created;
  },

  async listMovements(sessionId: string): Promise<RestaurantCashMovement[]> {
    return db
      .select()
      .from(restaurantCashMovements)
      .where(eq(restaurantCashMovements.sessionId, sessionId))
      .orderBy(restaurantCashMovements.createdAt);
  },

  /** Dinheiro esperado em gaveta agora — usado na sangria e no fechamento. */
  async calculateSessionCash(session: RestaurantCashSession) {
    const orders = await db
      .select({ id: restaurantOrders.id })
      .from(restaurantOrders)
      .where(eq(restaurantOrders.cashSessionId, session.id));

    const orderIds = orders.map((o) => o.id);
    const payments =
      orderIds.length > 0
        ? await db
            .select()
            .from(restaurantOrderPayments)
            .where(inArray(restaurantOrderPayments.orderId, orderIds))
        : [];

    const movements = await this.listMovements(session.id);

    return calculateExpectedCash({
      openingFloat: session.openingFloat,
      payments,
      movements,
    });
  },

  /**
   * Comandas fechadas da sessão. Vale para sessão aberta e fechada — o vínculo
   * é o `cashSessionId` carimbado no fechamento da comanda, não a janela de
   * tempo.
   */
  async listSessionOrders(sessionId: string, limit = 20): Promise<SessionOrderRow[]> {
    const rows = await db
      .select({
        id: restaurantOrders.id,
        orderNumber: restaurantOrders.orderNumber,
        tableNumber: restaurantOrders.tableNumber,
        waiterName: users.name,
        paymentMethod: restaurantOrders.paymentMethod,
        total: restaurantOrders.total,
        closedAt: restaurantOrders.closedAt,
      })
      .from(restaurantOrders)
      .leftJoin(users, eq(restaurantOrders.waiterId, users.id))
      .where(
        and(
          eq(restaurantOrders.cashSessionId, sessionId),
          eq(restaurantOrders.status, "fechada"),
        ),
      )
      .orderBy(desc(restaurantOrders.closedAt))
      .limit(limit);

    return rows;
  },

  async getSessionDetail(sessionId: string): Promise<CashSessionDetail | null> {
    const [session] = await db
      .select()
      .from(restaurantCashSessions)
      .where(eq(restaurantCashSessions.id, sessionId))
      .limit(1);

    if (!session) return null;

    const movements = await this.listMovements(session.id);
    const actorNames = await fetchWaiterNames(
      [session.openedBy, session.closedBy].filter((id): id is string => !!id),
    );

    // Sessão fechada devolve o snapshot gravado: reabrir o relatório amanhã
    // mostra o que foi conferido, não o que o banco diz hoje.
    const summary =
      session.status === "fechado" && session.summary
        ? (session.summary as CashSessionSummary)
        : await this.buildLiveSummary(session, movements);

    return {
      ...session,
      movements,
      summary,
      closedOrders: await this.listSessionOrders(session.id),
      cancelledItems: await restaurantReportsService.listCancelledItems({
        from: session.openedAt,
        to: session.closedAt ?? new Date(),
      }),
      openedByName: actorNames[session.openedBy] ?? null,
      closedByName: session.closedBy ? (actorNames[session.closedBy] ?? null) : null,
    };
  },

  async buildLiveSummary(
    session: RestaurantCashSession,
    movements?: RestaurantCashMovement[],
  ): Promise<CashSessionSummary> {
    const closedOrders = await db
      .select()
      .from(restaurantOrders)
      .where(
        and(
          eq(restaurantOrders.cashSessionId, session.id),
          eq(restaurantOrders.status, "fechada"),
        ),
      );

    const orderIds = closedOrders.map((o) => o.id);
    const payments =
      orderIds.length > 0
        ? await db
            .select()
            .from(restaurantOrderPayments)
            .where(inArray(restaurantOrderPayments.orderId, orderIds))
        : [];

    const cancelledOrders = await fetchCancelledInWindow(
      session.openedAt,
      session.closedAt ?? new Date(),
    );

    return buildCashSessionSummary({
      openingFloat: session.openingFloat,
      closedOrders,
      cancelledOrders,
      payments,
      movements: movements ?? (await this.listMovements(session.id)),
      waiterNameById: await fetchWaiterNames(closedOrders.map((o) => o.waiterId)),
    });
  },

  async closeSession(
    sessionId: string,
    data: { countedCash: string; countedByMethod?: Record<string, string>; notes?: string },
    actorId: string,
  ): Promise<RestaurantCashSession> {
    const [session] = await db
      .select()
      .from(restaurantCashSessions)
      .where(eq(restaurantCashSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw Object.assign(new Error("Caixa não encontrado"), { code: "NOT_FOUND" });
    }
    if (session.status === "fechado") {
      throw Object.assign(new Error("Este caixa já foi fechado"), {
        code: "SESSION_CLOSED",
      });
    }
    if (toCents(data.countedCash) < 0) {
      throw Object.assign(new Error("O valor contado não pode ser negativo"), {
        code: "INVALID_AMOUNT",
      });
    }

    // Fechar o caixa com mesa aberta é o aviso que hoje não existe: a comanda
    // ficaria sem sessão e a receita cairia fora de qualquer conferência.
    // Verifica apenas comandas do próprio operador — outros caixas abertos
    // simultaneamente têm seus próprios garçons e não impedem este fechamento.
    const openOrders = await db
      .select({ id: restaurantOrders.id, tableNumber: restaurantOrders.tableNumber })
      .from(restaurantOrders)
      .where(
        and(
          eq(restaurantOrders.status, "aberta"),
          eq(restaurantOrders.waiterId, session.openedBy),
        ),
      );

    if (openOrders.length > 0) {
      const tables = openOrders.map((o) => o.tableNumber).join(", ");
      throw Object.assign(
        new Error(
          `Existem ${openOrders.length} comanda(s) abertas suas (mesa ${tables}). Feche todas antes de fechar o caixa.`,
        ),
        { code: "OPEN_ORDERS" },
      );
    }

    const closedAt = new Date();
    const liveSummary = await this.buildLiveSummary({ ...session, closedAt });
    const expectedCents = toCents(liveSummary.cash.expected);
    const differenceCents = calculateCashDifference(data.countedCash, expectedCents);

    // Calcula diferença por forma de pagamento e grava junto ao snapshot
    const countedByMethod = data.countedByMethod ?? {};
    const methodDifferences: Record<string, { system: string; counted: string; diff: string }> = {};
    for (const row of liveSummary.byPaymentMethod) {
      const counted = countedByMethod[row.method];
      if (counted !== undefined) {
        const sysCents = toCents(Number(row.total));
        const cntCents = toCents(Number(counted));
        methodDifferences[row.method] = {
          system: row.total,
          counted,
          diff: fromCents(cntCents - sysCents),
        };
      }
    }
    const summary = { ...liveSummary, countedByMethod, methodDifferences };

    const closed = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(restaurantCashSessions)
        .set({
          status: "fechado",
          closedBy: actorId,
          closedAt,
          expectedCash: fromCents(expectedCents),
          countedCash: data.countedCash,
          difference: fromCents(differenceCents),
          summary,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(restaurantCashSessions.id, sessionId))
        .returning();

      return updated;
    });

    return closed;
  },

  async listSessions(limit = 30, unitId?: string): Promise<RestaurantCashSession[]> {
    return db
      .select()
      .from(restaurantCashSessions)
      .where(unitId ? eq(restaurantCashSessions.unitId, unitId) : undefined)
      .orderBy(desc(restaurantCashSessions.openedAt))
      .limit(limit);
  },

  /** Visão gerencial: todas as sessões com nome do operador. */
  async listSessionsOverview(unitId?: string, limit = 100): Promise<SessionOverviewRow[]> {
    const rows = await db
      .select({
        id: restaurantCashSessions.id,
        sessionNumber: restaurantCashSessions.sessionNumber,
        status: restaurantCashSessions.status,
        openedBy: restaurantCashSessions.openedBy,
        openedByName: users.name,
        openedAt: restaurantCashSessions.openedAt,
        closedAt: restaurantCashSessions.closedAt,
        expectedCash: restaurantCashSessions.expectedCash,
        countedCash: restaurantCashSessions.countedCash,
        difference: restaurantCashSessions.difference,
        openingFloat: restaurantCashSessions.openingFloat,
      })
      .from(restaurantCashSessions)
      .leftJoin(users, eq(restaurantCashSessions.openedBy, users.id))
      .where(unitId ? eq(restaurantCashSessions.unitId, unitId) : undefined)
      .orderBy(desc(restaurantCashSessions.openedAt))
      .limit(limit);
    return rows;
  },
};

export interface SessionOverviewRow {
  id: string;
  sessionNumber: number;
  status: string;
  openedBy: string;
  openedByName: string | null;
  openedAt: Date;
  closedAt: Date | null;
  expectedCash: string | null;
  countedCash: string | null;
  difference: string | null;
  openingFloat: string;
}
