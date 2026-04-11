import { cn, formatCurrency } from "@/lib/utils";
import { ArrowUpRight, Trophy, Users } from "lucide-react";
import { Link } from "wouter";

interface TopClient {
  clientId?: string | null;
  clientName: string;
  totalValue: number;
  orderCount: number;
}

interface TopClientsCardProps {
  data?: TopClient[];
  isLoading: boolean;
  title?: string;
  subtitle?: string;
}

const CLIENT_ROW_STYLES = [
  {
    badgeClass:
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800/70 dark:bg-amber-500/15 dark:text-amber-300",
    barClass: "from-amber-500 via-orange-400 to-yellow-300",
    glowClass: "bg-amber-500/15",
  },
  {
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-300",
    barClass: "from-amber-400 via-orange-300 to-yellow-200",
    glowClass: "bg-orange-400/12",
  },
  {
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-500/10 dark:text-orange-300",
    barClass: "from-orange-400 via-amber-300 to-yellow-200",
    glowClass: "bg-orange-400/10",
  },
  {
    badgeClass:
      "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    barClass: "from-slate-400 via-stone-300 to-amber-200",
    glowClass: "bg-slate-300/10",
  },
  {
    badgeClass:
      "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    barClass: "from-slate-300 via-stone-200 to-amber-100",
    glowClass: "bg-slate-300/10",
  },
] as const;

function ClientsCardSkeleton() {
  return (
    <div className="relative flex-1 min-w-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_38%)]" />
      <div className="relative flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="h-10 w-10 rounded-[18px] bg-amber-100 dark:bg-amber-900/30 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
      <div className="relative space-y-3 px-6 pb-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_14px_35px_-32px_rgba(245,158,11,0.4)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/45"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="min-w-0 space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
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

export function TopClientsCard({ data, isLoading, title = "Top Clientes", subtitle = "Ranking de clientes por valor" }: TopClientsCardProps) {
  if (isLoading) {
    return <ClientsCardSkeleton />;
  }

  const chartData = data?.slice(0, 10).map((item) => ({
    clientId: item.clientId,
    name: item.clientName || "Desconhecido",
    value: Number(item.totalValue),
    quantity: item.orderCount,
  })) || [];

  const maxValue = Math.max(...chartData.map((item) => item.value), 0);

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent dark:via-amber-500/30" />

      <div className="relative flex items-start justify-between gap-4 px-6 pt-6 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-amber-100 bg-amber-50/90 shadow-inner dark:border-amber-800/60 dark:bg-amber-900/30">
            <Trophy className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              {title}
            </h3>
            <p className="mt-1 text-[12px] font-medium text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 shadow-sm backdrop-blur-sm dark:border-amber-800/70 dark:bg-slate-900/80 dark:text-amber-300">
          Top {Math.min(chartData.length || 0, 10)}
        </div>
      </div>

      <div className="relative px-6 pb-6">
        {chartData.length > 0 ? (
          <div className="space-y-3">
            {chartData.map((item, index) => {
              const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 0;
              const rowStyle = CLIENT_ROW_STYLES[index % CLIENT_ROW_STYLES.length];
              const InnerContent = (
                <>
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
                          #{index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                            {item.name}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {item.quantity} ped.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-amber-700 dark:text-amber-300">
                        {formatCurrency(item.value)}
                      </p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/80 dark:text-amber-300/70">
                        <ArrowUpRight className="h-3 w-3" />
                        receita
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100/90 dark:bg-slate-800/80">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r shadow-[0_0_20px_rgba(245,158,11,0.28)] transition-all duration-700",
                        rowStyle.barClass,
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </>
              );

              return item.clientId ? (
                <Link key={`${item.clientId}-${index}`} href={`/clientes/${item.clientId}`}>
                  <a className="block group relative overflow-hidden rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_35px_-30px_rgba(245,158,11,0.45)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-30px_rgba(245,158,11,0.5)] dark:border-slate-800 dark:bg-slate-950/55">
                    {InnerContent}
                  </a>
                </Link>
              ) : (
                <div
                  key={`${item.name}-${index}`}
                  className="group relative overflow-hidden rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_35px_-30px_rgba(245,158,11,0.45)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-30px_rgba(245,158,11,0.5)] dark:border-slate-800 dark:bg-slate-950/55"
                >
                  {InnerContent}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-slate-200/80 bg-slate-50/70 text-sm font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
            Nenhum cliente registrado
          </div>
        )}
      </div>
    </div>
  );
}