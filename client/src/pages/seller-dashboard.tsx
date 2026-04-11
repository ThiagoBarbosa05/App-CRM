import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { DateRange } from "react-day-picker";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  CalendarIcon,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Wine,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnifiedTopSellers } from "@/hooks/use-unified-orders";
import { useClientReports, useGeneralReports } from "@/hooks/useReports";
import { ReportsBirthdayList } from "@/components/reports/reports-birthday-list";
import { ReportsStatistics } from "@/components/reports/reports-statistics";
import { ReportsDataCoverage } from "@/components/reports/reports-data-coverage";
import { getBottleGoalProgress } from "@/pages/seller-dashboard-goals";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TopClientRow {
  clientId: string | null;
  clientName: string | null;
  orderCount: number;
  totalValue: number;
  avgTicket: number;
}

interface TopItemValueRow {
  clientId: string | null;
  clientName: string | null;
  avgItemValue: number;
  itemCount: number;
}

interface InactiveClientRow {
  clientId: string;
  clientName: string;
  phone: string | null;
  lastPurchaseDate: string | null;
  daysSincePurchase: number | null;
}

interface NewClientRow {
  clientId: string;
  clientName: string;
  phone: string | null;
  createdAt: string;
}

interface MonthlySummary {
  totalValue: number;
  totalOrders: number;
  avgTicket: number;
  uniqueClients: number;
}

interface SalesEvolutionPoint {
  date: string;
  totalOrders: number;
  totalValue: number;
}

interface TopProductRow {
  productCode: string;
  description: string;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
}

interface SellerRankingRow {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
}

interface ClientPortfolioStats {
  total: number;
  active: number;
  inactive: number;
  positivacao: number;
}

interface SellerPortfolioStats extends ClientPortfolioStats {
  userId: string;
  sellerName: string;
}

interface DashboardData {
  success: boolean;
  seller: { id: string; name: string };
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
  monthlySummary: MonthlySummary;
  prevMonthSummary: MonthlySummary;
  salesEvolution: SalesEvolutionPoint[];
  topProducts: TopProductRow[];
  portfolioStats: ClientPortfolioStats;
  winePriceTier: SellerWinePriceTierRow | null;
  winePriceTierThresholds: WinePriceTierThresholds;
}

interface SellerWinePriceTierRow {
  sellerId: string;
  sellerName: string;
  economico: { totalValue: number; percentage: number; quantity: number };
  intermediario: { totalValue: number; percentage: number; quantity: number };
  premium: { totalValue: number; percentage: number; quantity: number };
}

interface WinePriceTierThresholds {
  lowThreshold: number;
  midThreshold: number;
}

interface AggregateDashboardData {
  success: boolean;
  monthlySummary: MonthlySummary;
  prevMonthSummary: MonthlySummary;
  salesEvolution: SalesEvolutionPoint[];
  topProducts: TopProductRow[];
  topClients: TopClientRow[];
  sellerRanking: SellerRankingRow[];
  sellerPortfolioStats: SellerPortfolioStats[];
  sellerWinePriceTiers: SellerWinePriceTierRow[];
  winePriceTierThresholds: WinePriceTierThresholds;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
  isActive: string;
  blingVendedorId: string | null;
}

interface WeeklyResult {
  id: string;
  goalId: string;
  week: number;
  salesAchieved: string;
  ticketAchieved: string;
  itemsAchieved: number;
}

