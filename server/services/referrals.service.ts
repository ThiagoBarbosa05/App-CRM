import { db } from "../db";
import {
  referrals,
  clients,
  users,
  referralBenefitCatalog,
  referralBenefitDeliveries,
} from "../../shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  Referral,
  ReferralBenefitCatalog,
  InsertReferralBenefitCatalog,
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
    const [benefit] = await db
      .select({ type: referralBenefitCatalog.type })
      .from(referralBenefitCatalog)
      .where(eq(referralBenefitCatalog.id, benefitCatalogId))
      .limit(1);

    if (!benefit) throw new Error("Benefício não encontrado no catálogo");

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
