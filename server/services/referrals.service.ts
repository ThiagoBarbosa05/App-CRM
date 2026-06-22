import { db } from "../db";
import {
  referrals,
  clients,
  users,
  referralBenefitCatalog,
  referralBenefitDeliveries,
  referralIncentiveCatalog,
  referralIncentiveDeliveries,
} from "../../shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  Referral,
  ReferralBenefitCatalog,
  InsertReferralBenefitCatalog,
  ReferralIncentiveCatalog,
  InsertReferralIncentiveCatalog,
} from "../../shared/schema";

export interface ReferralStats {
  totalReferred: number;
  totalPurchased: number;
  benefit1Granted: boolean;
  benefit2Granted: boolean;
  benefit1DeliveredAt: Date | null;
  benefit2DeliveredAt: Date | null;
}

export interface ReferralWithStats {
  referrals: Referral[];
  stats: ReferralStats;
}

export interface ReferrerInfo {
  id: string;
  name: string;
}

const REFERRAL_THRESHOLD = 3;

function computeStats(
  clientReferrals: Referral[],
  benefit1DeliveredAt: Date | null,
  benefit2DeliveredAt: Date | null,
): ReferralStats {
  const totalReferred = clientReferrals.length;
  const totalPurchased = clientReferrals.filter((r) => r.hasPurchased).length;
  return {
    totalReferred,
    totalPurchased,
    benefit1Granted: totalReferred >= REFERRAL_THRESHOLD,
    benefit2Granted: totalPurchased >= REFERRAL_THRESHOLD,
    benefit1DeliveredAt,
    benefit2DeliveredAt,
  };
}

