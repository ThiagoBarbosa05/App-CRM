import { db } from "../db";
import { referrals, clients } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { Referral } from "../../shared/schema";

export interface ReferralStats {
  totalReferred: number;
  totalPurchased: number;
  benefit1Granted: boolean;
  benefit2Granted: boolean;
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

function computeStats(clientReferrals: Referral[]): ReferralStats {
  const totalReferred = clientReferrals.length;
  const totalPurchased = clientReferrals.filter((r) => r.hasPurchased).length;
  return {
    totalReferred,
    totalPurchased,
    benefit1Granted: totalReferred >= REFERRAL_THRESHOLD,
    benefit2Granted: totalPurchased >= REFERRAL_THRESHOLD,
  };
}

export const referralsService = {
  async getByReferrer(referrerId: string): Promise<ReferralWithStats> {
    const clientReferrals = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, referrerId))
      .orderBy(referrals.createdAt);

    return {
      referrals: clientReferrals,
      stats: computeStats(clientReferrals),
    };
  },

  async addReferral(data: {
    referrerId: string;
    referredName: string;
    referredPhone: string;
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

  async linkReferralToClient(
    referralId: string,
    clientId: string,
  ): Promise<void> {
    await db
      .update(referrals)
      .set({ referredClientId: clientId })
      .where(eq(referrals.id, referralId));
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
};
