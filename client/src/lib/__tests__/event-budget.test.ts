import { describe, expect, it } from "vitest";
import {
  calculateActualResult,
  calculateEventBudget,
  DEFAULT_EVENT_MATERIALS,
  DEFAULT_EVENT_TEAM,
} from "@shared/event-budget";

describe("event budget calculator", () => {
  it("dimensions food, wine and automatic operation items from participant count", () => {
    const result = calculateEventBudget({
      participants: 20,
      duration: 3,
      format: "coquetel",
      selection: "premium",
      winePerPerson: 0.8,
      targetMargin: 40,
      team: DEFAULT_EVENT_TEAM,
      materials: DEFAULT_EVENT_MATERIALS,
    });

    expect(result.bottles).toBe(16);
    expect(result.weights.cheeses).toBeCloseTo(1.4);
    expect(result.team.lines.find((line) => line.id === "garcom")?.resolvedQuantity).toBe(1);
    expect(result.materials.lines.find((line) => line.id === "tacas")?.resolvedQuantity).toBe(24);
    expect(result.plannedPrice).toBeCloseTo(result.plannedCost / 0.6);
  });

  it("uses a manual price and reports its effective margin", () => {
    const result = calculateEventBudget({
      participants: 10,
      duration: 3,
      format: "entrada",
      selection: "essencial",
      winePerPerson: 0.5,
      targetMargin: 40,
      manualPrice: 5000,
    });

    expect(result.plannedPrice).toBe(5000);
    expect(result.marginPercent).toBeGreaterThan(0);
  });

  it("calculates actual result from paid or open costs consistently", () => {
    const result = calculateActualResult({
      participants: 10,
      revenue: 2500,
      costs: [
        { quantity: "2", unitValue: "100" },
        { quantity: "1.5", unitValue: "200" },
      ],
    });

    expect(result.totalCost).toBe(500);
    expect(result.costPerParticipant).toBe(50);
    expect(result.result).toBe(2000);
    expect(result.marginPercent).toBe(80);
  });
});