interface UserGoal {
  id: string;
  userId: string;
  salesGoal: string;
  averageTicket: string;
  ordersGoal: number;
  avgBottleValueGoal: string;
  positivityGoal: number;
  positivityAchieved: number;
  positivityTotal: number;
  userName: string;
  weeklyResults: WeeklyResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(achieved: number, goal: number) {
  if (goal === 0) return 0;
  return Math.min((achieved / goal) * 100, 100);
}

function delta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────-

function KpiCard({
  label,
  value,
  subValue,
  icon,
  iconBg,
  iconColor,
  current,
  previous,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  current: number;
  previous: number;
}) {
  const d = delta(current, previous);
  const isUp = d >= 0;
  const hasHistory = previous > 0 || current > 0;

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              {label}
            </span>
            <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white truncate">
              {value}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <span className={iconColor}>{icon}</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>{subValue}</span>
          {hasHistory && (
            <div
              className={`flex items-center gap-1 font-bold ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
            >
              {isUp ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {isUp ? "+" : ""}
              {Math.abs(d).toFixed(1)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioKpiCard({ stats }: { stats: ClientPortfolioStats }) {
  const pctColor =
    stats.positivacao >= 70
      ? "text-emerald-600 dark:text-emerald-400"
      : stats.positivacao >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  const barColor =
    stats.positivacao >= 70
      ? "bg-emerald-500"
      : stats.positivacao >= 40
        ? "bg-amber-400"
        : "bg-red-500";
  const iconBg =
    stats.positivacao >= 70
      ? "bg-emerald-50 dark:bg-emerald-900/20"
      : stats.positivacao >= 40
        ? "bg-amber-50 dark:bg-amber-900/20"
        : "bg-red-50 dark:bg-red-900/20";

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              Positivação
            </span>
            <span className={`text-3xl font-black tabular-nums ${pctColor}`}>
              {stats.positivacao.toFixed(1)}%
            </span>
          </div>
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <span className={pctColor}>
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.positivacao, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${barColor}`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {stats.active} ativo{stats.active !== 1 ? "s" : ""}
            </span>
            <span className="text-red-500 dark:text-red-400 font-semibold">
              {stats.inactive} inativo{stats.inactive !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  label,
  icon,
  achieved,
  goal,
  percentage,
  colorClass,
  bgClass,
  textClass,
}: {
  label: string;
  icon: React.ReactNode;
  achieved: string;
  goal: string;
  percentage: number;
  colorClass: string;
  bgClass: string;
  textClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${bgClass} ${textClass}`}>{icon}</div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {label}
          </span>
        </div>
        <span className={`text-sm font-black ${textClass}`}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colorClass} rounded-full`}
        />
      </div>
      <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>Alcançado: {achieved}</span>
        <span>Meta: {goal}</span>
      </div>
    </div>
  );
}

function getGoalMetricTone(percentage: number) {
  if (percentage >= 100) {
    return {
      badge: "Meta batida",
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
      ringClass: "ring-emerald-100 dark:ring-emerald-900/40",
    };
  }

  if (percentage >= 70) {
    return {
      badge: "Em ritmo forte",
      badgeClass:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
      ringClass: "ring-amber-100 dark:ring-amber-900/40",
    };
  }

  return {
    badge: "Atenção",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
    ringClass: "ring-rose-100 dark:ring-rose-900/40",
  };
}

function GoalMetricCard({
  label,
  icon,
  achieved,
  goal,
  percentage,
  colorClass,
  bgClass,
  textClass,
}: {
  label: string;
  icon: React.ReactNode;
  achieved: string;
  goal: string;
  percentage: number;
  colorClass: string;
  bgClass: string;
  textClass: string;
}) {
  const tone = getGoalMetricTone(percentage);

  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm ring-1 ${tone.ringClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-xl ${bgClass} ${textClass}`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className={`mt-2 text-xl font-black leading-none ${textClass}`}>
              {achieved}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone.badgeClass}`}
        >
          {tone.badge}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>Meta: {goal}</span>
          <span className={textClass}>{percentage.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${colorClass}`}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Alcançado</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {achieved}
          </span>
        </div>
      </div>
    </div>
  );
}

function ClientRow({
  rank,
  clientId,
  name,
  secondary,
  badge,
}: {
  rank: number;
  clientId: string | null;
  name: string | null;
  secondary: string;
  badge?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <span className="w-6 text-center text-xs font-black text-slate-400">
        #{rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
          {name ?? "—"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {secondary}
        </p>
      </div>
      {badge && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {badge}
        </Badge>
      )}
    </div>
  );

  if (clientId) {
    return <Link href={`/clientes/${clientId}`}>{content}</Link>;
  }
  return content;
}

function SectionCard({
  title,
  icon,
  iconBg,
  children,
  count,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
      <CardHeader className="pb-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </CardTitle>
          </div>
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs font-bold">
              {count}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-3 pb-4 px-4">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
      {message}
    </p>
  );
}

// ─── Normaliza nome para comparação ───────────────────────────────────────────

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function namesMatch(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

// ─── Tooltip do gráfico ───────────────────────────────────────────────────────

function EvolutionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const valueEntry = payload.find((p) => p.name === "totalValue");
  const ordersEntry = payload.find((p) => p.name === "totalOrders");
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-md px-3 py-2.5 text-xs">
      <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </p>
      {valueEntry && (
        <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
          {formatCurrency(valueEntry.value)}
        </p>
      )}
      {ordersEntry && (
        <p className="text-slate-500 dark:text-slate-400">
          {ordersEntry.value} pedido{ordersEntry.value !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ─── Gráfico de Evolução de Vendas ────────────────────────────────────────────

function SalesEvolutionSection({ data }: { data: SalesEvolutionPoint[] }) {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: format(parseISO(p.date), "dd/MM"),
      })),
    [data],
  );

  const maxValue = useMemo(
    () => Math.max(...data.map((p) => p.totalValue), 1),
    [data],
  );

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
      <CardHeader className="pb-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
            Evolução de Vendas — Mês Atual
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-2 px-2">
        {data.length === 0 ? (
          <EmptyState message="Nenhuma venda registrada neste mês." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-slate-400"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-slate-400"
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, maxValue * 1.1]}
              />
              <RechartsTooltip content={<EvolutionTooltip />} />
              <Area
                type="monotone"
                dataKey="totalValue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradValue)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top Produtos ─────────────────────────────────────────────────────────────

function TopProductsCard({ products }: { products: TopProductRow[] }) {
  const maxValue = useMemo(
    () => Math.max(...products.map((p) => p.totalValue), 1),
    [products],
  );

  return (
    <SectionCard
      title="Top Produtos do Mês"
      icon={
        <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      }
      iconBg="bg-purple-50 dark:bg-purple-900/20"
      count={products.length}
    >
      {!products.length ? (
        <EmptyState message="Nenhuma venda de produto registrada." />
      ) : (
        <div className="space-y-3 pt-1">
          {products.map((p, i) => {
            const barPct = (p.totalValue / maxValue) * 100;
            return (
              <div key={`${p.productCode}-${i}`} className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center text-xs font-black text-slate-400 shrink-0">
                      #{i + 1}
                    </span>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {p.description}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">
                    {formatCurrency(p.totalValue)}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{
                        duration: 0.8,
                        ease: "easeOut",
                        delay: i * 0.1,
                      }}
                      className="h-full bg-purple-500 rounded-full"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {p.totalQuantity % 1 === 0
                      ? p.totalQuantity
                      : p.totalQuantity.toFixed(1)}{" "}
                    un · {p.orderCount} ped.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
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
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
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

// ─── Bloco de Progresso da Meta ───────────────────────────────────────────────

function GoalProgressBlock({ userId }: { userId: string }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: goals = [] } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${month}/${year}`],
  });

  const { data: topSellers = [], isLoading: isTopSellersLoading } =
    useUnifiedTopSellers(monthStart, monthEnd, 100, "bling");

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
                {/* Cabeçalho */}
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

                {/* Valores principais */}
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

                {/* Barra de progresso */}
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
}: {
  sellerId: string;
  isOwnView: boolean;
  startDate: string;
  endDate: string;
}) {
  const queryUrl = `/api/users/${sellerId}/seller-dashboard?startDate=${startDate}&endDate=${endDate}`;
  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: [queryUrl],
    enabled: !!sellerId,
  });
  const { data: clientReports } = useClientReports();

  const topClients = data?.topClients ?? [];
  const highestAvgTicket = data?.highestAvgTicket ?? [];
  const highestAvgItemValue = data?.highestAvgItemValue ?? [];
  const inactiveClients = data?.inactiveClients ?? [];
  const newClientsThisMonth = (data?.newClientsThisMonth ?? []).slice(0, 18);
  const monthlySummary = data?.monthlySummary ?? {
    totalValue: 0,
    totalOrders: 0,
    avgTicket: 0,
    uniqueClients: 0,
  };
  const prevMonthSummary = data?.prevMonthSummary ?? {
    totalValue: 0,
    totalOrders: 0,
    avgTicket: 0,
    uniqueClients: 0,
  };
  const salesEvolution = data?.salesEvolution ?? [];
  const topProducts = data?.topProducts ?? [];
  const portfolioStats = data?.portfolioStats ?? {
    total: 0,
    active: 0,
    inactive: 0,
    positivacao: 0,
  };
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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

        {/* GoalProgressBlock skeleton */}
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

        {/* SalesEvolution skeleton */}
        <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* 2-col section cards skeleton */}
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Vendido"
          value={formatCurrency(monthlySummary.totalValue)}
          subValue={`vs período anterior: ${formatCurrency(prevMonthSummary.totalValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          current={monthlySummary.totalValue}
          previous={prevMonthSummary.totalValue}
        />
        <KpiCard
          label="Pedidos"
          value={String(monthlySummary.totalOrders)}
          subValue={`vs período anterior: ${prevMonthSummary.totalOrders}`}
          icon={<ShoppingCart className="h-4 w-4" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
          current={monthlySummary.totalOrders}
          previous={prevMonthSummary.totalOrders}
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(monthlySummary.avgTicket)}
          subValue={`vs período anterior: ${formatCurrency(prevMonthSummary.avgTicket)}`}
          icon={<BarChart3 className="h-4 w-4" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-600 dark:text-amber-400"
          current={monthlySummary.avgTicket}
          previous={prevMonthSummary.avgTicket}
        />
        <KpiCard
          label="Clientes Atendidos"
          value={String(monthlySummary.uniqueClients)}
          subValue={`vs período anterior: ${prevMonthSummary.uniqueClients}`}
          icon={<Users className="h-4 w-4" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          current={monthlySummary.uniqueClients}
          previous={prevMonthSummary.uniqueClients}
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
      <GoalProgressBlock userId={sellerId} />

      {/* Gráfico de Evolução */}
      <SalesEvolutionSection data={salesEvolution} />

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Top Clientes"
          icon={
            <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          }
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          count={topClients.length}
        >
          {!topClients.length ? (
            <EmptyState message="Nenhuma venda registrada." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {topClients.map((c, i) => (
                <ClientRow
                  key={c.clientId ?? i}
                  rank={i + 1}
                  clientId={c.clientId}
                  name={c.clientName}
                  secondary={`${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""}`}
                  badge={formatCurrency(c.totalValue)}
                />
              ))}
            </div>
          )}
        </SectionCard>

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

        <TopProductsCard products={topProducts} />

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

// ─── Progresso de metas de todos os vendedores (admin) ───────────────────────

function AllSellersGoalProgress({
  sellerPortfolioStats,
}: {
  sellerPortfolioStats: SellerPortfolioStats[];
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
    useUnifiedTopSellers(monthStart, monthEnd, 100, "bling");

  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR }).replace(
    /^\w/,
    (c) => c.toUpperCase(),
  );
  const isLoading = goalsLoading || sellersLoading;

  // Para cada meta, enriquecer com dados reais do Bling e de carteira
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
                    {/* Header do card */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {goal.userName}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-bold shrink-0 ${monthlyResult ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                      >
                        {monthlyResult ? "✓ REG." : "PEND."}
                      </Badge>
                    </div>

                    {/* Valor real vs meta */}
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

                    {/* Barra de vendas */}
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${salesPct}%` }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className={`h-full rounded-full ${salesColor}`}
                      />
                    </div>

                    {/* Total de GRFs */}
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

                    {/* Ticket médio */}
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

                    {/* Valor médio por garrafa */}
                    <div className="space-y-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Wine className="h-3 w-3 text-rose-500 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 truncate">
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

                    {/* Carteira + Positivação */}
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

