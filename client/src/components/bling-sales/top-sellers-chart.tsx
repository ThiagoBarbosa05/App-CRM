import { cn, formatCurrency } from "@/lib/utils";
import type { TopSeller } from "@/hooks/use-bling-orders";
import { ArrowUpRight, Users } from "lucide-react";

interface TopSellersChartProps {
  data?: TopSeller[];
  isLoading: boolean;
}

const SELLER_ROW_STYLES = [
  {
    badgeClass:
      "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800/70 dark:bg-violet-500/15 dark:text-violet-300",
    barClass: "from-violet-700 via-violet-600 to-fuchsia-500",
    glowClass: "bg-violet-500/15",
  },
  {
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-800/60 dark:bg-violet-500/10 dark:text-violet-300",
    barClass: "from-violet-500 via-violet-400 to-fuchsia-400",
    glowClass: "bg-violet-400/10",
  },
  {
    badgeClass:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-800/60 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
    barClass: "from-fuchsia-500 via-violet-400 to-violet-300",
    glowClass: "bg-fuchsia-400/10",
  },
  {
    badgeClass:
      "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    barClass: "from-slate-400 via-violet-300 to-violet-200",
    glowClass: "bg-slate-400/10",
  },
  {
    badgeClass:
      "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    barClass: "from-slate-300 via-violet-200 to-fuchsia-100",
    glowClass: "bg-slate-300/10",
  },
] as const;

function SellersCardSkeleton() {
  return (
    <div className="relative flex-1 min-w-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.08),transparent_40%)]" />
      <div className="relative flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="h-10 w-10 rounded-[18px] bg-violet-100 dark:bg-violet-900/30 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-3 w-44 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
      <div className="relative space-y-3 px-6 pb-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_14px_35px_-32px_rgba(91,33,182,0.45)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/45"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="min-w-0 space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="h-2.5 w-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopSellersChart({ data, isLoading }: TopSellersChartProps) {
  if (isLoading) {
    return <SellersCardSkeleton />;
  }

  const chartData =
    data?.map((item) => ({
      name: item.sellerName || "Nao informado",
      value: Number.parseFloat(item.totalValue),
      orders: item.totalOrders,
    })) || [];

  const maxValue = Math.max(...chartData.map((item) => item.value), 0);

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.08),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/80 to-transparent dark:via-violet-500/30" />

      <div className="relative flex items-start justify-between gap-4 px-6 pt-6 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-violet-100 bg-violet-50/90 shadow-inner dark:border-violet-800/60 dark:bg-violet-900/30">
            <Users className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Top Vendedores
            </h3>
            <p className="mt-1 text-[12px] font-medium text-slate-400 dark:text-slate-500">
              Ranking por valor de vendas
            </p>
          </div>
        </div>

        <div className="rounded-full border border-violet-200/80 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 shadow-sm backdrop-blur-sm dark:border-violet-800/70 dark:bg-slate-900/80 dark:text-violet-300">
          Top 5
        </div>
      </div>

      <div className="relative px-6 pb-6">
        {chartData.length > 0 ? (
          <div className="space-y-3">
            {chartData.map((item, index) => {
              const width =
                maxValue > 0
                  ? Math.max((item.value / maxValue) * 100, 8)
                  : 0;
              const rowStyle =
                SELLER_ROW_STYLES[index % SELLER_ROW_STYLES.length];

              return (
                <div
                  key={`${item.name}-${index}`}
                  className="group relative overflow-hidden rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_35px_-30px_rgba(91,33,182,0.5)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-30px_rgba(91,33,182,0.55)] dark:border-slate-800 dark:bg-slate-950/55"
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-y-0 right-0 w-24 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                      rowStyle.glowClass,
                    )}
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-sm",
                            rowStyle.badgeClass,
                          )}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                            {item.name}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {item.orders} pedido{item.orders === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-violet-700 dark:text-violet-300">
                        {formatCurrency(item.value)}
                      </p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500/80 dark:text-violet-300/70">
                        <ArrowUpRight className="h-3 w-3" />
                        desempenho
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100/90 dark:bg-slate-800/80">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r shadow-[0_0_20px_rgba(124,58,237,0.28)] transition-all duration-700",
                        rowStyle.barClass,
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-slate-200/80 bg-slate-50/70 text-sm font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
            Nenhum dado disponivel
          </div>
        )}
      </div>
    </div>
  );
}
