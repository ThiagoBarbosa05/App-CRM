import { db } from "../db";
import {
  restaurantDailyMenuItems,
  restaurantMenuItems,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { RestaurantMenuItem } from "../../shared/schema";

function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

export const restaurantDailyMenuService = {
  async getDailyMenu(date?: string): Promise<RestaurantMenuItem[]> {
    const targetDate = date ?? todayIso();

    const rows = await db
      .select({ menuItem: restaurantMenuItems })
      .from(restaurantDailyMenuItems)
      .innerJoin(
        restaurantMenuItems,
        eq(restaurantDailyMenuItems.menuItemId, restaurantMenuItems.id),
      )
      .where(
        and(
          eq(restaurantDailyMenuItems.date, targetDate),
          eq(restaurantMenuItems.isActive, true),
        ),
      )
      .orderBy(restaurantMenuItems.category, restaurantMenuItems.name);

    return rows.map((row) => row.menuItem);
  },

  async setDailyMenu(
    date: string,
    menuItemIds: string[],
    actorId: string,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(restaurantDailyMenuItems)
        .where(eq(restaurantDailyMenuItems.date, date));

      if (menuItemIds.length === 0) return;

      await tx.insert(restaurantDailyMenuItems).values(
        menuItemIds.map((menuItemId) => ({
          date,
          menuItemId,
          createdBy: actorId,
        })),
      );
    });
  },
};

export { todayIso as getTodayIsoDate };
