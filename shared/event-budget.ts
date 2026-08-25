export type EventBudgetFormat = "coquetel" | "entrada" | "principal";
export type EventBudgetSelection = "essencial" | "premium" | "icone";

export interface EventBudgetLine {
  id: string;
  name: string;
  unitPrice: number;
  quantity?: number | null;
  automaticPerPerson?: number | null;
  defaultQuantity?: number;
}

export interface EventBudgetDraft {
  participants: number;
  duration: 2 | 3 | 4 | 5;
  format: EventBudgetFormat;
  selection: EventBudgetSelection;
  winePerPerson: number;
  targetMargin: number;
  manualPrice?: number | null;
  team?: EventBudgetLine[];
  materials?: EventBudgetLine[];
  proposalText?: string;
}

export interface EventBudgetCalculation {
  participants: number;
  duration: number;
  format: EventBudgetFormat;
  selection: EventBudgetSelection;
  weights: {
    cheeses: number;
    coldCuts: number;
    breads: number;
    accompaniments: number;
  };
  bottles: number;
  supplies: {
    cheeses: number;
    coldCuts: number;
    breads: number;
    accompaniments: number;
    wine: number;
  };
  operation: {
    team: number;
    materials: number;
    disposables: number;
    transport: number;
  };
  team: { total: number; lines: Array<EventBudgetLine & { resolvedQuantity: number; total: number }> };
  materials: { total: number; lines: Array<EventBudgetLine & { resolvedQuantity: number; total: number }> };
  suppliesTotal: number;
  operationTotal: number;
  plannedCost: number;
  plannedPrice: number;
  marginPercent: number;
  pricePerPerson: number;
  shoppingList: Array<{ name: string; quantity: string }>;
}

export const EVENT_BUDGET_DEFAULTS = {
  prices: {
    essencial: { cheeses: 95, coldCuts: 90, wine: 65 },
    premium: { cheeses: 145, coldCuts: 130, wine: 110 },
    icone: { cheeses: 210, coldCuts: 180, wine: 190 },
  },
  breads: 38,
  accompaniments: 75,
  disposables: 6,
  transport: 180,
} as const;

const FORMATS: Record<EventBudgetFormat, { cheeses: number; coldCuts: number; breads: number; accompaniments: number }> = {
  coquetel: { cheeses: 70, coldCuts: 50, breads: 45, accompaniments: 40 },
  entrada: { cheeses: 100, coldCuts: 70, breads: 55, accompaniments: 45 },
  principal: { cheeses: 160, coldCuts: 110, breads: 75, accompaniments: 60 },
};

const DURATION_MULTIPLIER: Record<number, number> = { 2: 0.9, 3: 1, 4: 1.15, 5: 1.3 };
export const EVENT_BUDGET_SELECTIONS = {
  essencial: { label: "Essencial", cheeses: 4, coldCuts: 3 },
  premium: { label: "Premium", cheeses: 6, coldCuts: 4 },
  icone: { label: "Ícone", cheeses: 8, coldCuts: 5 },
} as const;

export const EVENT_BUDGET_FORMATS = {
  coquetel: "Coquetel",
  entrada: "Entrada",
  principal: "Principal",
} as const;

export const DEFAULT_EVENT_TEAM: EventBudgetLine[] = [
  { id: "garcom", name: "Garçom", unitPrice: 220, automaticPerPerson: 0.04 },
  { id: "sommelier", name: "Sommelier", unitPrice: 600, defaultQuantity: 1 },
  { id: "cozinheiro", name: "Cozinheiro", unitPrice: 400, defaultQuantity: 0 },
  { id: "ajudante", name: "Ajudante de cozinha", unitPrice: 250, defaultQuantity: 0 },
];

export const DEFAULT_EVENT_MATERIALS: EventBudgetLine[] = [
  { id: "tacas", name: "Taças", unitPrice: 4, automaticPerPerson: 1.2 },
  { id: "pratos", name: "Pratos", unitPrice: 3, automaticPerPerson: 1 },
  { id: "talheres", name: "Jogos de talher", unitPrice: 3, automaticPerPerson: 1 },
  { id: "arranjo", name: "Arranjo de mesa", unitPrice: 280, defaultQuantity: 1 },
];

