import { db } from "../db";
import { connectOrders, connectOrderItems, users, clients } from "../../shared/schema";
import { resetReengagementProgress } from "./reengagement-automation.service";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  sql,
  ilike,
  isNotNull,
  inArray,
  count,
  sum,
  avg,
  or,
} from "drizzle-orm";
import crypto from "crypto";

export interface ConnectOrderItem {
  productCode: string;
  productName: string;
  quantity: string; // "1,00"
  unitValue: string; // "139,90"
}

export interface ConnectCsvRow {
  saleCode: string;
  saleDate: string; // "31/03/2026"
  totalValue: string; // "605,90" — valor agregado de todos os itens
  contactName: string;
  contactCpf: string;
  contactCep: string;
  contactStreet: string;
  contactNumber: string;
  contactNeighborhood: string;
  contactComplement: string;
  contactCity: string;
  sellerNameRaw: string;
  contactPhone: string;
  contactCellphone: string;
  items: ConnectOrderItem[];
}

export interface SellerMapping {
  rawName: string;
  userId: string | null;
  score?: number;
}

export interface ImportConnectOrdersParams {
  rows: ConnectCsvRow[];
  sellerMappings: SellerMapping[];
  importedBy: string;
  sourceFile: string;
}

export interface ConnectOrderFilters {
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  contactName?: string;
  limit?: number;
  offset?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converte "31/03/2026" → Date */
function parseBrazilianDate(str: string): Date {
  const [day, month, year] = str.trim().split("/");
  return new Date(`${year}-${month}-${day}T12:00:00`);
}

/** Converte "85,00" ou "1.809,31" ou "R$ 219,90" → number */
function parseBrazilianCurrency(str: string): number {
  return parseFloat(str.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", "."));
}

/** Gera hash de deduplicação baseado apenas no código da venda */
function buildImportHash(saleCode: string): string {
  return crypto.createHash("sha256").update(saleCode).digest("hex");
}

/** Normaliza telefone — apenas dígitos */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Normaliza CPF — apenas dígitos */
function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

// ─── Client matching / creation ──────────────────────────────────────────────

type ClientRecord = typeof clients.$inferSelect;

/**
 * Busca cliente no app por CPF, celular ou telefone.
 * Retorna o cliente encontrado ou null.
 */
async function findClientByCpfOrPhone(
  cpf: string | null,
  cellphone: string | null,
  phone: string | null,
): Promise<ClientRecord | null> {
  const conditions = [];

  const normalizedCpf = cpf ? normalizeCpf(cpf) : null;
  const normalizedCell = cellphone ? normalizePhone(cellphone) : null;
  const normalizedPhone = phone ? normalizePhone(phone) : null;

  if (normalizedCpf && normalizedCpf.length === 11) {
    conditions.push(eq(clients.cpf, normalizedCpf));
  }
  if (normalizedCell) {
    conditions.push(
      sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g') = ${normalizedCell}`,
      sql`regexp_replace(COALESCE(${clients.fixedPhone}, ''), '[^0-9]', '', 'g') = ${normalizedCell}`,
    );
  }
  if (normalizedPhone && normalizedPhone !== normalizedCell) {
    conditions.push(
      sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`,
      sql`regexp_replace(COALESCE(${clients.fixedPhone}, ''), '[^0-9]', '', 'g') = ${normalizedPhone}`,
    );
  }

  if (conditions.length === 0) return null;

  try {
    const [found] = await db
      .select()
      .from(clients)
      .where(or(...conditions))
      .limit(1);
    return found ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria um novo cliente no app a partir dos dados do CSV Connect.
 * Phone é opcional — se não houver, o cliente é criado sem telefone.
 * Em caso de race condition (unique violation em phone), refaz o lookup.
 */
async function createClientFromConnect(
  row: ConnectCsvRow,
  sellerId: string | null,
): Promise<ClientRecord | null> {
  const clientName = row.contactName?.trim() || "Cliente Connect";
  const cellNorm = row.contactCellphone ? normalizePhone(row.contactCellphone) : null;
  const phoneNorm = row.contactPhone ? normalizePhone(row.contactPhone) : null;
  const primaryPhone = cellNorm || phoneNorm || null;

  const cpfNorm = row.contactCpf ? normalizeCpf(row.contactCpf) : null;
  const validCpf = cpfNorm && cpfNorm.length === 11 ? cpfNorm : null;

  try {
    const [created] = await db
      .insert(clients)
      .values({
        name: clientName,
        ...(primaryPhone ? { phone: primaryPhone } : {}),
        // Se usou celular como phone principal, fixa o telefone como fixedPhone
        ...(cellNorm && phoneNorm && cellNorm !== phoneNorm
          ? { fixedPhone: phoneNorm }
          : {}),
        ...(validCpf ? { cpf: validCpf } : {}),
        ...(row.contactCep ? { cep: row.contactCep } : {}),
        ...(row.contactStreet ? { address: row.contactStreet } : {}),
        ...(row.contactNumber ? { number: row.contactNumber } : {}),
        ...(row.contactNeighborhood ? { neighborhood: row.contactNeighborhood } : {}),
        ...(row.contactCity ? { city: row.contactCity } : {}),
        ...(sellerId ? { responsavelId: sellerId } : {}),
        categoria: "Connect",
        origem: "Connect",
        status: "pending",
        markers: [],
      })
      .returning();

    return created;
  } catch (error: unknown) {
    // Race condition: unique violation em phone
    const isUniqueViolation =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "23505";

    if (isUniqueViolation) {
      return findClientByCpfOrPhone(
        row.contactCpf,
        row.contactCellphone,
        row.contactPhone,
      );
    }
    console.error("[ConnectOrdersService] Erro ao criar cliente:", error);
    return null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const connectOrdersService = {
  /**
   * Importa pedidos do CSV Connect para o banco de dados.
   * Para cada pedido, tenta encontrar ou criar o cliente no app.
   * Ignora duplicatas via importHash.
   */
  async importOrders(params: ImportConnectOrdersParams): Promise<{
    inserted: number;
    updated: number;
    errors: { row: number; message: string }[];
    clientsFound: number;
    clientsCreated: number;
    clientsWithoutContact: number;
  }> {
    const { rows, sellerMappings, importedBy, sourceFile } = params;

    const sellerMap = new Map<string, { userId: string | null; score: number }>();
    for (const m of sellerMappings) {
      sellerMap.set(m.rawName, { userId: m.userId, score: m.score ?? 0 });
    }

    let inserted = 0;
    let updated = 0;
    let clientsFound = 0;
    let clientsCreated = 0;
    let clientsWithoutContact = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const importHash = buildImportHash(row.saleCode);

        const totalValue = parseBrazilianCurrency(row.totalValue);
        if (isNaN(totalValue)) {
          errors.push({ row: i + 1, message: `Valor inválido: ${row.totalValue}` });
          continue;
        }

        const saleDate = parseBrazilianDate(row.saleDate);
        if (isNaN(saleDate.getTime())) {
          errors.push({ row: i + 1, message: `Data inválida: ${row.saleDate}` });
          continue;
        }

        const sellerInfo = sellerMap.get(row.sellerNameRaw);
        const sellerId = sellerInfo?.userId ?? null;
        const sellerMatchScore = sellerInfo?.score ?? null;

        // ── Matching / criação de cliente ───────────────────────────────────
        let appClientId: string | null = null;
        let appClientStatus: "found" | "created" | "not_found" = "not_found";

        const hasContactInfo =
          row.contactCpf || row.contactCellphone || row.contactPhone;

        if (hasContactInfo) {
          const existingClient = await findClientByCpfOrPhone(
            row.contactCpf,
            row.contactCellphone,
            row.contactPhone,
          );

          if (existingClient) {
            appClientId = existingClient.id;
            appClientStatus = "found";
            clientsFound++;
          } else {
            const created = await createClientFromConnect(row, sellerId);
            if (created) {
              appClientId = created.id;
              appClientStatus = "created";
              clientsCreated++;
            } else {
              clientsWithoutContact++;
            }
          }
        } else {
          clientsWithoutContact++;
        }

        const orderValues = {
          importHash,
          saleCode: row.saleCode || null,
          saleDate,
          totalValue: totalValue.toFixed(2),
          contactName: row.contactName || null,
          contactCpf: row.contactCpf || null,
          contactCep: row.contactCep || null,
          contactStreet: row.contactStreet || null,
          contactNumber: row.contactNumber || null,
          contactNeighborhood: row.contactNeighborhood || null,
          contactComplement: row.contactComplement || null,
          contactCity: row.contactCity || null,
          contactPhone: row.contactPhone || null,
          contactCellphone: row.contactCellphone || null,
          sellerNameRaw: row.sellerNameRaw || null,
          sellerId,
          sellerMatchScore,
          appClientId,
          appClientStatus,
          sourceFile,
          importedBy,
        };

        await db.transaction(async (tx) => {
          // ── Upsert pedido (insert ou update se saleCode já existe) ─────────
          const [upsertedOrder] = await tx
            .insert(connectOrders)
            .values(orderValues)
            .onConflictDoUpdate({
              target: connectOrders.saleCode,
              set: {
                importHash: orderValues.importHash,
                saleDate: orderValues.saleDate,
                totalValue: orderValues.totalValue,
                contactName: orderValues.contactName,
                contactCpf: orderValues.contactCpf,
                contactCep: orderValues.contactCep,
                contactStreet: orderValues.contactStreet,
                contactNumber: orderValues.contactNumber,
                contactNeighborhood: orderValues.contactNeighborhood,
                contactComplement: orderValues.contactComplement,
                contactCity: orderValues.contactCity,
                contactPhone: orderValues.contactPhone,
                contactCellphone: orderValues.contactCellphone,
                sellerNameRaw: orderValues.sellerNameRaw,
                sellerId: orderValues.sellerId,
                sellerMatchScore: orderValues.sellerMatchScore,
                appClientId: orderValues.appClientId,
                appClientStatus: orderValues.appClientStatus,
                sourceFile: orderValues.sourceFile,
                importedBy: orderValues.importedBy,
              },
            })
            .returning({
              id: connectOrders.id,
              isNew: sql<boolean>`(xmax = 0)`,
            });

          if (upsertedOrder.isNew) {
            inserted++;
          } else {
            updated++;
          }

          // ── Substituir itens (delete + reinsert garante idempotência) ──────
          await tx
            .delete(connectOrderItems)
            .where(eq(connectOrderItems.orderId, upsertedOrder.id));

          if (row.items?.length) {
            await tx.insert(connectOrderItems).values(
              row.items.map((item) => ({
                orderId: upsertedOrder.id,
                productCode: item.productCode || null,
                productName: item.productName || null,
                quantity: parseBrazilianCurrency(item.quantity).toFixed(3),
                unitValue: parseBrazilianCurrency(item.unitValue).toFixed(2),
              })),
            );
          }
        });

        if (appClientId) {
          try {
            await resetReengagementProgress(appClientId);
          } catch (error) {
            console.error(
              "[ConnectOrdersService] Erro ao zerar progresso de reengajamento:",
              error,
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: i + 1, message });
      }
    }

    return { inserted, updated, errors, clientsFound, clientsCreated, clientsWithoutContact };
  },

  /** Lista pedidos com filtros e paginação */
  async listOrders(filters: ConnectOrderFilters) {
    const { startDate, endDate, sellerId, contactName, limit = 50, offset = 0 } =
      filters;

    const conditions = [];

    if (startDate) {
      conditions.push(gte(connectOrders.saleDate, new Date(`${startDate}T00:00:00`)));
    }
    if (endDate) {
      conditions.push(lte(connectOrders.saleDate, new Date(`${endDate}T23:59:59`)));
    }
    if (sellerId) {
      conditions.push(eq(connectOrders.sellerId, sellerId));
    }
    if (contactName) {
      conditions.push(ilike(connectOrders.contactName, `%${contactName}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: connectOrders.id,
          saleCode: connectOrders.saleCode,
          saleDate: connectOrders.saleDate,
          totalValue: connectOrders.totalValue,
          contactName: connectOrders.contactName,
          contactCpf: connectOrders.contactCpf,
          contactPhone: connectOrders.contactPhone,
          contactCellphone: connectOrders.contactCellphone,
          contactCity: connectOrders.contactCity,
          sellerNameRaw: connectOrders.sellerNameRaw,
          sellerId: connectOrders.sellerId,
          appClientId: connectOrders.appClientId,
          appClientStatus: connectOrders.appClientStatus,
          sourceFile: connectOrders.sourceFile,
          importedAt: connectOrders.importedAt,
        })
        .from(connectOrders)
        .where(where)
        .orderBy(desc(connectOrders.saleDate))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(connectOrders).where(where),
    ]);

