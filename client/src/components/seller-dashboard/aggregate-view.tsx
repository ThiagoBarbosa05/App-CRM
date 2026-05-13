import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BarChart3,
  ShoppingCart,
  Store,
  TrendingUp,
  Trophy,
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
import {
  useUnifiedTopSellers,
  useUnifiedSalesComparison,
  useUnifiedSalesEvolution,
  type OrderSource,
} from "@/hooks/use-unified-orders";
import { useClientReports, useGeneralReports } from "@/hooks/useReports";
import { ReportsStatistics } from "@/components/reports/reports-statistics";
import { SalesEvolutionChart } from "@/components/bling-sales/sales-evolution-chart";
import { TopProductsChart } from "@/components/bling-sales/top-products-chart";
import { TopClientsCard } from "@/components/bling-sales/top-clients-card";
import { getBottleGoalProgress } from "@/pages/seller-dashboard-goals";
import {
  type AggregateDashboardData,
  type UserGoal,
  type SellerPortfolioStats,
  type SellerRankingRow,
  KpiCard,
  ClientRow,
  SectionCard,
  EmptyState,
  pct,
  namesMatch,
} from "./shared";

// ─── Progresso de metas de todos os vendedores (admin) ───────────────────────

function AllSellersGoalProgress({
  sellerPortfolioStats,
  source = "all",
}: {
  sellerPortfolioStats: SellerPortfolioStats[];
  source?: OrderSource;
}) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: goals = [], isLoading: goalsLoading } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${month}/${year}`],
  });

  const { data: topSellers = [], isLoading: sellersLoading } =
    useUnifiedTopSellers(monthStart, monthEnd, 100, source);

  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR }).replace(
    /^\w/,
    (c) => c.toUpperCase(),
  );
  const isLoading = goalsLoading || sellersLoading;

  const enrichedGoals = useMemo(() => {
    return goals
      .map((goal) => {
        const realData =
          topSellers.find((s) => namesMatch(s.sellerName, goal.userName)) ??
          null;
        const realValue = realData?.totalValue ?? 0;
        const realOrders = realData?.totalOrders ?? 0;
        const realItems = realData?.totalItems ?? 0;
        const bottleGoalProgress = getBottleGoalProgress(
          { totalItems: realItems, totalOrders: realOrders },
          goal.ordersGoal ?? 0,
        );
        const realAvgTicket = realOrders > 0 ? realValue / realOrders : 0;
        const realAvgBottle = realItems > 0 ? realValue / realItems : 0;
        const salesGoalNum = Number(goal.salesGoal);
        const salesPct =
          salesGoalNum > 0
            ? Math.min((realValue / salesGoalNum) * 100, 100)
            : 0;
        const ticketPct = pct(realAvgTicket, Number(goal.averageTicket));
        const ordersPct = bottleGoalProgress.percentage;
        const avgBottlePct = pct(
          realAvgBottle,
          Number(goal.avgBottleValueGoal ?? "0"),
        );
        const monthlyResult = goal.weeklyResults?.[0] ?? null;
        const portfolio =
          sellerPortfolioStats.find((s) => s.userId === goal.userId) ?? null;
        return {
          goal,
          realValue,
          realOrders,
          realItems,
          bottleGoalProgress,
          realAvgTicket,
          realAvgBottle,
          salesPct,
          ticketPct,
          ordersPct,
          avgBottlePct,
          monthlyResult,
          portfolio,
        };
      })
      .sort((a, b) => b.salesPct - a.salesPct);
  }, [goals, topSellers, sellerPortfolioStats]);

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
      <CardHeader className="pb-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Metas dos Vendedores — {monthLabel}
            </CardTitle>
          </div>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs font-bold">
              {goals.length} vendedor{goals.length !== 1 ? "es" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4 px-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-200 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : !enrichedGoals.length ? (
          <EmptyState message="Nenhuma meta cadastrada para este mês." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrichedGoals.map(
              ({
                goal,
                realValue,
                realOrders,
                realItems,
                bottleGoalProgress,
                realAvgTicket,
                realAvgBottle,
                salesPct,
                ticketPct,
                ordersPct,
                avgBottlePct,
                monthlyResult,
                portfolio,
              }) => {
                const salesColor =
                  salesPct >= 100
                    ? "bg-emerald-500"
                    : salesPct >= 50
                      ? "bg-amber-400"
                      : "bg-red-500";
                const salesTextColor =
                  salesPct >= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : salesPct >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400";

                return (
                  <div
                    key={goal.id}
                    className="rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {goal.userName}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-bold shrink-0 ${monthlyResult ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                      >
                        {monthlyResult ? "✓ REG." : "PEND."}
                      </Badge>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p
                          className={`text-lg font-black tabular-nums leading-tight ${salesTextColor}`}
                        >
                          {formatCurrency(realValue)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {realOrders} ped. · {formatCurrency(realAvgTicket)}{" "}
                          ticket
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black ${salesTextColor}`}>
                          {salesPct.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-slate-400">
                          de {formatCurrency(Number(goal.salesGoal))}
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${salesPct}%` }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className={`h-full rounded-full ${salesColor}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        <span>
                          GRFs — {bottleGoalProgress.achieved}/
                          {bottleGoalProgress.goal}
                        </span>
                        <span className="font-bold">
                          {ordersPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${ordersPct}%` }}
                          transition={{
                            duration: 0.9,
                            ease: "easeOut",
                            delay: 0.1,
                          }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        <span>
                          Ticket Médio — {formatCurrency(realAvgTicket)}
                        </span>
                        <span className="font-bold">
                          {ticketPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${ticketPct}%` }}
                          transition={{
                            duration: 0.9,
                            ease: "easeOut",
                            delay: 0.2,
                          }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Wine className="h-3 w-3 text-rose-500 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                            Valor Médio / Garrafa
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-black shrink-0 ${avgBottlePct >= 100 ? "text-emerald-600 dark:text-emerald-400" : avgBottlePct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}
                        >
                          {avgBottlePct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                          {realItems > 0 ? formatCurrency(realAvgBottle) : "—"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          meta {formatCurrency(goal.avgBottleValueGoal ?? "0")}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(avgBottlePct, 100)}%` }}
                          transition={{
                            duration: 0.9,
                            ease: "easeOut",
                            delay: 0.3,
                          }}
                          className={`h-full rounded-full ${avgBottlePct >= 100 ? "bg-emerald-500" : avgBottlePct >= 50 ? "bg-amber-400" : "bg-rose-500"}`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {realItems > 0
                          ? `${realItems} garrafa${realItems !== 1 ? "s" : ""} vendida${realItems !== 1 ? "s" : ""}`
                          : "Sem garrafas no período"}
                      </p>
                    </div>

                    {portfolio && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          <span>Carteira: {portfolio.total} clientes</span>
                          <span
                            className={`font-bold ${portfolio.positivacao >= 70 ? "text-emerald-600 dark:text-emerald-400" : portfolio.positivacao >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            Positivação- {portfolio.positivacao.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(portfolio.positivacao, 100)}%`,
                            }}
                            transition={{
                              duration: 0.9,
                              ease: "easeOut",
                              delay: 0.4,
                            }}
                            className={`h-full rounded-full ${portfolio.positivacao >= 70 ? "bg-emerald-500" : portfolio.positivacao >= 40 ? "bg-amber-400" : "bg-red-500"}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Ranking de Vendedores (admin) ────────────────────────────────────────────

function SellerRankingCard({ sellers }: { sellers: SellerRankingRow[] }) {
  const maxValue = useMemo(
    () => Math.max(...sellers.map((s) => s.totalValue), 1),
    [sellers],
  );

  const medalColors = ["text-amber-500", "text-slate-400", "text-amber-700"];

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 md:col-span-2">
      <CardHeader className="pb-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Ranking de Vendedores — Mês Atual
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs font-bold">
            {sellers.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4 px-4">
        {!sellers.length ? (
          <EmptyState message="Nenhuma venda registrada neste mês." />
        ) : (
          <div className="space-y-2">
            {sellers.map((s, i) => {
              const barPct = (s.totalValue / maxValue) * 100;
              return (
                <div key={s.sellerId} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center text-sm font-black shrink-0 ${medalColors[i] ?? "text-slate-400"}`}
                    >
                      {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {s.sellerName}
                        </p>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-slate-400">
                            {s.totalOrders} ped. · ticket{" "}
                            {formatCurrency(s.avgTicket)}
                          </span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(s.totalValue)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{
                            duration: 0.8,
                            ease: "easeOut",
                            delay: i * 0.05,
                          }}
                          className="h-full bg-amber-400 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── View agregada (admin — todos os vendedores) ──────────────────────────────

export function AggregateView({
  startDate,
  endDate,
  prevStartDate,
  prevEndDate,
}: {
  startDate: string;
  endDate: string;
  prevStartDate?: string;
  prevEndDate?: string;
}) {
  const [source, setSource] = useState<OrderSource>("all");

  const qs = `startDate=${startDate}&endDate=${endDate}${prevStartDate ? `&prevStartDate=${prevStartDate}` : ""}${prevEndDate ? `&prevEndDate=${prevEndDate}` : ""}`;

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<
    Pick<AggregateDashboardData, "monthlySummary" | "prevMonthSummary">
  >({ queryKey: [`/api/users/seller-dashboard/aggregate/summary?${qs}`] });

  const { data: rankingData, isLoading: isRankingLoading } = useQuery<
    Pick<AggregateDashboardData, "sellerRanking">
  >({ queryKey: [`/api/users/seller-dashboard/aggregate/seller-ranking?${qs}`] });

  const { data: topProductsData, isLoading: isTopProductsLoading } = useQuery<
    Pick<AggregateDashboardData, "topProducts">
  >({ queryKey: [`/api/users/seller-dashboard/aggregate/top-products?${qs}`] });

  const { data: topClientsData, isLoading: isTopClientsLoading } = useQuery<
    Pick<AggregateDashboardData, "topClients">
  >({ queryKey: [`/api/users/seller-dashboard/aggregate/top-clients?${qs}`] });

  const { data: portfolioData } = useQuery<
    Pick<AggregateDashboardData, "sellerPortfolioStats">
  >({ queryKey: [`/api/users/seller-dashboard/aggregate/portfolio`] });

  const { data: clientReports } = useClientReports();
  const { data: generalReports } = useGeneralReports();

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

  // Hooks unificados para KPIs e gráfico filtráveis por origem
  const { data: salesComparison, isLoading: isComparisonLoading } =
    useUnifiedSalesComparison(startDate, endDate, source, prevStartDate, prevEndDate);
  const { data: unifiedEvolution = [], isLoading: isEvolutionLoading } =
    useUnifiedSalesEvolution(startDate, endDate, groupBy, source);

  // Mesmo período no ano anterior
  const lastYearStart = startDate ? startDate.replace(/^(\d{4})/, (_, y) => String(parseInt(y) - 1)) : "";
  const lastYearEnd = endDate ? endDate.replace(/^(\d{4})/, (_, y) => String(parseInt(y) - 1)) : "";
  const { data: lastYearComparison } = useUnifiedSalesComparison(lastYearStart, lastYearEnd, source);
  const lastYearStats = lastYearComparison?.current ?? { totalValue: 0, totalOrders: 0, averageValue: 0, totalItems: 0, avgBottleValue: 0 };
  const lastYearLabel = startDate ? `Mesmo período ${parseInt(startDate.slice(0, 4)) - 1}` : "Ano anterior";

  const currentStats = salesComparison?.current ?? { totalValue: 0, totalOrders: 0, averageValue: 0, totalItems: 0, avgBottleValue: 0 };
  const previousStats = salesComparison?.previous ?? { totalValue: 0, totalOrders: 0, averageValue: 0, totalItems: 0, avgBottleValue: 0 };

  const topProducts = topProductsData?.topProducts ?? [];
  const topClients = topClientsData?.topClients ?? [];
  const sellerRanking = rankingData?.sellerRanking ?? [];
  const sellerPortfolioStats = portfolioData?.sellerPortfolioStats ?? [];
  const uniqueClients = summaryData?.monthlySummary?.uniqueClients ?? 0;
  const prevUniqueClients = summaryData?.prevMonthSummary?.uniqueClients ?? 0;

  const isStatsLoading = isComparisonLoading || isEvolutionLoading;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Vendido"
          value={(isStatsLoading) ? "—" : formatCurrency(currentStats.totalValue)}
          subValue={`vs período anterior: ${formatCurrency(previousStats.totalValue)}`}
          subValue2={`${lastYearLabel}: ${formatCurrency(lastYearStats.totalValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          current={currentStats.totalValue}
          previous={previousStats.totalValue}
        />
        <KpiCard
          label="Pedidos"
          value={isStatsLoading ? "—" : String(currentStats.totalOrders)}
          subValue={`vs período anterior: ${previousStats.totalOrders}`}
          subValue2={`${lastYearLabel}: ${lastYearStats.totalOrders}`}
          icon={<ShoppingCart className="h-4 w-4" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
          current={currentStats.totalOrders}
          previous={previousStats.totalOrders}
        />
        <KpiCard
          label="Ticket Médio"
          value={isStatsLoading ? "—" : formatCurrency(currentStats.averageValue)}
          subValue={`vs período anterior: ${formatCurrency(previousStats.averageValue)}`}
          subValue2={`${lastYearLabel}: ${formatCurrency(lastYearStats.averageValue)}`}
          icon={<BarChart3 className="h-4 w-4" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-600 dark:text-amber-400"
          current={currentStats.averageValue}
          previous={previousStats.averageValue}
        />
        <KpiCard
          label="Preço Médio da GRF"
          value={isStatsLoading ? "—" : formatCurrency(currentStats.avgBottleValue)}
          subValue={`vs período anterior: ${formatCurrency(previousStats.avgBottleValue)}`}
          subValue2={`${lastYearLabel}: ${formatCurrency(lastYearStats.avgBottleValue)}`}
          icon={<Wine className="h-4 w-4" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          current={currentStats.avgBottleValue}
          previous={previousStats.avgBottleValue}
        />
      </div>

      {/* Estatísticas de Clientes CRM */}
      <ReportsStatistics
        totalClients={clientReports?.totalClients ?? 0}
        upcomingBirthdaysCount={clientReports?.upcomingBirthdays.length ?? 0}
        newClientsThisMonth={
          generalReports?.recentStats.newClientsThisMonth ?? 0
        }
        totalInteractionsThisMonth={
          generalReports?.recentStats.totalInteractionsThisMonth ?? 0
        }
        clientGrowthPercent={
          generalReports?.growthStats.clientGrowthPercent ?? 0
        }
        interactionGrowthPercent={
          generalReports?.growthStats.interactionGrowthPercent ?? 0
        }
      />

      {/* Gráfico de Evolução */}
      <SalesEvolutionChart
        data={unifiedEvolution.map((p) => ({ date: p.period, totalOrders: p.totalOrders, totalValue: p.totalValue }))}
        isLoading={isEvolutionLoading}
        groupBy={groupBy}
      />

      {/* Metas de todos os vendedores */}
      <AllSellersGoalProgress sellerPortfolioStats={sellerPortfolioStats} source={source} />

      {/* Ranking de Vendedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isRankingLoading ? (
          <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 md:col-span-2">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-5 w-48" />
              </div>
              {[1, 2, 3, 4].map((i) => (
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
        ) : (
          <SellerRankingCard sellers={sellerRanking} />
        )}
      </div>

      {/* Top Produtos + Top Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopProductsChart
          data={topProducts.map((p) => ({
            description: p.description,
            totalQuantity: String(p.totalQuantity),
            totalValue: String(p.totalValue),
            orderCount: p.orderCount,
            productCode: p.productCode,
          }))}
          isLoading={isTopProductsLoading}
        />

        <TopClientsCard
          data={topClients}
          isLoading={isTopClientsLoading}
          title="Top Clientes do Mês"
        />
      </div>
    </div>
  );
}
