import { telemarketingGoalsRepository } from "../repositories/telemarketing-goals.repository";
import { type InsertTelemarketingGoal } from "@shared/schema";

export class TelemarketingGoalsService {
  async getGoals(userId?: string, userRole?: string) {
    return await telemarketingGoalsRepository.findAll(userId, userRole);
  }

  async getGoalsByPeriod(
    month: number,
    year: number,
    userId?: string,
    userRole?: string
  ) {
    return await telemarketingGoalsRepository.findByMonthYear(
      month,
      year,
      userId,
      userRole
    );
  }

  async createGoal(data: InsertTelemarketingGoal) {
    return await telemarketingGoalsRepository.create(data);
  }

  async updateGoal(id: string, data: Partial<InsertTelemarketingGoal>) {
    return await telemarketingGoalsRepository.update(id, data);
  }

  async deleteGoal(id: string) {
    return await telemarketingGoalsRepository.delete(id);
  }
}

export const telemarketingGoalsService = new TelemarketingGoalsService();