    // Buscar itens de todos os pedidos retornados
    const itemsByOrderId = new Map<number, { id: number; productCode: string | null; productName: string | null; quantity: string; unitValue: string }[]>();
    if (rows.length > 0) {
      const orderIds = rows.map((r) => r.id);
      const items = await db
        .select({
          id: connectOrderItems.id,
          orderId: connectOrderItems.orderId,
          productCode: connectOrderItems.productCode,
          productName: connectOrderItems.productName,
          quantity: connectOrderItems.quantity,
          unitValue: connectOrderItems.unitValue,
        })
        .from(connectOrderItems)
        .where(inArray(connectOrderItems.orderId, orderIds));

      for (const item of items) {
        if (!itemsByOrderId.has(item.orderId)) {
          itemsByOrderId.set(item.orderId, []);
        }
        itemsByOrderId.get(item.orderId)!.push({
          id: item.id,
          productCode: item.productCode,
          productName: item.productName,
          quantity: String(item.quantity),
          unitValue: String(item.unitValue),
        });
      }
    }

    const data = rows.map((row) => ({
      ...row,
      items: itemsByOrderId.get(row.id) ?? [],
    }));

    return { data, total: Number(total) };
  },

  /** Estatísticas de vendas no período */
  async getSalesStatistics(startDate: string, endDate: string) {
    const conditions = [
      gte(connectOrders.saleDate, new Date(`${startDate}T00:00:00`)),
      lte(connectOrders.saleDate, new Date(`${endDate}T23:59:59`)),
    ];
    const where = and(...conditions);

    const [result] = await db
      .select({
        totalOrders: count(),
        totalValue: sum(connectOrders.totalValue),
        avgValue: avg(connectOrders.totalValue),
      })
      .from(connectOrders)
      .where(where);

    return {
      totalOrders: Number(result.totalOrders),
      totalValue: Number(result.totalValue ?? 0),
      averageValue: Number(result.avgValue ?? 0),
    };
  },

  /** Top vendedores no período */
  async getTopSellers(startDate: string, endDate: string, limit = 10) {
    const conditions = [
      gte(connectOrders.saleDate, new Date(`${startDate}T00:00:00`)),
      lte(connectOrders.saleDate, new Date(`${endDate}T23:59:59`)),
      isNotNull(connectOrders.sellerId),
    ];

    const rows = await db
      .select({
        sellerId: connectOrders.sellerId,
        sellerNameRaw: connectOrders.sellerNameRaw,
        sellerName: users.name,
        totalOrders: count(),
        totalValue: sum(connectOrders.totalValue),
      })
      .from(connectOrders)
      .leftJoin(users, eq(connectOrders.sellerId, users.id))
      .where(and(...conditions))
      .groupBy(connectOrders.sellerId, connectOrders.sellerNameRaw, users.name)
      .orderBy(desc(sum(connectOrders.totalValue)))
      .limit(limit);

    return rows.map((r) => ({
      sellerId: r.sellerId,
      sellerName: r.sellerName ?? r.sellerNameRaw ?? "Desconhecido",
      totalOrders: Number(r.totalOrders),
      totalValue: Number(r.totalValue ?? 0),
    }));
  },

  /** Evolução de vendas agrupada por dia/semana/mês */
  async getSalesEvolution(
    startDate: string,
    endDate: string,
    groupBy: "day" | "week" | "month" = "day",
  ) {
    const conditions = [
      gte(connectOrders.saleDate, new Date(`${startDate}T00:00:00`)),
      lte(connectOrders.saleDate, new Date(`${endDate}T23:59:59`)),
    ];

    const truncFn =
      groupBy === "month"
        ? sql`DATE_TRUNC('month', ${connectOrders.saleDate})`
        : groupBy === "week"
          ? sql`DATE_TRUNC('week', ${connectOrders.saleDate})`
          : sql`DATE_TRUNC('day', ${connectOrders.saleDate})`;

    const rows = await db
      .select({
        period: truncFn.as("period"),
        totalOrders: count(),
        totalValue: sum(connectOrders.totalValue),
      })
      .from(connectOrders)
      .where(and(...conditions))
      .groupBy(sql`DATE_TRUNC(${groupBy}, ${connectOrders.saleDate})`)
      .orderBy(sql`period`);

    return rows.map((r) => ({
      period: r.period,
      totalOrders: Number(r.totalOrders),
      totalValue: Number(r.totalValue ?? 0),
    }));
  },

  /** Histórico de pedidos de um vendedor específico */
  async getOrdersByUser(
    userId: string,
    filters: { startDate?: string; endDate?: string; limit?: number; offset?: number },
  ) {
    const { startDate, endDate, limit = 50, offset = 0 } = filters;
    const conditions = [eq(connectOrders.sellerId, userId)];

    if (startDate) {
      conditions.push(
        gte(connectOrders.saleDate, new Date(`${startDate}T00:00:00`)),
      );
    }
    if (endDate) {
      conditions.push(
        lte(connectOrders.saleDate, new Date(`${endDate}T23:59:59`)),
      );
    }

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(connectOrders)
        .where(and(...conditions))
        .orderBy(desc(connectOrders.saleDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(connectOrders)
        .where(and(...conditions)),
    ]);

    return { data: rows, total: Number(total) };
  },
};
