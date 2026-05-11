import { motion } from "framer-motion";
import { Link } from "wouter";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TopClientRow {
  clientId: string | null;
  clientName: string | null;
  orderCount: number;
  totalValue: number;
  avgTicket: number;
}

export interface TopItemValueRow {
  clientId: string | null;
  clientName: string | null;
  avgItemValue: number;
  itemCount: number;
}

export interface InactiveClientRow {
  clientId: string;
  clientName: string;
  phone: string | null;
  lastPurchaseDate: string | null;
  daysSincePurchase: number | null;
}

export interface NewClientRow {
  clientId: string;
  clientName: string;
  phone: string | null;
  createdAt: string;
}

export interface MonthlySummary {
  totalValue: number;
  totalOrders: number;
  avgTicket: number;
  uniqueClients: number;
}

export interface SalesEvolutionPoint {
  date: string;
  totalOrders: number;
  totalValue: number;
}

export interface TopProductRow {
  productCode: string;
  description: string;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
}

export interface SellerRankingRow {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
}

export interface ClientPortfolioStats {
  total: number;
  active: number;
  inactive: number;
  positivacao: number;
}

export interface SellerPortfolioStats extends ClientPortfolioStats {
  userId: string;
  sellerName: string;
}

export interface SellerWinePriceTierRow {
  sellerId: string;
  sellerName: string;
  economico: { totalValue: number; percentage: number; quantity: number };
  intermediario: { totalValue: number; percentage: number; quantity: number };
  premium: { totalValue: number; percentage: number; quantity: number };
}

export interface WinePriceTierThresholds {
  lowThreshold: number;
  midThreshold: number;
}

export interface DashboardData {
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

export interface AggregateDashboardData {
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

export interface WeeklyResult {
  id: string;
  goalId: string;
  week: number;
  salesAchieved: string;
  ticketAchieved: string;
  itemsAchieved: number;
}

export interface UserGoal {
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

export function pct(achieved: number, goal: number) {
  if (goal === 0) return 0;
  return Math.min((achieved / goal) * 100, 100);
}

export function delta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function namesMatch(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

export function getGoalMetricTone(percentage: number) {
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

// ─── Componentes compartilhados ───────────────────────────────────────────────

export function KpiCard({
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
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 flex flex-col h-full">
      <CardContent className="p-5 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 break-words">
              {label}
            </span>
            <p className="text-2xl lg:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {value}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>
            <span className={iconColor}>{icon}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/80">
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            {subValue}
          </span>
          {hasHistory && (
            <div
              className={`flex items-center gap-1 font-bold text-[11px] sm:text-xs ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
            >
              {isUp ? (
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {isUp ? "+" : ""}
                {Math.abs(d).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortfolioKpiCard({ stats }: { stats: ClientPortfolioStats }) {
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
    <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 flex flex-col h-full">
      <CardContent className="p-5 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 break-words">
              Positivação
            </span>
            <span
              className={`text-2xl lg:text-3xl font-black tabular-nums ${pctColor}`}
            >
              {stats.positivacao.toFixed(1)}%
            </span>
          </div>
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>
            <span className={pctColor}>
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/80">
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.positivacao, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${barColor}`}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 pt-1 w-full gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
              {stats.active} ativo{stats.active !== 1 ? "s" : ""}
            </span>
            <span className="text-red-500 dark:text-red-400 font-semibold shrink-0 text-right">
              {stats.inactive} inativo{stats.inactive !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProgressBar({
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

export function GoalMetricCard({
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

export function ClientRow({
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
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {name ?? "—"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
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

export function SectionCard({
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

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
      {message}
    </p>
  );
}
