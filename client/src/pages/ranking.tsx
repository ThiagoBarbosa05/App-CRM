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

interface WeeklyResult {
  salesAchieved: string | number;
}

interface GoalResult {
  id: string;
  userId: string;
  salesGoal: string | number;
  weeklyResults: WeeklyResult[];
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

// ─── Stadium Podium ──────────────────────────────────────────────────────────

const CONFETTI_PIECES = Array.from({ length: 22 }, (_, i) => ({
  left: `${4 + i * 4.3}%`,
  delay: `${(i * 0.27) % 3}s`,
  dur: `${2.2 + (i % 5) * 0.4}s`,
  color: ["#F59E0B","#FCD34D","#FBBF24","#FDE68A","#F97316","#ffffff"][i % 6],
  size: i % 3 === 0 ? 8 : 5,
  rotate: i % 2 === 0 ? "rotate(45deg)" : "rotate(0deg)",
}));

const SHIELD_CFG: Record<number, {
  color: string; colorDim: string; glow: string;
  border: string; borderInner: string;
  trophy: boolean; stars: number;
  shieldW: number; shieldH: number;
  pedestalH: number; pedestalColor: string;
}> = {
  1: {
    color: "#F59E0B", colorDim: "#92400E", glow: "rgba(245,158,11,0.8)",
    border: "#F59E0B", borderInner: "#78350F",
    trophy: true, stars: 5,
    shieldW: 180, shieldH: 210,
    pedestalH: 88, pedestalColor: "linear-gradient(180deg,#92400E,#451a03)",
  },
  2: {
    color: "#CBD5E1", colorDim: "#475569", glow: "rgba(148,163,184,0.5)",
    border: "#94A3B8", borderInner: "#334155",
    trophy: false, stars: 3,
    shieldW: 140, shieldH: 165,
    pedestalH: 56, pedestalColor: "linear-gradient(180deg,#475569,#1e293b)",
  },
  3: {
    color: "#CD7F32", colorDim: "#7c2d12", glow: "rgba(180,83,9,0.5)",
    border: "#B45309", borderInner: "#431407",
    trophy: false, stars: 3,
    shieldW: 140, shieldH: 165,
    pedestalH: 40, pedestalColor: "linear-gradient(180deg,#7c2d12,#2d0d00)",
  },
};

function Laurel({ color, side }: { color: string; side: "left" | "right" }) {
  const leaves = [0, 1, 2, 3, 4];
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.85 }}>
      {leaves.map((i) => {
        const angle = side === "left"
          ? -30 + i * 18
          : 210 - i * 18;
        const r = 52 + i * 3;
        const x = 50 + r * Math.cos((angle * Math.PI) / 180);
        const y = 62 + r * Math.sin((angle * Math.PI) / 180);
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%,-50%) rotate(${angle + (side === "left" ? 90 : -90)}deg)`,
              width: 14 + i * 1.5,
              height: 7,
              background: color,
              borderRadius: "50% 0 50% 0",
              opacity: 0.75 - i * 0.06,
            }}
          />
        );
      })}
    </div>
  );
}

function ShieldBadge({ seller, rank }: { seller: RankedSeller | undefined; rank: number }) {
  const cfg = SHIELD_CFG[rank];
  const isFirst = rank === 1;
  const label = rank === 1 ? "1" : rank === 2 ? "2" : "3";

  return (
    <div className="flex flex-col items-center gap-0" style={{ order: rank === 1 ? 2 : rank === 2 ? 1 : 3 }}>
      {/* Shield */}
      <div
        className="relative flex flex-col items-center justify-start pt-4 pb-6 px-3"
        style={{
          width: cfg.shieldW,
          height: cfg.shieldH,
          clipPath: "polygon(15% 0%, 85% 0%, 100% 18%, 100% 65%, 50% 100%, 0% 65%, 0% 18%)",
          background: `linear-gradient(170deg, #1a1a2e 0%, #0d0d1a 100%)`,
          boxShadow: `0 0 ${isFirst ? 32 : 16}px ${cfg.glow}, inset 0 0 20px rgba(0,0,0,0.6)`,
          border: `3px solid ${cfg.border}`,
          outline: `6px solid ${cfg.borderInner}`,
          animation: isFirst ? "shield-glow 2.5s ease-in-out infinite" : undefined,
        }}
      >
        {/* Laurel wreaths */}
        <Laurel color={cfg.color} side="left" />
        <Laurel color={cfg.color} side="right" />

        {/* Shimmer for 1st */}
        {isFirst && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
              animation: "shimmer 3s ease-in-out infinite",
            }}
          />
        )}

        {/* Stars */}
        <div className="flex gap-0.5 mt-1 z-10 relative">
          {Array.from({ length: cfg.stars }).map((_, i) => (
            <span key={i} style={{ color: cfg.color, fontSize: isFirst ? 13 : 10 }}>★</span>
          ))}
        </div>

        {/* Rank number */}
        <div
          className="z-10 relative font-black leading-none select-none"
          style={{
            fontSize: isFirst ? 80 : 58,
            color: cfg.color,
            textShadow: `0 0 20px ${cfg.glow}, 0 2px 0 ${cfg.colorDim}`,
            lineHeight: 1,
            marginTop: isFirst ? -4 : -2,
            fontFamily: "Georgia, serif",
          }}
        >
          {label}
        </div>

        {/* LUGAR */}
        <div
          className="z-10 relative font-bold tracking-[0.3em] uppercase"
          style={{ color: cfg.color, fontSize: isFirst ? 14 : 11, marginTop: -4 }}
        >
          LUGAR
        </div>

        {/* Trophy for 1st */}
        {isFirst && (
          <div
            className="z-10 relative mt-1"
            style={{ animation: "crown-bounce 2s ease-in-out infinite", color: cfg.color }}
          >
            <Trophy style={{ width: 36, height: 36, color: cfg.color, filter: `drop-shadow(0 0 8px ${cfg.glow})` }} />
          </div>
        )}
      </div>

      {/* Seller info */}
      <div className="flex flex-col items-center gap-0.5 mt-2 px-2 text-center" style={{ width: cfg.shieldW }}>
        {seller ? (
          <>
            <p
              className="font-bold truncate max-w-full"
              style={{ color: cfg.color, fontSize: isFirst ? 15 : 12 }}
            >
              {seller.sellerName.split(" ").slice(0, 2).join(" ")}
            </p>
            {seller.achievement !== null ? (
              <p
                className="font-black"
                style={{
                  color: isFirst ? "#FCD34D" : cfg.color,
                  fontSize: isFirst ? 22 : 17,
                  textShadow: `0 0 10px ${cfg.glow}`,
                  animation: isFirst ? "achievement-pop 2s ease-in-out infinite" : undefined,
                }}
              >
                {fmtPct(seller.achievement)}
              </p>
            ) : (
              <p className="text-xs" style={{ color: cfg.colorDim }}>sem meta</p>
            )}
          </>
        ) : (
          <p className="text-xs" style={{ color: cfg.colorDim }}>—</p>
        )}
      </div>

      {/* Pedestal */}
      <div
        className="mt-3 rounded-full"
        style={{
          width: cfg.shieldW * 0.75,
          height: cfg.pedestalH,
          background: cfg.pedestalColor,
          boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 12px ${cfg.glow}`,
        }}
      />
    </div>
  );
}

function StadiumPodium({ ranked }: { ranked: RankedSeller[] }) {
  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{ background: "linear-gradient(180deg, #050510 0%, #0b0b18 55%, #061008 100%)", minHeight: 380 }}
    >
      {/* Stadium lights — top left */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 55% 45% at 8% 0%, rgba(255,250,220,0.18) 0%, transparent 70%)",
      }} />
      {/* Stadium lights — top right */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 55% 45% at 92% 0%, rgba(255,250,220,0.18) 0%, transparent 70%)",
      }} />
      {/* Center golden glow for 1st */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 45% 60% at 50% 20%, rgba(245,158,11,0.22) 0%, transparent 70%)",
      }} />
      {/* Ground green gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{
        background: "linear-gradient(180deg, transparent 0%, rgba(0,30,0,0.5) 100%)",
      }} />

      {/* Confetti */}
      {CONFETTI_PIECES.map((p, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: p.left,
            top: "-8px",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: p.rotate,
            animation: `confetti-fall ${p.dur} ease-in infinite`,
            animationDelay: p.delay,
            borderRadius: i % 4 === 0 ? "50%" : 2,
          }}
        />
      ))}

      {/* Shields */}
      <div className="relative z-10 flex items-end justify-center gap-6 px-6 pt-8 pb-6">
        {[2, 1, 3].map((rank) => (
          <ShieldBadge key={rank} seller={ranked[rank - 1]} rank={rank} />
        ))}
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
      "grid grid-cols-[40px_1fr_130px_90px_70px] items-center gap-2 px-4 py-3 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors",
      index === 0 && "bg-amber-50/80 dark:bg-amber-900/20 border-l-4 border-l-amber-400",
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

      {/* % Meta — coluna principal */}
      <div className="text-right">
        {seller.achievement !== null ? (
          <div className="flex flex-col items-end gap-1">
            <span className={cn("text-sm font-black",
              seller.achievement >= 100 ? "text-green-600" :
              seller.achievement >= 80 ? "text-blue-600" : "text-amber-600")}>
              {fmtPct(seller.achievement)}
            </span>
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  seller.achievement >= 100 ? "bg-green-500" :
                  seller.achievement >= 80 ? "bg-blue-500" : "bg-amber-400")}
                style={{ width: `${Math.min(seller.achievement, 100)}%` }}
              />
            </div>
            {seller.monthlyGoal !== null && (
              <p className="text-[10px] text-slate-400">meta {fmtBRL(seller.monthlyGoal)}</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300">sem meta</span>
        )}
      </div>

      {/* Ticket médio */}
      <div className="text-right">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{fmtBRL(seller.avgTicket)}</p>
        <p className="text-xs text-slate-400">ticket</p>
      </div>

      {/* Clientes */}
      <div className="text-right">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{seller.uniqueClients}</p>
        <p className="text-xs text-slate-400">clientes</p>
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
    const map: Record<string, { achievement: number; monthlyGoal: number }> = {};
    goalsRaw.forEach((g) => {
      const salesGoal = Number(g.salesGoal ?? 0);
      const totalSales = (g.weeklyResults ?? []).reduce(
        (sum, w) => sum + Number(w.salesAchieved ?? 0),
        0,
      );
      const achievement = salesGoal > 0 ? Math.round((totalSales / salesGoal) * 1000) / 10 : null;
      if (achievement !== null) {
        map[g.userId] = { achievement, monthlyGoal: salesGoal };
      }
    });
    return map;
  }, [goalsRaw]);

  const ranked: RankedSeller[] = useMemo(() => {
    // Calcular achievement antes de ordenar
    const enriched = sellers.map((s) => {
      const goal = goalMap[s.sellerId];
      const achievement = goal?.achievement ?? null;
      const monthlyGoal = goal?.monthlyGoal ?? null;
      const avgTicket = s.totalOrders > 0 ? s.totalValue / s.totalOrders : 0;
      return { ...s, achievement, monthlyGoal, avgTicket, rank: 0, badges: [] as Badge[] } as RankedSeller;
    });

    // Ordenar por % atingimento (desc), depois por valor total (desc), nulls no final
    const sorted = [...enriched].sort((a, b) => {
      if (a.achievement === null && b.achievement === null) return b.totalValue - a.totalValue;
      if (a.achievement === null) return 1;
      if (b.achievement === null) return -1;
      if (b.achievement !== a.achievement) return b.achievement - a.achievement;
      return b.totalValue - a.totalValue;
    });

    const withRank = sorted.map((s, i) => ({ ...s, rank: i + 1, badges: [] as Badge[] }));
    return withRank.map((s) => ({ ...s, badges: computeBadges(s, withRank) }));
  }, [sellers, goalMap]);

  const totalRevenue = ranked.reduce((a, s) => a + s.totalValue, 0);
  const totalOrders = ranked.reduce((a, s) => a + s.totalOrders, 0);
  const totalClients = ranked.reduce((a, s) => a + s.uniqueClients, 0);
  const goalsHit = ranked.filter((s) => (s.achievement ?? 0) >= 100).length;

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "";

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @keyframes crown-bounce {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          40%       { transform: translateY(-7px) rotate(4deg); }
          70%       { transform: translateY(-3px) rotate(-1deg); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-140%); }
          60%  { transform: translateX(240%); }
          100% { transform: translateX(240%); }
        }
        @keyframes achievement-pop {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.1); }
        }
        @keyframes shield-glow {
          0%, 100% { box-shadow: 0 0 32px rgba(245,158,11,0.8), inset 0 0 20px rgba(0,0,0,0.6); }
          50%       { box-shadow: 0 0 56px rgba(245,158,11,1),   inset 0 0 20px rgba(0,0,0,0.6); }
        }
        @keyframes confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Ranking de Vendas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ordenado por % de atingimento da meta — {periodLabel.toLowerCase()}
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
          {/* Stadium Podium */}
          <StadiumPodium ranked={ranked} />

          {/* Legend badges */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
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

          {/* Full ranking table */}
          <div className="rounded-xl border bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-700/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Medal className="h-4 w-4 text-purple-500" />
                Ranking Completo — {ranked.length} vendedor{ranked.length !== 1 ? "es" : ""}
              </h2>
              <div className="hidden md:grid grid-cols-[40px_1fr_130px_90px_70px] gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium w-full ml-4">
                <span></span>
                <span>Vendedor</span>
                <span className="text-right">% Meta</span>
                <span className="text-right">Ticket</span>
                <span className="text-right">Clientes</span>
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
                    {me.totalOrders} pedidos
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
