import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Store,
  TrendingUp,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Wine,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnifiedTopSellers, useUnifiedSalesComparison, type OrderSource } from "@/hooks/use-unified-orders";
import { useClientReports } from "@/hooks/useReports";
import { SalesEvolutionChart } from "@/components/bling-sales/sales-evolution-chart";
import { TopProductsChart } from "@/components/bling-sales/top-products-chart";
import { TopClientsCard } from "@/components/bling-sales/top-clients-card";
import { getBottleGoalProgress } from "@/pages/seller-dashboard-goals";
import {
  type DashboardData,
  type UserGoal,
  type ClientPortfolioStats,
  KpiCard,
  PortfolioKpiCard,
  GoalMetricCard,
  ClientRow,
  SectionCard,
  EmptyState,
  pct,
  getGoalMetricTone,
  namesMatch,
} from "./shared";

// ─── Bloco de Progresso da Meta ───────────────────────────────────────────────

function GoalProgressBlock({ userId, source = "all" }: { userId: string; source?: OrderSource }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: goals = [] } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${month}/${year}`],
  });

  const { data: topSellers = [], isLoading: isTopSellersLoading } =
    useUnifiedTopSellers(monthStart, monthEnd, 100, source);

  const goal = useMemo(
    () => goals.find((g) => g.userId === userId),
    [goals, userId],
  );

  const realSalesData = useMemo(() => {
    if (!goal || !topSellers.length) return null;
    return (
      topSellers.find((s) => namesMatch(s.sellerName, goal.userName)) ?? null
    );
  }, [goal, topSellers]);

  if (!goal) {
    return (
      <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
        <CardContent className="py-10 text-center text-sm text-slate-400">
          Nenhuma meta cadastrada para este mês.
        </CardContent>
      </Card>
    );
  }

  const results = goal.weeklyResults ?? [];
  const monthlyResult = results[0] ?? null;
  const salesAchieved = monthlyResult ? Number(monthlyResult.salesAchieved) : 0;

  const realValue = realSalesData?.totalValue ?? 0;
  const realOrders = realSalesData?.totalOrders ?? 0;
  const realItems = realSalesData?.totalItems ?? 0;
  const bottleGoalProgress = getBottleGoalProgress(
    { totalItems: realItems, totalOrders: realOrders },
    goal.ordersGoal ?? 0,
  );
  const realAvgTicket = realOrders > 0 ? realValue / realOrders : 0;
  const realAvgBottle = realItems > 0 ? realValue / realItems : 0;
  const salesGoalNum = Number(goal.salesGoal);
  const realPct =
    salesGoalNum > 0 ? Math.min((realValue / salesGoalNum) * 100, 100) : 0;
  const overallTone = getGoalMetricTone(realPct);
  const realPctColor =
    realPct >= 100
      ? "bg-emerald-500"
      : realPct >= 50
        ? "bg-amber-400"
        : "bg-red-500";
  const realTextColor =
    realPct >= 100
      ? "text-emerald-600 dark:text-emerald-400"
      : realPct >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
      <CardHeader className="pb-4 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Progresso da Meta —{" "}
              {format(now, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) =>
                c.toUpperCase(),
              )}
            </CardTitle>
          </div>
          <Badge
            variant="secondary"
            className={`text-xs font-bold ${monthlyResult ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
          >
            {monthlyResult ? "✓ REGISTRADO" : "PENDENTE"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Vendas Reais no Mês */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Painel de Performance
              </span>
              <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                Vendas Reais no Mês
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Bling
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${overallTone.badgeClass}`}
              >
                {overallTone.badge}
              </span>
            </div>
          </div>
          {isTopSellersLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-7 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p
                    className={`text-3xl font-black tabular-nums tracking-tight ${realTextColor}`}
                  >
                    {formatCurrency(realValue)}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    {realOrders} pedido{realOrders !== 1 ? "s" : ""} · ticket
                    médio {formatCurrency(realAvgTicket)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:min-w-[220px]">
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Meta
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-700 dark:text-slate-200">
                      {formatCurrency(salesGoalNum)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Progresso
                    </p>
                    <p
                      className={`mt-1 text-lg font-black tabular-nums ${realTextColor}`}
                    >
                      {realPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Volume vendido</span>
                  <p className={`font-black tabular-nums ${realTextColor}`}>
                    {formatCurrency(realValue)} / {formatCurrency(salesGoalNum)}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${realPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${realPctColor}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {realItems}
                  </span>{" "}
                  garrafa{realItems !== 1 ? "s" : ""} vendida
                  {realItems !== 1 ? "s" : ""}
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-right text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {formatCurrency(realAvgBottle)}
                  </span>{" "}
                  por garrafa
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <GoalMetricCard
            label="Meta de Vendas (mensal)"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            achieved={formatCurrency(salesAchieved)}
            goal={formatCurrency(goal.salesGoal)}
            percentage={pct(salesAchieved, Number(goal.salesGoal))}
            colorClass="bg-emerald-500"
            bgClass="bg-emerald-50 dark:bg-emerald-900/20"
            textClass="text-emerald-600 dark:text-emerald-400"
          />
          <GoalMetricCard
            label="Total de GRFs no Mês"
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            achieved={`${bottleGoalProgress.achieved} GRF${bottleGoalProgress.achieved !== 1 ? "s" : ""}`}
            goal={`${bottleGoalProgress.goal} GRF${bottleGoalProgress.goal !== 1 ? "s" : ""}`}
            percentage={bottleGoalProgress.percentage}
            colorClass="bg-indigo-500"
            bgClass="bg-indigo-50 dark:bg-indigo-900/20"
            textClass="text-indigo-600 dark:text-indigo-400"
          />
          <GoalMetricCard
            label="Ticket Médio"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            achieved={formatCurrency(realAvgTicket)}
            goal={formatCurrency(goal.averageTicket)}
            percentage={pct(realAvgTicket, Number(goal.averageTicket))}
            colorClass="bg-blue-500"
            bgClass="bg-blue-50 dark:bg-blue-900/20"
            textClass="text-blue-600 dark:text-blue-400"
          />
          <GoalMetricCard
            label="Valor Médio por Garrafa"
            icon={<Wine className="h-3.5 w-3.5" />}
            achieved={realItems > 0 ? formatCurrency(realAvgBottle) : "—"}
            goal={formatCurrency(goal.avgBottleValueGoal ?? "0")}
            percentage={pct(
              realAvgBottle,
              Number(goal.avgBottleValueGoal ?? "0"),
            )}
            colorClass="bg-rose-500"
            bgClass="bg-rose-50 dark:bg-rose-900/20"
            textClass="text-rose-600 dark:text-rose-400"
          />
          {/* Positivação da Carteira — bloco dedicado ocupa linha inteira */}
          {(() => {
            const posAchieved = goal.positivityAchieved ?? 0;
            const posGoal = goal.positivityGoal ?? 0;
            const posTotal = goal.positivityTotal ?? 0;
            const posActive = Math.round((posAchieved / 100) * posTotal);
            const posPct = pct(posAchieved, posGoal);
            const posTone = getGoalMetricTone(posPct);
            const barColor =
              posPct >= 100
                ? "bg-emerald-500"
                : posPct >= 70
                  ? "bg-amber-400"
                  : "bg-violet-500";
            const textColor =
              posPct >= 100
                ? "text-emerald-600 dark:text-emerald-400"
                : posPct >= 70
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-violet-600 dark:text-violet-400";

            return (
              <div
                className={`md:col-span-2 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm ring-1 ${posTone.ringClass}`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Positivação da Carteira
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Clientes da carteira com compra no mês
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${posTone.badgeClass}`}
                  >
                    {posTone.badge}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-4 mb-3">
                  <div>
                    <p
                      className={`text-3xl font-black tabular-nums leading-none ${textColor}`}
                    >
                      {posAchieved.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {posTotal > 0
                        ? `${posActive} de ${posTotal} clientes ativos`
                        : "Sem clientes na carteira"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Meta
                    </p>
                    <p className="text-lg font-black text-slate-700 dark:text-slate-200">
                      {posGoal}%
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(posPct, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${barColor}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-medium text-slate-400">
                    <span>0%</span>
                    <span className={`font-black ${textColor}`}>
                      {posPct.toFixed(1)}% da meta
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 px-4 py-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <span>Resumo do Mês</span>
            <span
              className={monthlyResult ? "text-emerald-500" : "text-slate-400"}
            >
              {monthlyResult ? "Registrado" : "Pendente"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Melhor avanço
              </p>
              <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">
                {realPct >= 100
                  ? "Meta mensal concluida"
                  : "Meta mensal em andamento"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Fonte
              </p>
              <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">
                Dados sincronizados do Bling
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── View de vendedor individual ──────────────────────────────────────────────

export function IndividualSellerView({
  sellerId,
  isOwnView,
  startDate,
  endDate,
  prevStartDate,
  prevEndDate,
}: {
  sellerId: string;
  isOwnView: boolean;
  startDate: string;
  endDate: string;
  prevStartDate?: string;
  prevEndDate?: string;
}) {
  const [source, setSource] = useState<OrderSource>("all");

  const queryUrl = `/api/users/${sellerId}/seller-dashboard?startDate=${startDate}&endDate=${endDate}${prevStartDate ? `&prevStartDate=${prevStartDate}` : ""}${prevEndDate ? `&prevEndDate=${prevEndDate}` : ""}`;
  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: [queryUrl],
    enabled: !!sellerId,
  });
  useClientReports();

  const topClients = data?.topClients ?? [];
  const highestAvgTicket = data?.highestAvgTicket ?? [];
  const highestAvgItemValue = data?.highestAvgItemValue ?? [];
  const inactiveClients = data?.inactiveClients ?? [];
  const newClientsThisMonth = (data?.newClientsThisMonth ?? []).slice(0, 18);
  const salesEvolution = data?.salesEvolution ?? [];
  const topProducts = data?.topProducts ?? [];
  const groupBy = useMemo(() => {
    if (!startDate || !endDate) return "day" as const;
    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days > 90) return "month" as const;
    if (days > 30) return "week" as const;
    return "day" as const;
  }, [startDate, endDate]);
  const portfolioStats = data?.portfolioStats ?? {
    total: 0,
    active: 0,
    inactive: 0,
    positivacao: 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card
              key={i}
              className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-4 w-full">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-24" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-0 divide-y divide-slate-50 dark:divide-slate-800">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        Erro ao carregar dados: {String(error)}
      </div>
    );
  }

  const ms = data?.monthlySummary ?? {
    totalValue: 0,
    totalOrders: 0,
    avgTicket: 0,
    uniqueClients: 0,
    avgItemValue: 0,
  };
  const pms = data?.prevMonthSummary ?? {
    totalValue: 0,
    totalOrders: 0,
    avgTicket: 0,
    uniqueClients: 0,
    avgItemValue: 0,
  };

  // Mesmo período no ano anterior
  const lastYearStart = startDate ? startDate.replace(/^(\d{4})/, (_, y) => String(parseInt(y) - 1)) : "";
  const lastYearEnd = endDate ? endDate.replace(/^(\d{4})/, (_, y) => String(parseInt(y) - 1)) : "";
  const { data: lastYearComparison } = useUnifiedSalesComparison(lastYearStart, lastYearEnd, source);
  const lastYearStats = lastYearComparison?.current ?? { totalValue: 0, totalOrders: 0, averageValue: 0, totalItems: 0, avgBottleValue: 0 };
  const lastYearLabel = startDate ? `Mesmo período ${parseInt(startDate.slice(0, 4)) - 1}` : "Ano anterior";
  return (
    <div className="space-y-6">
      {/* Filtro de Origem */}
      <div className="flex items-center gap-3">
        <Store className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origem</span>
        <Select value={source} onValueChange={(val) => setSource(val as OrderSource)}>
          <SelectTrigger className="w-40 h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
            <SelectItem value="all" className="rounded-xl font-bold">Todos</SelectItem>
            <SelectItem value="bling" className="rounded-xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-black">B</span>
                Bling
              </div>
            </SelectItem>
            <SelectItem value="connect" className="rounded-xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 text-[9px] font-black">C</span>
                Connect
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total Vendido"
          value={formatCurrency(ms.totalValue)}
          subValue={`vs período anterior: ${formatCurrency(pms.totalValue)}`}
          subValue2={`${lastYearLabel}: ${formatCurrency(lastYearStats.totalValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          current={ms.totalValue}
          previous={pms.totalValue}
        />
        <KpiCard
          label="Pedidos"
          value={String(ms.totalOrders)}
          subValue={`vs período anterior: ${pms.totalOrders}`}
          subValue2={`${lastYearLabel}: ${lastYearStats.totalOrders}`}
          icon={<ShoppingCart className="h-4 w-4" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
          current={ms.totalOrders}
          previous={pms.totalOrders}
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(ms.avgTicket)}
          subValue={`vs período anterior: ${formatCurrency(pms.avgTicket)}`}
          subValue2={`${lastYearLabel}: ${formatCurrency(lastYearStats.averageValue)}`}
          icon={<BarChart3 className="h-4 w-4" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-600 dark:text-amber-400"
          current={ms.avgTicket}
          previous={pms.avgTicket}
        />
        <KpiCard
          label="Preço Médio da GRF"
          value={formatCurrency(ms.avgItemValue ?? 0)}
          subValue={`vs período anterior: ${formatCurrency(pms.avgItemValue ?? 0)}`}
          subValue2={`${lastYearLabel}: ${formatCurrency(lastYearStats.avgBottleValue)}`}
          icon={<Wine className="h-4 w-4" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          current={ms.avgItemValue ?? 0}
          previous={pms.avgItemValue ?? 0}
        />
        <KpiCard
          label="Total de Clientes"
          value={String(portfolioStats.total)}
          subValue={`${portfolioStats.active} ativos · ${portfolioStats.inactive} inativos`}
          icon={<UserPlus className="h-4 w-4" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600 dark:text-slate-400"
          current={0}
          previous={0}
        />
        <PortfolioKpiCard stats={portfolioStats} />
      </div>

      {/* Progresso da Meta */}
      <GoalProgressBlock userId={sellerId} source={source} />

      {/* Gráfico de Evolução */}
      <SalesEvolutionChart
        data={salesEvolution}
        isLoading={isLoading}
        groupBy={groupBy}
      />

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopClientsCard
          data={topClients}
          isLoading={isLoading}
          title="Top Clientes"
        />

        <SectionCard
          title="Maior Ticket Médio"
          icon={
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          }
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          count={highestAvgTicket.length}
        >
          {!highestAvgTicket.length ? (
            <EmptyState message="Nenhuma venda registrada." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {highestAvgTicket.map((c, i) => (
                <ClientRow
                  key={c.clientId ?? i}
                  rank={i + 1}
                  clientId={c.clientId}
                  name={c.clientName}
                  secondary={`${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""}`}
                  badge={formatCurrency(c.avgTicket)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <TopProductsChart
          data={topProducts.map((p) => ({
            description: p.description,
            totalQuantity: String(p.totalQuantity),
            totalValue: String(p.totalValue),
            orderCount: p.orderCount,
            productCode: p.productCode,
          }))}
          isLoading={isLoading}
        />

        <SectionCard
          title="Maior Valor de Item Médio"
          icon={
            <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          }
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          count={highestAvgItemValue.length}
        >
          {!highestAvgItemValue.length ? (
            <EmptyState message="Sem dados de itens Bling." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {highestAvgItemValue.map((c, i) => (
                <ClientRow
                  key={c.clientId ?? i}
                  rank={i + 1}
                  clientId={c.clientId}
                  name={c.clientName}
                  secondary={`${c.itemCount} iten${c.itemCount !== 1 ? "s" : ""}`}
                  badge={formatCurrency(c.avgItemValue)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Clientes Inativos */}
      {isOwnView && (
        <SectionCard
          title="Clientes Inativos"
          icon={
            <UserMinus className="h-4 w-4 text-red-500 dark:text-red-400" />
          }
          iconBg="bg-red-50 dark:bg-red-900/20"
          count={inactiveClients.length}
        >
          {!inactiveClients.length ? (
            <EmptyState message="Nenhum cliente inativo." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {inactiveClients.slice(0, 20).map((c, i) => (
                <ClientRow
                  key={c.clientId}
                  rank={i + 1}
                  clientId={c.clientId}
                  name={c.clientName}
                  secondary={
                    c.lastPurchaseDate
                      ? `Última compra: ${format(parseISO(c.lastPurchaseDate), "dd/MM/yyyy")}`
                      : "Sem compras registradas"
                  }
                  badge={
                    c.daysSincePurchase != null
                      ? `${c.daysSincePurchase}d`
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Últimos Clientes Cadastrados */}
      {isOwnView && (
        <SectionCard
          title="Últimos Clientes Cadastrados"
          icon={
            <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          }
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          count={newClientsThisMonth.length}
        >
          {!newClientsThisMonth.length ? (
            <EmptyState message="Nenhum cliente cadastrado." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {newClientsThisMonth.map((c, i) => (
                <ClientRow
                  key={c.clientId}
                  rank={i + 1}
                  clientId={c.clientId}
                  name={c.clientName}
                  secondary={format(
                    parseISO(c.createdAt),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR },
                  )}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
