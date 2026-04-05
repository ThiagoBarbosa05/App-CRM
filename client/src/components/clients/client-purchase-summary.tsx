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
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Left accent border */}
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-amber-400" />

          <div className="flex items-start justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {card.label}
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <card.icon className="h-4 w-4 text-amber-500" />
            </div>
          </div>

          <p className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white xl:text-2xl">
            {card.value}
          </p>

          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            {card.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}