// ─── View agregada (admin — todos os vendedores) ──────────────────────────────

export function AggregateView({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const queryUrl = `/api/users/seller-dashboard/aggregate?startDate=${startDate}&endDate=${endDate}`;
  const { data, isLoading, isError, error } = useQuery<AggregateDashboardData>({
    queryKey: [queryUrl],
  });
  const { data: clientReports } = useClientReports();
  const { data: generalReports } = useGeneralReports();

  const monthlySummary = data?.monthlySummary ?? {
    totalValue: 0,
    totalOrders: 0,
    avgTicket: 0,
    uniqueClients: 0,
  };
  const prevMonthSummary = data?.prevMonthSummary ?? {
    totalValue: 0,
    totalOrders: 0,
    avgTicket: 0,
    uniqueClients: 0,
  };
  const salesEvolution = data?.salesEvolution ?? [];
  const topProducts = data?.topProducts ?? [];
  const topClients = data?.topClients ?? [];
  const sellerRanking = data?.sellerRanking ?? [];
  const sellerPortfolioStats = data?.sellerPortfolioStats ?? [];
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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

        {/* ReportsStatistics skeleton */}
        <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SalesEvolution skeleton */}
        <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* AllSellersGoalProgress skeleton */}
        <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-24" />
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

        {/* Seller Ranking + Wine Price Tier skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-4 w-36" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 divide-y divide-slate-50 dark:divide-slate-800">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Top Produtos + Top Clientes skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
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
              <CardContent className="px-4 pb-4 divide-y divide-slate-50 dark:divide-slate-800">
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Vendido"
          value={formatCurrency(monthlySummary.totalValue)}
          subValue={`vs período anterior: ${formatCurrency(prevMonthSummary.totalValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          current={monthlySummary.totalValue}
          previous={prevMonthSummary.totalValue}
        />
        <KpiCard
          label="Pedidos"
          value={String(monthlySummary.totalOrders)}
          subValue={`vs período anterior: ${prevMonthSummary.totalOrders}`}
          icon={<ShoppingCart className="h-4 w-4" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
          current={monthlySummary.totalOrders}
          previous={prevMonthSummary.totalOrders}
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(monthlySummary.avgTicket)}
          subValue={`vs período anterior: ${formatCurrency(prevMonthSummary.avgTicket)}`}
          icon={<BarChart3 className="h-4 w-4" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-600 dark:text-amber-400"
          current={monthlySummary.avgTicket}
          previous={prevMonthSummary.avgTicket}
        />
        <KpiCard
          label="Clientes Únicos"
          value={String(monthlySummary.uniqueClients)}
          subValue={`vs período anterior: ${prevMonthSummary.uniqueClients}`}
          icon={<Users className="h-4 w-4" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          current={monthlySummary.uniqueClients}
          previous={prevMonthSummary.uniqueClients}
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
      <SalesEvolutionSection data={salesEvolution} />

      {/* Metas de todos os vendedores */}
      <AllSellersGoalProgress sellerPortfolioStats={sellerPortfolioStats} />

      {/* Ranking de Vendedores (ocupa 2 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SellerRankingCard sellers={sellerRanking} />
      </div>

      {/* Qualidade dos Dados */}
      <ReportsDataCoverage
        totalClients={clientReports?.totalClients ?? 0}
        clientsWithEmail={clientReports?.clientsWithEmail ?? 0}
        clientsWithPhone={clientReports?.clientsWithPhone ?? 0}
        clientsWithCPF={clientReports?.clientsWithCPF ?? 0}
        clientsWithAddress={clientReports?.clientsWithAddress ?? 0}
      />

      {/* Top Produtos + Top Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopProductsCard products={topProducts} />

        <SectionCard
          title="Top Clientes do Mês"
          icon={
            <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          }
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          count={topClients.length}
        >
          {!topClients.length ? (
            <EmptyState message="Nenhuma venda registrada." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {topClients.map((c, i) => (
                <ClientRow
                  key={c.clientId ?? i}
                  rank={i + 1}
                  clientId={c.clientId}
                  name={c.clientName}
                  secondary={`${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""}`}
                  badge={formatCurrency(c.totalValue)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "gerente";

  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });

  const startDate = useMemo(
    () =>
      dateRange?.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : format(startOfMonth(new Date()), "yyyy-MM-dd"),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate),
    [dateRange?.to, startDate],
  );

  // Busca lista de vendedores (apenas para admin/gerente)
  const { data: usersList = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
    select: (users) =>
      users
        .filter((u) => u.isActive === "true")
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-950 border-b mb-6 border-gray-200 dark:border-slate-800 px-4 sm:px-6 py-4 rounded-lg shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <TrendingUp className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Dashboard Vendedor
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Visão geral de performance e carteira de clientes
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {/* Filtro de datas */}
          <div className="flex flex-col items-start gap-1">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium h-9 px-3"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <span>
                        {format(dateRange.from, "dd/MM/yy")} —{" "}
                        {format(dateRange.to, "dd/MM/yy")}
                      </span>
                    ) : (
                      format(dateRange.from, "dd/MM/yy")
                    )
                  ) : (
                    <span>Selecione um período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to) setIsCalendarOpen(false);
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-slate-400">
              Afeta gráficos e métricas do período
            </p>
          </div>

          {/* Seletor de vendedor (apenas admin/gerente) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Select
                value={selectedSellerId}
                onValueChange={setSelectedSellerId}
              >
                <SelectTrigger className="w-52 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium">
                  <SelectValue placeholder="Selecionar vendedor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-semibold">
                    Todos os vendedores
                  </SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo principal */}
      {isAdmin ? (
        selectedSellerId === "all" ? (
          <AggregateView startDate={startDate} endDate={endDate} />
        ) : (
          <IndividualSellerView
            sellerId={selectedSellerId}
            isOwnView={selectedSellerId === user?.id}
            startDate={startDate}
            endDate={endDate}
          />
        )
      ) : (
        user && (
          <IndividualSellerView
            sellerId={user.id}
            isOwnView={true}
            startDate={startDate}
            endDate={endDate}
          />
        )
      )}
    </div>
  );
}
