import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Trophy,
  Medal,
  TrendingUp,
  Users,
  ShoppingCart,
  Zap,
  Star,
  Crown,
  Target,
  Flame,
  ChevronUp,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopSeller {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
  totalItems: number;
  uniqueClients: number;
}

interface GoalResult {
  id: string;
  userId: string;
  monthlyGoal: number;
  results: {
    totalSales: number;
    achievement: number;
  };
}

interface Badge {
  icon: string;
  label: string;
  color: string;
  bg: string;
}

interface RankedSeller extends TopSeller {
  rank: number;
  achievement: number | null;
  monthlyGoal: number | null;
  avgTicket: number;
  badges: Badge[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "current-month", label: "Mês Atual" },
  { value: "last-month", label: "Mês Passado" },
  { value: "last-3-months", label: "Últimos 3 Meses" },
  { value: "current-year", label: "Ano Atual" },
];

function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const today = new Date();
  switch (period) {
    case "last-month": {
      const prev = subMonths(today, 1);
      return {
        startDate: format(startOfMonth(prev), "yyyy-MM-dd"),
        endDate: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    case "last-3-months": {
      const prev3 = subMonths(today, 3);
      return {
        startDate: format(startOfMonth(prev3), "yyyy-MM-dd"),
        endDate: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    }
    case "current-year":
      return {
        startDate: format(startOfYear(today), "yyyy-MM-dd"),
        endDate: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    default: // current-month
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(endOfMonth(today), "yyyy-MM-dd"),
      };
  }
}

function computeBadges(seller: RankedSeller, allSellers: RankedSeller[]): Badge[] {
  const badges: Badge[] = [];
  if (seller.rank === 1) {
    badges.push({ icon: "👑", label: "Campeão", color: "text-amber-700", bg: "bg-amber-100 border-amber-300" });
  } else if (seller.rank === 2) {
    badges.push({ icon: "🥈", label: "Vice", color: "text-slate-600", bg: "bg-slate-100 border-slate-300" });
  } else if (seller.rank === 3) {
    badges.push({ icon: "🥉", label: "Top 3", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" });
  }
  if (seller.achievement !== null) {
    if (seller.achievement >= 100) {
      badges.push({ icon: "🔥", label: "Meta Batida", color: "text-red-700", bg: "bg-red-100 border-red-300" });
    } else if (seller.achievement >= 80) {
      badges.push({ icon: "📈", label: "Quase Lá", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" });
    }
  }
  const maxTicket = Math.max(...allSellers.map((s) => s.avgTicket));
  if (seller.avgTicket === maxTicket && maxTicket > 0 && allSellers.length > 1) {
    badges.push({ icon: "⚡", label: "Top Ticket", color: "text-purple-700", bg: "bg-purple-100 border-purple-300" });
  }
  const maxClients = Math.max(...allSellers.map((s) => s.uniqueClients));
  if (seller.uniqueClients === maxClients && maxClients > 0 && allSellers.length > 1) {
    badges.push({ icon: "🌟", label: "Maior Base", color: "text-green-700", bg: "bg-green-100 border-green-300" });
  }
  return badges;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number) {
  return `${v.toFixed(0)}%`;
}

// ─── Podium card ──────────────────────────────────────────────────────────────

const PODIUM = [
  { rank: 1, height: "h-36", label: "1º", icon: Crown, gradient: "from-amber-400 to-yellow-500", ring: "ring-amber-400", text: "text-amber-600", pillar: "bg-amber-400", pillarH: "h-24" },
  { rank: 2, height: "h-28", label: "2º", icon: Medal, gradient: "from-slate-300 to-slate-400", ring: "ring-slate-400", text: "text-slate-500", pillar: "bg-slate-300", pillarH: "h-16" },
  { rank: 3, height: "h-24", label: "3º", icon: Medal, gradient: "from-orange-400 to-amber-600", ring: "ring-orange-400", text: "text-orange-600", pillar: "bg-orange-400", pillarH: "h-12" },
];

function PodiumCard({ seller, podium }: { seller: RankedSeller | undefined; podium: (typeof PODIUM)[0] }) {
  const Icon = podium.icon;
  if (!seller) {
    return (
      <div className={cn("flex flex-col items-center gap-2", podium.rank === 1 ? "order-2" : podium.rank === 2 ? "order-1" : "order-3")}>
        <div className={cn("w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-4 border-dashed border-slate-200 dark:border-slate-600")}>
          <span className="text-slate-300 text-xs">—</span>
        </div>
        <div className={cn("w-full rounded-t-lg flex items-center justify-center text-white font-bold text-lg", podium.pillar, podium.pillarH)}>
          {podium.label}
        </div>
      </div>
    );
  }

  const initials = seller.sellerName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className={cn("flex flex-col items-center gap-2", podium.rank === 1 ? "order-2" : podium.rank === 2 ? "order-1" : "order-3")}>
      <div className={cn("relative w-20 h-20 rounded-full flex items-center justify-center border-4 text-white font-bold text-xl shadow-lg bg-gradient-to-br", podium.gradient, podium.ring, "ring-2")}>
        {initials}
        <div className="absolute -top-2 -right-1">
          <Icon className={cn("h-5 w-5", podium.text)} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 max-w-[100px] truncate leading-tight">
          {seller.sellerName.split(" ")[0]}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{fmtBRL(seller.totalValue)}</p>
        {seller.achievement !== null && (
          <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full",
            seller.achievement >= 100 ? "text-green-700 bg-green-100" : "text-slate-600 bg-slate-100")}>
            {fmtPct(seller.achievement)} da meta
          </span>
        )}
      </div>
      <div className={cn("w-full rounded-t-lg flex items-center justify-center text-white font-bold text-lg shadow-inner", podium.pillar, podium.pillarH)}>
        {podium.label}
      </div>
    </div>
  );
}

// ─── Rank row ─────────────────────────────────────────────────────────────────

function RankRow({ seller, index }: { seller: RankedSeller; index: number }) {
  const initials = seller.sellerName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const medalColors = ["text-amber-500", "text-slate-400", "text-orange-500"];
  const isMedal = index < 3;

  return (
    <div className={cn(
      "grid grid-cols-[40px_1fr_120px_100px_100px_80px] items-center gap-2 px-4 py-3 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors",
      index === 0 && "bg-amber-50/60 dark:bg-amber-900/10",
      index === 1 && "bg-slate-50/60 dark:bg-slate-800/30",
      index === 2 && "bg-orange-50/60 dark:bg-orange-900/10",
    )}>
      {/* Rank */}
      <div className={cn("text-center font-bold text-lg", isMedal ? medalColors[index] : "text-slate-400 text-sm")}>
        {isMedal ? (["🥇", "🥈", "🥉"][index]) : `${index + 1}º`}
      </div>

      {/* Seller */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm",
          index === 0 ? "bg-gradient-to-br from-amber-400 to-yellow-500" :
          index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500" :
          index === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600" :
          "bg-purple-600",
        )}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{seller.sellerName}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {seller.badges.slice(0, 3).map((b, i) => (
              <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex items-center gap-0.5", b.bg, b.color)}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="text-right">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmtBRL(seller.totalValue)}</p>
        <p className="text-xs text-slate-400">{seller.totalOrders} pedidos</p>
      </div>

      {/* Ticket médio */}
      <div className="text-right">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{fmtBRL(seller.avgTicket)}</p>
        <p className="text-xs text-slate-400">ticket médio</p>
      </div>

      {/* Clientes */}
      <div className="text-right">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{seller.uniqueClients}</p>
        <p className="text-xs text-slate-400">clientes</p>
      </div>

      {/* Meta */}
      <div className="text-right">
        {seller.achievement !== null ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className={cn("text-xs font-bold",
              seller.achievement >= 100 ? "text-green-600" :
              seller.achievement >= 80 ? "text-blue-600" : "text-slate-500")}>
              {fmtPct(seller.achievement)}
            </span>
            <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  seller.achievement >= 100 ? "bg-green-500" :
                  seller.achievement >= 80 ? "bg-blue-500" : "bg-amber-400")}
                style={{ width: `${Math.min(seller.achievement, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 flex items-center gap-3 shadow-sm">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RankingPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("current-month");

  const { startDate, endDate } = getPeriodDates(period);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: topSellersRaw, isLoading: sellersLoading } = useQuery<{ success: boolean; data: TopSeller[] }>({
    queryKey: ["/api/unified-orders/statistics/top-sellers", startDate, endDate],
    queryFn: () =>
      fetch(`/api/unified-orders/statistics/top-sellers?startDate=${startDate}&endDate=${endDate}&limit=50`, { credentials: "include" })
        .then((r) => r.json()),
  });

  const { data: goalsRaw = [] } = useQuery<GoalResult[]>({
    queryKey: ["/api/user-goals-with-results", currentMonth, currentYear],
    queryFn: () =>
      fetch(`/api/user-goals-with-results/${currentMonth}/${currentYear}`, { credentials: "include" })
        .then((r) => r.json()),
    enabled: period === "current-month",
  });

  const sellers: TopSeller[] = topSellersRaw?.data ?? [];

  const goalMap = useMemo(() => {
    const map: Record<string, GoalResult> = {};
    goalsRaw.forEach((g) => { map[g.userId] = g; });
    return map;
  }, [goalsRaw]);

  const ranked: RankedSeller[] = useMemo(() => {
    const sorted = [...sellers].sort((a, b) => b.totalValue - a.totalValue);
    const withRank = sorted.map((s, i) => {
      const goal = goalMap[s.sellerId];
      const achievement = goal ? goal.results.achievement : null;
      const monthlyGoal = goal ? goal.monthlyGoal : null;
      const avgTicket = s.totalOrders > 0 ? s.totalValue / s.totalOrders : 0;
      return {
        ...s,
        rank: i + 1,
        achievement,
        monthlyGoal,
        avgTicket,
        badges: [] as Badge[],
      } as RankedSeller;
    });
    return withRank.map((s) => ({ ...s, badges: computeBadges(s, withRank) }));
  }, [sellers, goalMap]);

  const totalRevenue = ranked.reduce((a, s) => a + s.totalValue, 0);
  const totalOrders = ranked.reduce((a, s) => a + s.totalOrders, 0);
  const totalClients = ranked.reduce((a, s) => a + s.uniqueClients, 0);
  const goalsHit = ranked.filter((s) => (s.achievement ?? 0) >= 100).length;

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Ranking de Vendas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Desempenho da equipe — {periodLabel.toLowerCase()}
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Faturamento Total" value={fmtBRL(totalRevenue)} color="bg-purple-600" />
        <StatCard icon={ShoppingCart} label="Total de Pedidos" value={totalOrders.toLocaleString("pt-BR")} color="bg-blue-600" />
        <StatCard icon={Users} label="Clientes Atendidos" value={totalClients.toLocaleString("pt-BR")} color="bg-teal-600" />
        <StatCard icon={Target} label="Metas Batidas" value={`${goalsHit} vendedor${goalsHit !== 1 ? "es" : ""}`} sub={period !== "current-month" ? "apenas mês atual" : undefined} color="bg-green-600" />
      </div>

      {/* Podium */}
      {sellersLoading ? (
        <div className="rounded-xl border bg-white dark:bg-slate-800 p-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Trophy className="h-10 w-10 opacity-30 animate-pulse" />
            <p className="text-sm">Carregando ranking...</p>
          </div>
        </div>
      ) : ranked.length === 0 ? (
        <div className="rounded-xl border bg-white dark:bg-slate-800 p-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Trophy className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhuma venda encontrada no período.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Podium display */}
          <div className="rounded-xl border bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-800 p-6 shadow-sm">
            <div className="flex items-end justify-center gap-4 h-64">
              {PODIUM.map((p) => (
                <div key={p.rank} className={cn("flex-1 max-w-[140px]", "flex flex-col items-center justify-end")}>
                  <PodiumCard seller={ranked[p.rank - 1]} podium={p} />
                </div>
              ))}
            </div>
            {/* Legend badges */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                { icon: "👑", label: "Campeão", color: "text-amber-700 bg-amber-100 border-amber-300" },
                { icon: "🔥", label: "Meta Batida (≥100%)", color: "text-red-700 bg-red-100 border-red-300" },
                { icon: "📈", label: "Quase Lá (≥80%)", color: "text-blue-700 bg-blue-100 border-blue-300" },
                { icon: "⚡", label: "Top Ticket Médio", color: "text-purple-700 bg-purple-100 border-purple-300" },
                { icon: "🌟", label: "Maior Base de Clientes", color: "text-green-700 bg-green-100 border-green-300" },
              ].map((b) => (
                <span key={b.label} className={cn("text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1", b.color)}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Full ranking table */}
          <div className="rounded-xl border bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-700/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Medal className="h-4 w-4 text-purple-500" />
                Ranking Completo — {ranked.length} vendedor{ranked.length !== 1 ? "es" : ""}
              </h2>
              <div className="hidden md:grid grid-cols-[40px_1fr_120px_100px_100px_80px] gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium w-full ml-4">
                <span></span>
                <span>Vendedor</span>
                <span className="text-right">Faturamento</span>
                <span className="text-right">Ticket</span>
                <span className="text-right">Clientes</span>
                <span className="text-right">Meta</span>
              </div>
            </div>
            {ranked.map((s, i) => (
              <RankRow key={s.sellerId} seller={s} index={i} />
            ))}
          </div>

          {/* My position (if vendedor) */}
          {user?.role === "vendedor" && (() => {
            const myPos = ranked.findIndex((s) => s.sellerId === user.id);
            if (myPos === -1) return null;
            const me = ranked[myPos];
            return (
              <div className="rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 p-4 flex items-center gap-4">
                <div className="text-2xl font-black text-purple-600">#{me.rank}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">Sua posição no ranking</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {fmtBRL(me.totalValue)} em vendas · {me.totalOrders} pedidos
                    {me.achievement !== null && ` · ${fmtPct(me.achievement)} da meta`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {me.badges.map((b, i) => (
                    <span key={i} className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", b.bg, b.color)}>
                      {b.icon} {b.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
