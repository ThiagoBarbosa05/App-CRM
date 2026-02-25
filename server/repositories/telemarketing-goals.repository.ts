import { db } from "../db";
import { telemarketingGoals, users, type InsertTelemarketingGoal, type TelemarketingGoal } from "@shared/schema";
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

  async create(insertGoal: InsertTelemarketingGoal): Promise<TelemarketingGoal> {
    const [goal] = await db
      .insert(telemarketingGoals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async update(
    id: string,
    updateData: Partial<InsertTelemarketingGoal>
  ): Promise<TelemarketingGoal | undefined> {
    const [goal] = await db
      .update(telemarketingGoals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(telemarketingGoals.id, id))
      .returning();
    return goal || undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(telemarketingGoals)
      .where(eq(telemarketingGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const telemarketingGoalsRepository = new TelemarketingGoalsRepository();
