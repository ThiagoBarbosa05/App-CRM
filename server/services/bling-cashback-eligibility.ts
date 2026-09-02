export const BLING_COMPLETED_SITUATION_ID = "9";

export type BlingCashbackAction = "none" | "create" | "reuse" | "cancel";

export function decideBlingCashbackAction(
  previousSituationId: string | null | undefined,
  currentSituationId: string | null | undefined,
  hasActiveCashback: boolean,
): BlingCashbackAction {
  const isCompleted = currentSituationId === BLING_COMPLETED_SITUATION_ID;
  if (!isCompleted) return hasActiveCashback ? "cancel" : "none";
  return hasActiveCashback ? "reuse" : "create";
}
