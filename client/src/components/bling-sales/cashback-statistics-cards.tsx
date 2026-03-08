import { cn, formatCurrency } from "@/lib/utils";
import type { CashbackStatistics } from "@/hooks/use-bling-orders";
import { Gift, Link2, Link2Off, Users } from "lucide-react";

interface CashbackStatisticsCardsProps {
  data?: CashbackStatistics;
  isLoading: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  colorClass,
  bgClass,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {title}
        </p>
        <div
          className={cn(
            "h-9 w-9 rounded-2xl flex items-center justify-center",
            bgClass,
          )}
        >
          <div className={colorClass}>{icon}</div>
        </div>
      </div>
      <p className={cn("text-2xl font-black tracking-tight", colorClass)}>
        {value}
      </p>
      <p className="text-[11px] font-medium text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

export function CashbackStatisticsCards({
  data,
  isLoading,
}: CashbackStatisticsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const linkedPct =
    data && data.totalPFOrders > 0
      ? Math.round((data.linkedOrders / data.totalPFOrders) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Cashback Gerado"
        value={formatCurrency(data?.totalCashbackGenerated ?? 0)}
        subtitle={`${data?.cashbackTransactionCount ?? 0} transação(ões) no período`}
        icon={<Gift className="h-4 w-4" />}
        colorClass="text-amber-600 dark:text-amber-400"
        bgClass="bg-amber-50 dark:bg-amber-900/20"
      />
      <StatCard
        title="Pedidos PF"
        value={String(data?.totalPFOrders ?? 0)}
        subtitle="Pessoa Física no período"
        icon={<Users className="h-4 w-4" />}
        colorClass="text-blue-600 dark:text-blue-400"
        bgClass="bg-blue-50 dark:bg-blue-900/20"
      />
      <StatCard
        title="Vinculados ao App"
        value={`${data?.linkedOrders ?? 0} (${linkedPct}%)`}
        subtitle="PF com cliente encontrado"
        icon={<Link2 className="h-4 w-4" />}
        colorClass="text-emerald-600 dark:text-emerald-400"
        bgClass="bg-emerald-50 dark:bg-emerald-900/20"
      />
      <StatCard
        title="Sem Vínculo"
        value={String(data?.unlinkedOrders ?? 0)}
        subtitle="PF sem cliente no app"
        icon={<Link2Off className="h-4 w-4" />}
        colorClass="text-rose-600 dark:text-rose-400"
        bgClass="bg-rose-50 dark:bg-rose-900/20"
      />
    </div>
  );
}
