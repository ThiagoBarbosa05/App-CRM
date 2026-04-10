interface BottleGoalSnapshot {
  totalItems: number;
  totalOrders: number;
}

export interface BottleGoalProgress {
  achieved: number;
  goal: number;
  percentage: number;
}

export function getBottleGoalProgress(
  snapshot: BottleGoalSnapshot,
  goal: number,
): BottleGoalProgress {
  const safeGoal = goal > 0 ? goal : 0;
  const achieved = snapshot.totalItems;

  return {
    achieved,
    goal: safeGoal,
    percentage:
      safeGoal > 0 ? Math.min((achieved / safeGoal) * 100, 100) : 0,
  };
}
