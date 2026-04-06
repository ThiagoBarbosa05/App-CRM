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
          className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_35px_-35px_rgba(15,23,42,0.38)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-35px_rgba(15,23,42,0.42)] dark:border-slate-800/80 dark:bg-slate-900"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_34%)] opacity-80" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent dark:via-amber-500/30" />

          <div className="relative flex items-start justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {card.label}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/70 ring-1 ring-amber-200/60 dark:from-amber-900/30 dark:to-amber-800/20 dark:ring-amber-700/30">
              <card.icon className="h-4 w-4 text-amber-500" />
            </div>
          </div>

          <p className="relative mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white xl:text-[1.75rem]">
            {card.value}
          </p>

          <p className="relative mt-1 text-xs font-medium text-amber-600/80 dark:text-amber-400/80">
            {card.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}
