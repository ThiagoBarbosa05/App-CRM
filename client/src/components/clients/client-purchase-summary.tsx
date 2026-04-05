import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";

interface ClientPurchaseSummaryProps {
  summary: ClientPurchaseInsightsResponse["summary"];
}

const summaryCards = [
  {
    key: "totalPurchased",
    label: "Total comprado",
    format: (value: ClientPurchaseInsightsResponse["summary"]) =>
      formatCurrency(value.totalPurchased),
  },
  {
    key: "purchaseCount",
    label: "Compras realizadas",
    format: (value: ClientPurchaseInsightsResponse["summary"]) =>
      `${value.purchaseCount}`,
  },
  {
    key: "averageTicket",
    label: "Ticket medio",
    format: (value: ClientPurchaseInsightsResponse["summary"]) =>
      formatCurrency(value.averageTicket),
  },
  {
    key: "monthlyFrequency",
    label: "Frequencia mensal",
    format: (value: ClientPurchaseInsightsResponse["summary"]) =>
      `${value.monthlyFrequency} compras/mes`,
  },
  {
    key: "averageDaysBetweenPurchases",
    label: "Intervalo medio",
    format: (value: ClientPurchaseInsightsResponse["summary"]) =>
      value.averageDaysBetweenPurchases === null
        ? "Sem base"
        : `${value.averageDaysBetweenPurchases} dias`,
  },
  {
    key: "activeMonths",
    label: "Meses ativos (12m)",
    format: (value: ClientPurchaseInsightsResponse["summary"]) =>
      `${value.activeMonthsLast12}`,
  },
] as const;

export function ClientPurchaseSummary({ summary }: ClientPurchaseSummaryProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {summaryCards.map((card) => (
        <Card
          key={card.key}
          className="overflow-hidden rounded-[1.4rem] border-slate-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900"
        >
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-lg font-black tracking-tight text-slate-950 dark:text-white xl:text-[1.35rem]">
              {card.format(summary)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
