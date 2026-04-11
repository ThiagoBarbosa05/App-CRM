import { Request, Response } from "express";
import { db } from "../../db";
import { clients, users } from "@shared/schema";
import { sql, count, eq, and, inArray } from "drizzle-orm";
import { startOfDay, addDays, parseISO, isWithinInterval } from "date-fns";
import { clientsService } from "../../services/clients.service";
import { ClientsRepository } from "../../repositories/clients.repository";

export interface ClientReportsData {
  totalClients: number;

  // Clients by category
  clientsByCategory: Array<{
    category: string | null;
    count: number;
  }>;

  // Clients by origin
  clientsByOrigin: Array<{
    origin: string | null;
    count: number;
  }>;

  // Clients by responsible user
  clientsByUser: Array<{
    userId: string | null;
    userName: string;
    count: number;
  }>;

  // Clients by markers
  clientsByMarkers: Array<{
    marker: string;
    count: number;
  }>;

  // Birthday statistics
  upcomingBirthdays: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
    birthday: string;
    daysUntil: number;
  }>;

  // Contact information statistics
  clientsWithEmail: number;
  clientsWithoutEmail: number;
  clientsWithPhone: number;
  clientsWithoutPhone: number;
  clientsWithCPF: number;
  clientsWithoutCPF: number;
  clientsWithAddress: number;
  clientsWithoutAddress: number;
}

/**
 * Get comprehensive client reports data
 * Optimized with efficient database queries
 */
