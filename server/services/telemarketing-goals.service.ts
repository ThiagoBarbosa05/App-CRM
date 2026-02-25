import { telemarketingGoalsRepository } from "../repositories/telemarketing-goals.repository";

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
}

export const telemarketingGoalsService = new TelemarketingGoalsService();