function positive(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function resolveLines(
  lines: EventBudgetLine[],
  participants: number,
): EventBudgetCalculation["team"] {
  const resolved = lines.map((line) => {
    const automatic = line.automaticPerPerson != null
      ? Math.max(1, Math.ceil(participants * positive(line.automaticPerPerson)))
      : positive(line.defaultQuantity);
    const resolvedQuantity = line.quantity == null ? automatic : Math.max(0, Math.floor(positive(line.quantity)));
    return {
      ...line,
      unitPrice: positive(line.unitPrice),
      resolvedQuantity,
      total: resolvedQuantity * positive(line.unitPrice),
    };
  });
  return {
    total: resolved.reduce((sum, line) => sum + line.total, 0),
    lines: resolved,
  };
}

export function calculateEventBudget(input: EventBudgetDraft): EventBudgetCalculation {
  const participants = Math.max(1, Math.floor(positive(input.participants, 1)));
  const duration = [2, 3, 4, 5].includes(input.duration) ? input.duration : 3;
  const format = FORMATS[input.format] ? input.format : "coquetel";
  const selection = EVENT_BUDGET_SELECTIONS[input.selection] ? input.selection : "premium";
  const multiplier = DURATION_MULTIPLIER[duration] ?? 1;
  const recipe = FORMATS[format];
  const prices = EVENT_BUDGET_DEFAULTS.prices[selection];
  const weights = {
    cheeses: participants * recipe.cheeses * multiplier / 1000,
    coldCuts: participants * recipe.coldCuts * multiplier / 1000,
    breads: participants * recipe.breads * multiplier / 1000,
    accompaniments: participants * recipe.accompaniments * multiplier / 1000,
  };
  const bottles = Math.ceil(participants * positive(input.winePerPerson, 0.8));
  const supplies = {
    cheeses: weights.cheeses * prices.cheeses,
    coldCuts: weights.coldCuts * prices.coldCuts,
    breads: weights.breads * EVENT_BUDGET_DEFAULTS.breads,
    accompaniments: weights.accompaniments * EVENT_BUDGET_DEFAULTS.accompaniments,
    wine: bottles * prices.wine,
  };
  const team = resolveLines(input.team?.length ? input.team : DEFAULT_EVENT_TEAM, participants);
  const materials = resolveLines(input.materials?.length ? input.materials : DEFAULT_EVENT_MATERIALS, participants);
  const operation = {
    team: team.total,
    materials: materials.total,
    disposables: participants * EVENT_BUDGET_DEFAULTS.disposables,
    transport: EVENT_BUDGET_DEFAULTS.transport,
  };
  const suppliesTotal = Object.values(supplies).reduce((sum, value) => sum + value, 0);
  const operationTotal = Object.values(operation).reduce((sum, value) => sum + value, 0);
  const plannedCost = suppliesTotal + operationTotal;
  const targetMargin = Math.min(95, Math.max(0, positive(input.targetMargin, 40)));
  const manualPrice = input.manualPrice != null && positive(input.manualPrice) > 0
    ? positive(input.manualPrice)
    : null;
  const plannedPrice = manualPrice ?? plannedCost / (1 - targetMargin / 100);
  const marginPercent = plannedPrice > 0 ? ((plannedPrice - plannedCost) / plannedPrice) * 100 : 0;
  const formatKg = (value: number) => `${value.toFixed(1)} kg`;
  return {
    participants,
    duration,
    format,
    selection,
    weights,
    bottles,
    supplies,
    operation,
    team,
    materials,
    suppliesTotal,
    operationTotal,
    plannedCost,
    plannedPrice,
    marginPercent,
    pricePerPerson: plannedPrice / participants,
    shoppingList: [
      { name: `Queijos — ${EVENT_BUDGET_SELECTIONS[selection].cheeses} variedades`, quantity: formatKg(weights.cheeses) },
      { name: `Frios e embutidos — ${EVENT_BUDGET_SELECTIONS[selection].coldCuts} variedades`, quantity: formatKg(weights.coldCuts) },
      { name: "Pães, torradas e grissini", quantity: formatKg(weights.breads) },
      { name: "Geleias, mel, castanhas e frutas secas", quantity: formatKg(weights.accompaniments) },
      { name: "Vinho", quantity: `${bottles} garrafas` },
      ...team.lines.filter((line) => line.resolvedQuantity > 0).map((line) => ({
        name: line.name,
        quantity: `${line.resolvedQuantity} ${line.resolvedQuantity === 1 ? "pessoa" : "pessoas"}`,
      })),
      ...materials.lines.filter((line) => line.resolvedQuantity > 0).map((line) => ({
        name: line.name,
        quantity: `${line.resolvedQuantity} ${line.resolvedQuantity === 1 ? "peça" : "peças"}`,
      })),
    ],
  };
}

export function buildEventProposal(
  draft: EventBudgetDraft,
  calculation: EventBudgetCalculation,
  clientName = "",
): string {
  const lines = [
    "GRAND CRU RIO — ESTAÇÃO DE QUEIJOS, FRIOS E VINHOS",
    clientName.trim(),
    "",
    `${calculation.participants} convidados · ${calculation.duration} horas · formato ${EVENT_BUDGET_FORMATS[calculation.format].toLowerCase()} · seleção ${EVENT_BUDGET_SELECTIONS[calculation.selection].label}`,
    "",
    "O QUE ESTÁ INCLUÍDO",
    `· Seleção de ${EVENT_BUDGET_SELECTIONS[calculation.selection].cheeses} queijos — ${calculation.weights.cheeses.toFixed(1)} kg`,
    `· ${EVENT_BUDGET_SELECTIONS[calculation.selection].coldCuts} frios e embutidos curados — ${calculation.weights.coldCuts.toFixed(1)} kg`,
    `· Pães artesanais, torradas e grissini — ${calculation.weights.breads.toFixed(1)} kg`,
    `· Geleias, mel, castanhas e frutas secas — ${calculation.weights.accompaniments.toFixed(1)} kg`,
    `· ${calculation.bottles} garrafas de vinho harmonizadas`,
    "· Montagem e desmontagem da estação",
    "",
    "INVESTIMENTO",
    `R$ ${calculation.plannedPrice.toFixed(2)} — R$ ${calculation.pricePerPerson.toFixed(2)} por convidado`,
    "",
    "Proposta válida por 15 dias. Confirmação com 50% de sinal e o restante até a véspera do evento.",
  ];
  return draft.proposalText?.trim() ? draft.proposalText : lines.filter((line, index) => index !== 1 || line).join("\n");
}

export function calculateActualResult(args: {
  participants: number;
  revenue: number;
  costs: Array<{ quantity: string | number; unitValue: string | number }>;
}) {
  const totalCost = args.costs.reduce(
    (sum, cost) => sum + positive(cost.quantity, 1) * positive(cost.unitValue),
    0,
  );
  const participants = Math.max(0, Math.floor(positive(args.participants)));
  const revenue = positive(args.revenue);
  return {
    totalCost,
    costPerParticipant: participants > 0 ? totalCost / participants : 0,
    result: revenue - totalCost,
    marginPercent: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0,
  };
}