import { db } from "../db";
import { telemarketingGoals, users } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class TelemarketingGoalsRepository {
  async findAll(userId?: string, userRole?: string) {
    let query = db
      .select({
        id: telemarketingGoals.id,
        userId: telemarketingGoals.userId,
        targetResult: telemarketingGoals.targetResult,
        targetQuantity: telemarketingGoals.targetQuantity,
        month: telemarketingGoals.month,
        year: telemarketingGoals.year,
        createdAt: telemarketingGoals.createdAt,
        updatedAt: telemarketingGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(telemarketingGoals)
      .leftJoin(users, eq(telemarketingGoals.userId, users.id));

    if (userRole === "vendedor" && userId) {
      query = query.where(eq(telemarketingGoals.userId, userId)) as any;
    }

    return await query.orderBy(desc(telemarketingGoals.createdAt));
  }

  async findByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string
  ) {
    let query = db
      .select({
        id: telemarketingGoals.id,
        userId: telemarketingGoals.userId,
        targetResult: telemarketingGoals.targetResult,
        targetQuantity: telemarketingGoals.targetQuantity,
        month: telemarketingGoals.month,
        year: telemarketingGoals.year,
        createdAt: telemarketingGoals.createdAt,
        updatedAt: telemarketingGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(telemarketingGoals)
      .leftJoin(users, eq(telemarketingGoals.userId, users.id));

    const conditions = [
      eq(telemarketingGoals.month, month),
      eq(telemarketingGoals.year, year),
    ];

    if (userRole === "vendedor" && userId) {
      conditions.push(eq(telemarketingGoals.userId, userId));
    }

    return await query
      .where(and(...conditions))
      .orderBy(desc(telemarketingGoals.createdAt));
  }
}

export const telemarketingGoalsRepository = new TelemarketingGoalsRepository();