export const getClientReportsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filterUserId = req.query.filterUserId as string | undefined;
    const { userId, userRole, filters } = clientsService.processRequestParams(req);
    const clientsRepository = new ClientsRepository();
    const filteredClientIds = await clientsRepository.getFilteredClientIds(
      userId,
      userRole,
      filters,
      filterUserId,
    );

    if (filteredClientIds.length === 0) {
      res.json({
        totalClients: 0,
        clientsByCategory: [],
        clientsByOrigin: [],
        clientsByUser: [],
        clientsByMarkers: [],
        upcomingBirthdays: [],
        clientsWithEmail: 0,
        clientsWithoutEmail: 0,
        clientsWithPhone: 0,
        clientsWithoutPhone: 0,
        clientsWithCPF: 0,
        clientsWithoutCPF: 0,
        clientsWithAddress: 0,
        clientsWithoutAddress: 0,
      } satisfies ClientReportsData);
      return;
    }

    const baseCondition = inArray(clients.id, filteredClientIds);

    // Execute all queries in parallel for better performance
    const [
      totalResult,
      categoryStats,
      originStats,
      userStats,
      emailStats,
      phoneStats,
      cpfStats,
      addressStats,
      birthdayClients,
    ] = await Promise.all([
      // Total clients count
      db.select({ count: count() }).from(clients).where(baseCondition),

      // Clients by category
      db
        .select({
          category: clients.categoria,
          count: count(),
        })
        .from(clients)
        .where(baseCondition)
        .groupBy(clients.categoria)
        .orderBy(sql`${count()} DESC`),

      // Clients by origin
      db
        .select({
          origin: clients.origem,
          count: count(),
        })
        .from(clients)
        .where(baseCondition)
        .groupBy(clients.origem)
        .orderBy(sql`${count()} DESC`),

      // Clients by responsible user
      db
        .select({
          userId: clients.responsavelId,
          userName: users.name,
          count: count(),
        })
        .from(clients)
        .leftJoin(users, eq(clients.responsavelId, users.id))
        .where(baseCondition)
        .groupBy(clients.responsavelId, users.name)
        .orderBy(sql`${count()} DESC`),

      // Email statistics
      db
        .select({
          hasEmail: sql<boolean>`CASE WHEN ${clients.email} IS NOT NULL AND ${clients.email} != '' THEN true ELSE false END`,
          count: count(),
        })
        .from(clients)
        .where(baseCondition)
        .groupBy(
          sql`CASE WHEN ${clients.email} IS NOT NULL AND ${clients.email} != '' THEN true ELSE false END`
        ),

      // Phone statistics (celular ou fixo)
      db
        .select({
          hasPhone: sql<boolean>`CASE WHEN (${clients.phone} IS NOT NULL AND ${clients.phone} != '') OR (${clients.fixedPhone} IS NOT NULL AND ${clients.fixedPhone} != '') THEN true ELSE false END`,
          count: count(),
        })
        .from(clients)
        .where(baseCondition)
        .groupBy(
          sql`CASE WHEN (${clients.phone} IS NOT NULL AND ${clients.phone} != '') OR (${clients.fixedPhone} IS NOT NULL AND ${clients.fixedPhone} != '') THEN true ELSE false END`
        ),

      // CPF statistics
      db
        .select({
          hasCpf: sql<boolean>`CASE WHEN ${clients.cpf} IS NOT NULL AND ${clients.cpf} != '' THEN true ELSE false END`,
          count: count(),
        })
        .from(clients)
        .where(baseCondition)
        .groupBy(
          sql`CASE WHEN ${clients.cpf} IS NOT NULL AND ${clients.cpf} != '' THEN true ELSE false END`
        ),

      // Address statistics
      db
        .select({
          hasAddress: sql<boolean>`CASE WHEN ${clients.address} IS NOT NULL AND ${clients.address} != '' THEN true ELSE false END`,
          count: count(),
        })
        .from(clients)
        .where(baseCondition)
        .groupBy(
          sql`CASE WHEN ${clients.address} IS NOT NULL AND ${clients.address} != '' THEN true ELSE false END`
        ),

      // Clients with birthdays for upcoming birthday calculation
      db
        .select({
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
          email: clients.email,
          birthday: clients.birthday,
        })
        .from(clients)
        .where(
          and(
            baseCondition,
            sql`${clients.birthday} IS NOT NULL AND ${clients.birthday} != ''`
          )
        ),
    ]);

    // Process results
    const totalClients = totalResult[0]?.count || 0;

    const clientsByCategory = categoryStats.map((item) => ({
      category: item.category || "Sem categoria",
      count: item.count,
    }));

    const clientsByOrigin = originStats.map((item) => ({
      origin: item.origin || "Sem origem",
      count: item.count,
    }));

    const clientsByUser = userStats.map((item) => ({
      userId: item.userId,
      userName: item.userName || "Sem responsável",
      count: item.count,
    }));

    // Process contact info stats
    let clientsWithEmail = 0;
    let clientsWithoutEmail = 0;

    emailStats.forEach((stat) => {
      if (stat.hasEmail === true) {
        clientsWithEmail = stat.count;
      } else {
        clientsWithoutEmail = stat.count;
      }
    });

    let clientsWithPhone = 0;
    let clientsWithoutPhone = 0;

    phoneStats.forEach((stat) => {
      if (stat.hasPhone === true) {
        clientsWithPhone = stat.count;
      } else {
        clientsWithoutPhone = stat.count;
      }
    });

    let clientsWithCPF = 0;
    let clientsWithoutCPF = 0;

    cpfStats.forEach((stat) => {
      if (stat.hasCpf === true) {
        clientsWithCPF = stat.count;
      } else {
        clientsWithoutCPF = stat.count;
      }
    });

    let clientsWithAddress = 0;
    let clientsWithoutAddress = 0;

    addressStats.forEach((stat) => {
      if (stat.hasAddress === true) {
        clientsWithAddress = stat.count;
      } else {
        clientsWithoutAddress = stat.count;
      }
    });

    // Process upcoming birthdays (next 30 days)
    const today = startOfDay(new Date());
    const next30Days = addDays(today, 30);

    const upcomingBirthdays = birthdayClients
      .filter((client) => client.birthday)
      .map((client) => {
        const birthday = parseISO(client.birthday!);
        const currentYear = new Date().getFullYear();

        // Create birthday date for this year
        const thisYearBirthday = new Date(
          currentYear,
          birthday.getMonth(),
          birthday.getDate()
        );

        // If already passed this year, consider next year
        const nextBirthday =
          thisYearBirthday < today
            ? new Date(currentYear + 1, birthday.getMonth(), birthday.getDate())
            : thisYearBirthday;

        return {
          ...client,
          nextBirthday,
          daysUntil: Math.ceil(
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          ),
        };
      })
      .filter((client) =>
        isWithinInterval(client.nextBirthday, {
          start: today,
          end: next30Days,
        })
      )
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 15) // Limit to 15 upcoming birthdays
      .map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone ?? "",
        email: client.email || undefined,
        birthday: client.birthday!,
        daysUntil: client.daysUntil,
      }));

    // Calculate marker statistics from clients array
    // This needs to be processed in memory since markers are stored as arrays
    const allClients = await db
      .select({
        markers: clients.markers,
      })
      .from(clients)
      .where(baseCondition);

    const markerCounts: { [key: string]: number } = {};

    allClients.forEach((client) => {
      const clientMarkers = client.markers || [];

      if (clientMarkers.length === 0) {
        markerCounts["Sem marcador"] = (markerCounts["Sem marcador"] || 0) + 1;
      } else {
        clientMarkers.forEach((marker) => {
          markerCounts[marker] = (markerCounts[marker] || 0) + 1;
        });
      }
    });

    const clientsByMarkers = Object.entries(markerCounts)
      .map(([marker, count]) => ({ marker, count }))
      .sort((a, b) => b.count - a.count);

    const reportData: ClientReportsData = {
      totalClients,
      clientsByCategory,
      clientsByOrigin,
      clientsByUser,
      clientsByMarkers,
      upcomingBirthdays,
      clientsWithEmail,
      clientsWithoutEmail,
      clientsWithPhone,
      clientsWithoutPhone,
      clientsWithCPF,
      clientsWithoutCPF,
      clientsWithAddress,
      clientsWithoutAddress,
    };

    res.json(reportData);
  } catch (error) {
    console.error("Error generating client reports:", error);
    res.status(500).json({
      message: "Erro ao gerar relatórios de clientes",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