export const referralsService = {
  async getByReferrer(referrerId: string): Promise<ReferralWithStats> {
    const [clientReferrals, referrerRow] = await Promise.all([
      db
        .select()
        .from(referrals)
        .where(eq(referrals.referrerId, referrerId))
        .orderBy(referrals.createdAt),
      db
        .select({
          referralBenefit1At: clients.referralBenefit1At,
          referralBenefit2At: clients.referralBenefit2At,
        })
        .from(clients)
        .where(eq(clients.id, referrerId))
        .limit(1),
    ]);

    const b1 = referrerRow[0]?.referralBenefit1At ?? null;
    const b2 = referrerRow[0]?.referralBenefit2At ?? null;

    return {
      referrals: clientReferrals,
      stats: computeStats(clientReferrals, b1, b2),
    };
  },

  async addReferral(data: {
    referrerId: string;
    referredName: string;
    referredPhone: string;
    createdByUserId: string | null;
  }): Promise<Referral> {
    const phone = data.referredPhone.replace(/\D/g, "");

    // Check if a client with this phone already exists — reject if so
    if (phone) {
      const [existingClient] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.phone, phone))
        .limit(1);

      if (existingClient) {
        throw Object.assign(
          new Error("Este cliente já está cadastrado no sistema."),
          { code: "ALREADY_EXISTS" },
        );
      }
    }

    // Create a new client for this referral
    let referredClientId: string | null = null;

    if (phone) {
      const [newClient] = await db
        .insert(clients)
        .values({
          name: data.referredName,
          phone: phone,
          categoria: "Geral",
          origem: "Indicação",
          status: "pending",
          markers: [],
          responsavelId: data.createdByUserId,
        })
        .returning({ id: clients.id });

      referredClientId = newClient.id;
    }

    const [created] = await db
      .insert(referrals)
      .values({
        referrerId: data.referrerId,
        referredName: data.referredName,
        referredPhone: phone,
        referredClientId,
      })
      .returning();

    return created;
  },

  async markMessageSent(referralId: string): Promise<Referral | null> {
    const [updated] = await db
      .update(referrals)
      .set({ messageSent: true })
      .where(eq(referrals.id, referralId))
      .returning();

    return updated ?? null;
  },

  async checkAndMarkPurchase(clientId: string): Promise<void> {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referredClientId, clientId),
          eq(referrals.hasPurchased, false),
        ),
      )
      .limit(1);

    if (!referral) return;

    await db
      .update(referrals)
      .set({ hasPurchased: true, purchasedAt: new Date() })
      .where(eq(referrals.id, referral.id));
  },

  async deleteReferral(referralId: string): Promise<void> {
    await db.delete(referrals).where(eq(referrals.id, referralId));
  },

  async markBenefitDelivered(referrerId: string, level: 1 | 2): Promise<void> {
    const field =
      level === 1
        ? { referralBenefit1At: new Date() }
        : { referralBenefit2At: new Date() };
    await db.update(clients).set(field).where(eq(clients.id, referrerId));
  },

  async matchReferralByPhone(phone: string, clientId: string): Promise<void> {
    const normalized = phone.replace(/\D/g, "");
    const [referral] = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referredPhone, normalized),
          eq(referrals.hasPurchased, false),
        ),
      )
      .limit(1);

    if (referral && !referral.referredClientId) {
      await db
        .update(referrals)
        .set({ referredClientId: clientId })
        .where(eq(referrals.id, referral.id));
    }
  },

  async getProgramData(
    userId: string,
    userRole: string,
  ): Promise<{
    referrals: Array<{
      id: string;
      referrerId: string;
      referrerName: string;
      referrerResponsavelId: string | null;
      referrerResponsavelName: string | null;
      referredName: string;
      referredPhone: string;
      referredClientId: string | null;
      messageSent: boolean;
      hasPurchased: boolean;
      purchasedAt: Date | null;
      createdAt: Date;
      benefit1DeliveredAt: Date | null;
      benefit2DeliveredAt: Date | null;
    }>;
    stats: {
      totalReferrals: number;
      totalPurchased: number;
      conversionRate: number;
      clientsWithBenefit1: number;
      clientsWithBenefit2: number;
    };
  }> {
    const responsavel = alias(users, "responsavel");
    const isVendedor = userRole === "vendedor" && !!userId;

    const rows = await db
      .select({
        id: referrals.id,
        referrerId: referrals.referrerId,
        referrerName: clients.name,
        referrerResponsavelId: clients.responsavelId,
        referrerResponsavelName: responsavel.name,
        referredName: referrals.referredName,
        referredPhone: referrals.referredPhone,
        referredClientId: referrals.referredClientId,
        messageSent: referrals.messageSent,
        hasPurchased: referrals.hasPurchased,
        purchasedAt: referrals.purchasedAt,
        createdAt: referrals.createdAt,
        benefit1DeliveredAt: clients.referralBenefit1At,
        benefit2DeliveredAt: clients.referralBenefit2At,
      })
      .from(referrals)
      .innerJoin(clients, eq(referrals.referrerId, clients.id))
      .leftJoin(responsavel, eq(clients.responsavelId, responsavel.id))
      .where(isVendedor ? eq(clients.responsavelId, userId) : undefined)
      .orderBy(desc(referrals.createdAt));

    const totalReferrals = rows.length;
    const totalPurchased = rows.filter((r) => r.hasPurchased).length;
    const conversionRate =
      totalReferrals > 0 ? Math.round((totalPurchased / totalReferrals) * 100) : 0;

    const referrerIds = Array.from(new Set(rows.map((r) => r.referrerId)));
    const referrers = await db
      .select({
        id: clients.id,
        b1: clients.referralBenefit1At,
        b2: clients.referralBenefit2At,
      })
      .from(clients)
      .where(referrerIds.length > 0 ? inArray(clients.id, referrerIds) : eq(clients.id, "none"));

    const clientsWithBenefit1 = referrers.filter((r) => r.b1 !== null).length;
    const clientsWithBenefit2 = referrers.filter((r) => r.b2 !== null).length;

    return {
      referrals: rows,
      stats: { totalReferrals, totalPurchased, conversionRate, clientsWithBenefit1, clientsWithBenefit2 },
    };
  },

  async getReferrerByClientId(clientId: string): Promise<ReferrerInfo | null> {
    const [referral] = await db
      .select({ referrerId: referrals.referrerId })
      .from(referrals)
      .where(eq(referrals.referredClientId, clientId))
      .limit(1);

    if (!referral) return null;

    const [referrer] = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.id, referral.referrerId))
      .limit(1);

    return referrer ?? null;
  },

  // ─── Catálogo de Benefícios ───────────────────────────────────────────────

  async getBenefitCatalog(
    includeInactive = false,
  ): Promise<ReferralBenefitCatalog[]> {
    const results = await db
      .select()
      .from(referralBenefitCatalog)
      .where(
        includeInactive ? undefined : eq(referralBenefitCatalog.isActive, true),
      )
      .orderBy(referralBenefitCatalog.type, referralBenefitCatalog.name);
    return results;
  },

  async createBenefit(
    data: InsertReferralBenefitCatalog,
  ): Promise<ReferralBenefitCatalog> {
    const [created] = await db
      .insert(referralBenefitCatalog)
      .values(data)
      .returning();
    return created;
  },

  async updateBenefit(
    id: string,
    data: Partial<InsertReferralBenefitCatalog>,
  ): Promise<ReferralBenefitCatalog | null> {
    const [updated] = await db
      .update(referralBenefitCatalog)
      .set(data)
      .where(eq(referralBenefitCatalog.id, id))
      .returning();
    return updated ?? null;
  },

  async deleteBenefit(id: string): Promise<void> {
    await db
      .delete(referralBenefitCatalog)
      .where(eq(referralBenefitCatalog.id, id));
  },

  // ─── Entrega de Benefícios ─────────────────────────────────────────────────

  async deliverBenefitFromCatalog(
    referrerId: string,
    benefitCatalogId: string,
    deliveredByUserId: string,
    notes?: string,
  ): Promise<void> {
    // 1. Busca o benefício no catálogo
    const [benefit] = await db
      .select({ type: referralBenefitCatalog.type, isActive: referralBenefitCatalog.isActive })
      .from(referralBenefitCatalog)
      .where(eq(referralBenefitCatalog.id, benefitCatalogId))
      .limit(1);

    if (!benefit) throw new Error("Benefício não encontrado no catálogo");
    if (!benefit.isActive) throw new Error("Este benefício está inativo e não pode ser entregue");

    // 2. Busca estado atual do cliente (entregas já realizadas)
    const [clientRow] = await db
      .select({
        referralBenefit1At: clients.referralBenefit1At,
        referralBenefit2At: clients.referralBenefit2At,
      })
      .from(clients)
      .where(eq(clients.id, referrerId))
      .limit(1);

    if (!clientRow) throw new Error("Cliente não encontrado");

    // 3. Impede dupla entrega do mesmo nível
    if (benefit.type === "B1" && clientRow.referralBenefit1At) {
      throw new Error("Benefício B1 já foi entregue para este cliente");
    }
    if (benefit.type === "B2" && clientRow.referralBenefit2At) {
      throw new Error("Benefício B2 já foi entregue para este cliente");
    }

    // 4. Valida se o cliente atingiu o threshold necessário
    const clientReferrals = await db
      .select({ hasPurchased: referrals.hasPurchased })
      .from(referrals)
      .where(eq(referrals.referrerId, referrerId));

    const totalReferred = clientReferrals.length;
    const totalPurchased = clientReferrals.filter((r) => r.hasPurchased).length;

    if (benefit.type === "B1" && totalReferred < REFERRAL_THRESHOLD) {
      throw new Error(
        `Cliente precisa de ${REFERRAL_THRESHOLD} indicações para receber o B1 (possui ${totalReferred})`,
      );
    }
    if (benefit.type === "B2" && totalPurchased < REFERRAL_THRESHOLD) {
      throw new Error(
        `Cliente precisa de ${REFERRAL_THRESHOLD} indicados que compraram para receber o B2 (possui ${totalPurchased})`,
      );
    }

    // 5. Registra a entrega
    await db.insert(referralBenefitDeliveries).values({
      referrerId,
      benefitCatalogId,
      deliveredByUserId,
      notes: notes ?? null,
    });

    const field =
      benefit.type === "B1"
        ? { referralBenefit1At: new Date() }
        : { referralBenefit2At: new Date() };
    await db.update(clients).set(field).where(eq(clients.id, referrerId));
  },

  // ─── Catálogo de Incentivos (para indicados) ─────────────────────────────

  async getIncentiveCatalog(
    includeInactive = false,
  ): Promise<ReferralIncentiveCatalog[]> {
    return db
      .select()
      .from(referralIncentiveCatalog)
      .where(
        includeInactive
          ? undefined
          : eq(referralIncentiveCatalog.isActive, true),
      )
      .orderBy(referralIncentiveCatalog.name);
  },

  async createIncentiveItem(
    data: InsertReferralIncentiveCatalog,
  ): Promise<ReferralIncentiveCatalog> {
    const [created] = await db
      .insert(referralIncentiveCatalog)
      .values(data)
      .returning();
    return created;
  },

  async updateIncentiveItem(
    id: string,
    data: Partial<InsertReferralIncentiveCatalog>,
  ): Promise<ReferralIncentiveCatalog | null> {
    const [updated] = await db
      .update(referralIncentiveCatalog)
      .set(data)
      .where(eq(referralIncentiveCatalog.id, id))
      .returning();
    return updated ?? null;
  },

  async deleteIncentiveItem(id: string): Promise<void> {
    await db
      .delete(referralIncentiveCatalog)
      .where(eq(referralIncentiveCatalog.id, id));
  },

  // ─── Status de incentivo para um cliente indicado ─────────────────────────

  async getClientIncentiveStatus(clientId: string): Promise<{
    wasReferred: boolean;
    referrerId: string | null;
    referrerName: string | null;
    hasPurchased: boolean;
    delivery: {
      id: string;
      incentiveName: string;
      incentiveDescription: string | null;
      deliveredAt: Date;
      deliveredByName: string;
      notes: string | null;
    } | null;
  }> {
    // Busca se este cliente foi indicado por alguém
    const [referralRow] = await db
      .select({
        referrerId: referrals.referrerId,
        hasPurchased: referrals.hasPurchased,
        referrerName: clients.name,
      })
      .from(referrals)
      .innerJoin(clients, eq(referrals.referrerId, clients.id))
      .where(eq(referrals.referredClientId, clientId))
      .limit(1);

    if (!referralRow) {
      return {
        wasReferred: false,
        referrerId: null,
        referrerName: null,
        hasPurchased: false,
        delivery: null,
      };
    }

    // Busca entrega de incentivo para este cliente
    const deliverer = alias(users, "deliverer");
    const [deliveryRow] = await db
      .select({
        id: referralIncentiveDeliveries.id,
        incentiveName: referralIncentiveCatalog.name,
        incentiveDescription: referralIncentiveCatalog.description,
        deliveredAt: referralIncentiveDeliveries.deliveredAt,
        deliveredByName: deliverer.name,
        notes: referralIncentiveDeliveries.notes,
      })
      .from(referralIncentiveDeliveries)
      .innerJoin(
        referralIncentiveCatalog,
        eq(
          referralIncentiveDeliveries.incentiveCatalogId,
          referralIncentiveCatalog.id,
        ),
      )
      .innerJoin(
        deliverer,
        eq(referralIncentiveDeliveries.deliveredByUserId, deliverer.id),
      )
      .where(eq(referralIncentiveDeliveries.referredClientId, clientId))
      .limit(1);

    return {
      wasReferred: true,
      referrerId: referralRow.referrerId,
      referrerName: referralRow.referrerName,
      hasPurchased: referralRow.hasPurchased,
      delivery: deliveryRow ?? null,
    };
  },

  async deliverIncentive(
    referredClientId: string,
    incentiveCatalogId: string,
    deliveredByUserId: string,
    notes?: string,
  ): Promise<void> {
    // 1. Verifica se o item existe e está ativo
    const [item] = await db
      .select({ isActive: referralIncentiveCatalog.isActive })
      .from(referralIncentiveCatalog)
      .where(eq(referralIncentiveCatalog.id, incentiveCatalogId))
      .limit(1);

    if (!item) throw new Error("Brinde não encontrado no catálogo");
    if (!item.isActive)
      throw new Error("Este brinde está inativo e não pode ser entregue");

    // 2. Verifica se o cliente foi realmente indicado
    const [referralRow] = await db
      .select({ hasPurchased: referrals.hasPurchased })
      .from(referrals)
      .where(eq(referrals.referredClientId, referredClientId))
      .limit(1);

    if (!referralRow)
      throw new Error("Este cliente não possui registro de indicação");

    if (!referralRow.hasPurchased)
      throw new Error(
        "O cliente ainda não realizou uma compra. Brinde disponível somente após a primeira compra.",
      );

    // 3. Verifica dupla entrega
    const [existing] = await db
      .select({ id: referralIncentiveDeliveries.id })
      .from(referralIncentiveDeliveries)
      .where(eq(referralIncentiveDeliveries.referredClientId, referredClientId))
      .limit(1);

    if (existing)
      throw new Error("Este cliente já recebeu um brinde de incentivo");

    // 4. Registra a entrega
    await db.insert(referralIncentiveDeliveries).values({
      referredClientId,
      incentiveCatalogId,
      deliveredByUserId,
      notes: notes ?? null,
    });
  },

  async getIncentiveDeliveries(
    userId?: string,
    userRole?: string,
  ): Promise<
    Array<{
      id: string;
      referredClientId: string;
      referredClientName: string;
      referrerId: string | null;
      referrerName: string | null;
      incentiveName: string;
      incentiveDescription: string | null;
      deliveredByUserId: string;
      deliveredByName: string;
      deliveredAt: Date;
      notes: string | null;
    }>
  > {
    const deliverer = alias(users, "deliverer");
    const referredClient = alias(clients, "referred_client");
    const referrerClient = alias(clients, "referrer_client");
    const isVendedor = userRole === "vendedor" && !!userId;

    return db
      .select({
        id: referralIncentiveDeliveries.id,
        referredClientId: referralIncentiveDeliveries.referredClientId,
        referredClientName: referredClient.name,
        referrerId: referrals.referrerId,
        referrerName: referrerClient.name,
        incentiveName: referralIncentiveCatalog.name,
        incentiveDescription: referralIncentiveCatalog.description,
        deliveredByUserId: referralIncentiveDeliveries.deliveredByUserId,
        deliveredByName: deliverer.name,
        deliveredAt: referralIncentiveDeliveries.deliveredAt,
        notes: referralIncentiveDeliveries.notes,
      })
      .from(referralIncentiveDeliveries)
      .innerJoin(
        referredClient,
        eq(referralIncentiveDeliveries.referredClientId, referredClient.id),
      )
      .innerJoin(
        referralIncentiveCatalog,
        eq(
          referralIncentiveDeliveries.incentiveCatalogId,
          referralIncentiveCatalog.id,
        ),
      )
      .innerJoin(
        deliverer,
        eq(referralIncentiveDeliveries.deliveredByUserId, deliverer.id),
      )
      .leftJoin(
        referrals,
        eq(referrals.referredClientId, referralIncentiveDeliveries.referredClientId),
      )
      .leftJoin(referrerClient, eq(referrals.referrerId, referrerClient.id))
      .where(
        isVendedor ? eq(referredClient.responsavelId, userId) : undefined,
      )
      .orderBy(desc(referralIncentiveDeliveries.deliveredAt));
  },

  async getDeliveries(
    userId?: string,
    userRole?: string,
  ): Promise<
    Array<{
      id: string;
      referrerId: string;
      referrerName: string;
      benefitCatalogId: string;
      benefitName: string;
      benefitType: string;
      benefitDescription: string | null;
      deliveredByUserId: string;
      deliveredByName: string;
      deliveredAt: Date;
      notes: string | null;
    }>
  > {
    const deliverer = alias(users, "deliverer");
    const isVendedor = userRole === "vendedor" && !!userId;

    const rows = await db
      .select({
        id: referralBenefitDeliveries.id,
        referrerId: referralBenefitDeliveries.referrerId,
        referrerName: clients.name,
        benefitCatalogId: referralBenefitDeliveries.benefitCatalogId,
        benefitName: referralBenefitCatalog.name,
        benefitType: referralBenefitCatalog.type,
        benefitDescription: referralBenefitCatalog.description,
        deliveredByUserId: referralBenefitDeliveries.deliveredByUserId,
        deliveredByName: deliverer.name,
        deliveredAt: referralBenefitDeliveries.deliveredAt,
        notes: referralBenefitDeliveries.notes,
      })
      .from(referralBenefitDeliveries)
      .innerJoin(
        clients,
        eq(referralBenefitDeliveries.referrerId, clients.id),
      )
      .innerJoin(
        referralBenefitCatalog,
        eq(
          referralBenefitDeliveries.benefitCatalogId,
          referralBenefitCatalog.id,
        ),
      )
      .innerJoin(
        deliverer,
        eq(referralBenefitDeliveries.deliveredByUserId, deliverer.id),
      )
      .where(isVendedor ? eq(clients.responsavelId, userId) : undefined)
      .orderBy(desc(referralBenefitDeliveries.deliveredAt));

    return rows;
  },
};
