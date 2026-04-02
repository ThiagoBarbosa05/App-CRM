import { db } from "../db";
import { connectOrders, users, clients } from "../../shared/schema";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  sql,
  ilike,
  isNotNull,
  count,
  sum,
  avg,
  or,
} from "drizzle-orm";
import crypto from "crypto";

export interface ConnectCsvRow {
  saleDate: string; // "31/03/2026"
  totalValue: string; // "85,00"
  contactName: string;
  contactCpf: string;
  contactBirthDate: string;
  contactCep: string;
  contactStreet: string;
  contactNumber: string;
  contactNeighborhood: string;
  contactComplement: string;
  contactCity: string;
  sellerNameRaw: string;
  contactPhone: string;
  contactCellphone: string;
}

export interface SellerMapping {
  rawName: string;
  userId: string | null;
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

/** Converte "85,00" ou "1.809,31" → number */
function parseBrazilianCurrency(str: string): number {
  return parseFloat(str.replace(/\./g, "").replace(",", "."));
}

/** Gera hash único para deduplicação */
function buildImportHash(
  saleDate: string,
  contactName: string,
  totalValue: string,
  sourceFile: string,
): string {
  const raw = `${saleDate}|${contactName}|${totalValue}|${sourceFile}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
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
 * Phone é obrigatório na tabela; usa celular primeiro, depois telefone.
 * Em caso de race condition (unique violation em phone), refaz o lookup.
 */
async function createClientFromConnect(
  row: ConnectCsvRow,
  sellerId: string | null,
): Promise<ClientRecord | null> {
  const cellNorm = row.contactCellphone ? normalizePhone(row.contactCellphone) : null;
  const phoneNorm = row.contactPhone ? normalizePhone(row.contactPhone) : null;
  const primaryPhone = cellNorm || phoneNorm;

  // phone é NOT NULL no schema
  if (!primaryPhone) return null;

  const cpfNorm = row.contactCpf ? normalizeCpf(row.contactCpf) : null;
  const validCpf = cpfNorm && cpfNorm.length === 11 ? cpfNorm : null;

  try {
    const [created] = await db
      .insert(clients)
      .values({
        name: row.contactName || "Cliente Connect",
        phone: primaryPhone,
        // Se usou celular como phone principal, fixa o telefone como fixedPhone
        ...(cellNorm && phoneNorm && cellNorm !== phoneNorm
          ? { fixedPhone: phoneNorm }
          : {}),
        ...(validCpf ? { cpf: validCpf } : {}),
        ...(row.contactBirthDate ? { birthday: row.contactBirthDate } : {}),
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
    skipped: number;
    errors: { row: number; message: string }[];
    clientsFound: number;
    clientsCreated: number;
    clientsWithoutContact: number;
  }> {
    const { rows, sellerMappings, importedBy, sourceFile } = params;

    const sellerMap = new Map<string, string | null>();
    for (const m of sellerMappings) {
      sellerMap.set(m.rawName, m.userId);
    }

    let inserted = 0;
    let skipped = 0;
    let clientsFound = 0;
    let clientsCreated = 0;
    let clientsWithoutContact = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const importHash = buildImportHash(
          row.saleDate,
          row.contactName ?? "",
          row.totalValue,
          sourceFile,
        );

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

        const sellerId = sellerMap.get(row.sellerNameRaw) ?? null;

        // ── Verificar duplicata antes de processar cliente ──────────────────
        const existing = await db
          .select({ id: connectOrders.id })
          .from(connectOrders)
          .where(eq(connectOrders.importHash, importHash))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

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

        // ── Inserir pedido ───────────────────────────────────────────────────
        await db.insert(connectOrders).values({
          importHash,
          saleDate,
          totalValue: totalValue.toFixed(2),
          contactName: row.contactName || null,
          contactCpf: row.contactCpf || null,
          contactBirthDate: row.contactBirthDate || null,
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
          appClientId,
          appClientStatus,
          sourceFile,
          importedBy,
        });

        inserted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: i + 1, message });
      }
    }

    return { inserted, skipped, errors, clientsFound, clientsCreated, clientsWithoutContact };
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

    return { data: rows, total: Number(total) };
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
