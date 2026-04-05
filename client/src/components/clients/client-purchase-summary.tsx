import {
  Calendar,
  ClipboardList,
  Tag,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";

interface ClientPurchaseSummaryProps {
  summary: ClientPurchaseInsightsResponse["summary"];
  daysSinceLastPurchase: number | null;
}

function formatDateLabel(date: string | null): string {
  if (!date) return "\u2014";
  try {
    return format(parseISO(`${date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

export function ClientPurchaseSummary({
  summary,
  daysSinceLastPurchase,
}: ClientPurchaseSummaryProps) {
  const cards: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    subtitle: string;
  }> = [
    {
      label: "Total comprado",
      icon: ShoppingBag,
      value: formatCurrency(summary.totalPurchased),
      subtitle: `${summary.purchaseCount} pedido(s)`,
    },
    {
      label: "Pedidos",
      icon: ClipboardList,
      value: `${summary.purchaseCount}`,
      subtitle: `Frequencia: ${summary.monthlyFrequency}/mes`,
    },
    {
      label: "Ticket medio",
      icon: Tag,
      value: formatCurrency(summary.averageTicket),
      subtitle: `Historico: ${formatCurrency(summary.totalPurchased)}`,
    },
    {
      label: "Frequencia media",
      icon: RefreshCw,
      value:
        summary.averageDaysBetweenPurchases === null
          ? "\u2014"
          : `${summary.averageDaysBetweenPurchases} dias`,
      subtitle: "Intervalo medio entre pedidos",
    },
    {
      label: "Ultima compra",
      icon: Calendar,
      value: formatDateLabel(summary.lastPurchaseDate),
      subtitle:
        daysSinceLastPurchase === null
          ? "Sem base"
          : `Ha ${daysSinceLastPurchase} dias`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900"
        >
          {/* Left gradient accent */}
          <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500" />

          {/* Subtle bg shimmer on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 to-amber-50/0 transition-all duration-300 group-hover:from-amber-50/60 group-hover:to-transparent dark:group-hover:from-amber-900/10 dark:group-hover:to-transparent" />

          <div className="relative flex items-start justify-between pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {card.label}
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 ring-1 ring-amber-200/60 dark:from-amber-900/30 dark:to-amber-800/20 dark:ring-amber-700/30">
              <card.icon className="h-4 w-4 text-amber-500" />
            </div>
          </div>

          <p className="relative mt-3 pl-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white xl:text-2xl">
            {card.value}
          </p>

          <p className="relative mt-1 pl-3 text-xs font-medium text-amber-600/80 dark:text-amber-400/80">
            {card.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}
