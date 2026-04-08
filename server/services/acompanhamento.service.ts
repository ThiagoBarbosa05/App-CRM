import { count, and, asc, eq, gt, like, lte, or, sql } from "drizzle-orm";

import { clientInteractions, clients, users } from "../../shared/schema";
import { db } from "../db";

type GetAcompanhamentoDataParams = {
  userId: string;
  userRole: string;
  searchQuery?: string;
  page: number;
  pageSize: number;
};

type AcompanhamentoClient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  createdAt: Date;
  responsavelName: string | null;
};

export async function getAcompanhamentoData({
  userId,
  userRole,
  searchQuery,
  page,
  pageSize,
}: GetAcompanhamentoDataParams) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const clientsWithInteractions = db
    .selectDistinct({ clientId: clientInteractions.clientId })
    .from(clientInteractions);

  const baseConditions = [
    sql`${clients.id} NOT IN ${clientsWithInteractions}`,
    lte(clients.createdAt, oneDayAgo),
  ];

  if (userRole !== "admin" && userRole !== "administrador") {
    baseConditions.push(eq(clients.responsavelId, userId));
  }

  if (searchQuery) {
    const lowercasedQuery = `%${searchQuery.toLowerCase()}%`;
    const searchCondition = or(
      like(clients.name, lowercasedQuery),
      like(clients.phone, lowercasedQuery),
      like(clients.cpf, lowercasedQuery),
    );

    if (searchCondition) {
      baseConditions.push(searchCondition);
    }
  }

  const finalConditions = and(...baseConditions);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const clientsQuery = db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      email: clients.email,
      cpf: clients.cpf,
      createdAt: clients.createdAt,
      responsavelName: users.name,
    })
    .from(clients)
    .leftJoin(users, eq(clients.responsavelId, users.id))
    .where(finalConditions)
    .orderBy(asc(clients.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalPendentesQuery = db
    .select({ count: count() })
    .from(clients)
    .where(finalConditions);

  const criticosQuery = db
    .select({ count: count() })
    .from(clients)
    .where(and(finalConditions, lte(clients.createdAt, thirtyDaysAgo)));

  const altaQuery = db
    .select({ count: count() })
    .from(clients)
    .where(
      and(
        finalConditions,
        lte(clients.createdAt, fourteenDaysAgo),
        gt(clients.createdAt, thirtyDaysAgo),
      ),
    );

  const mediaQuery = db
    .select({ count: count() })
    .from(clients)
    .where(
      and(
        finalConditions,
        lte(clients.createdAt, sevenDaysAgo),
        gt(clients.createdAt, fourteenDaysAgo),
      ),
    );

  const normalQuery = db
    .select({ count: count() })
    .from(clients)
    .where(and(finalConditions, gt(clients.createdAt, sevenDaysAgo)));

  const totalClientsInSystemQuery =
    userRole !== "admin" && userRole !== "administrador"
      ? db
          .select({ count: count() })
          .from(clients)
          .where(eq(clients.responsavelId, userId))
      : db.select({ count: count() }).from(clients);

  const totalInteracoesQuery = db
    .select({ count: count() })
    .from(clientInteractions);

  const [
    clientsToContactRaw,
    totalPendentesResult,
    criticosResult,
    altaResult,
    mediaResult,
    normalResult,
    totalClientsResult,
    totalInteracoesResult,
  ] = await Promise.all([
    clientsQuery,
    totalPendentesQuery,
    criticosQuery,
    altaQuery,
    mediaQuery,
    normalQuery,
    totalClientsInSystemQuery,
    totalInteracoesQuery,
  ]);

  const today = new Date();
  const clientsToContact = (clientsToContactRaw as AcompanhamentoClient[]).map(
    (client) => {
      const createdDate = new Date(client.createdAt);
      const daysSinceCreated = Math.floor(
        (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        ...client,
        daysSinceCreated,
        responsavelName: client.responsavelName || "Não definido",
      };
    },
  );

  const totalPendentes = totalPendentesResult[0].count;
  const totalClientes = totalClientsResult[0].count;
  const totalInteracoes = totalInteracoesResult[0].count;

  return {
    clients: clientsToContact,
    stats: {
      totalPendentes,
      criticos: criticosResult[0].count,
      alta: altaResult[0].count,
      media: mediaResult[0].count,
      normal: normalResult[0].count,
      produtividade:
        totalClientes > 0
          ? Math.round(((totalClientes - totalPendentes) / totalClientes) * 100)
          : 100,
      totalInteracoes,
      mediaInteracoes:
        totalClientes > 0 ? (totalInteracoes / totalClientes).toFixed(1) : "0",
    },
    pagination: {
      currentPage: page,
      pageSize,
      totalPages: Math.ceil(totalPendentes / pageSize),
      totalItems: totalPendentes,
    },
  };
}
