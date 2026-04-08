import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BarChart3,
  Package,
  TrendingUp,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedTopSellers } from "@/hooks/use-unified-orders";

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

interface DashboardData {
  success: boolean;
  seller: { id: string; name: string };
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
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
  itemsPerSale: number;
  userName: string;
  weeklyResults: WeeklyResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(achieved: number, goal: number) {
  if (goal === 0) return 0;
  return Math.min((achieved / goal) * 100, 100);
}


// ─── Componentes auxiliares ───────────────────────────────────────────────────

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
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
        </div>
        <span className={`text-sm font-black ${textClass}`}>{percentage.toFixed(1)}%</span>
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
      <span className="w-6 text-center text-xs font-black text-slate-400">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
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
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl bg-white dark:bg-slate-900">
      <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
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
    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">{message}</p>
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
    useUnifiedTopSellers(monthStart, monthEnd, 100, "all");

  const goal = useMemo(
    () => goals.find((g) => g.userId === userId),
    [goals, userId],
  );

  // Vendas reais do mês para este vendedor
  const realSalesData = useMemo(() => {
    if (!goal || !topSellers.length) return null;
    return topSellers.find((s) => namesMatch(s.sellerName, goal.userName)) ?? null;
  }, [goal, topSellers]);

  if (!goal) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl bg-white dark:bg-slate-900">
        <CardContent className="py-10 text-center text-sm text-slate-400">
          Nenhuma meta cadastrada para este mês.
        </CardContent>
      </Card>
    );
  }

  const results = goal.weeklyResults ?? [];
  // Acompanhamento mensal: usar o único resultado registrado (week=1)
  const monthlyResult = results[0] ?? null;
  const salesAchieved = monthlyResult ? Number(monthlyResult.salesAchieved) : 0;
  const ticketAchieved = monthlyResult ? Number(monthlyResult.ticketAchieved) : 0;
  const itemsAchieved = monthlyResult ? Number(monthlyResult.itemsAchieved) : 0;

  const realValue = realSalesData?.totalValue ?? 0;
  const realOrders = realSalesData?.totalOrders ?? 0;
  const realAvgTicket = realOrders > 0 ? realValue / realOrders : 0;
  const salesGoalNum = Number(goal.salesGoal);
  const realPct = salesGoalNum > 0 ? Math.min((realValue / salesGoalNum) * 100, 100) : 0;
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
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl bg-white dark:bg-slate-900">
      <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Progresso da Meta —{" "}
              {format(now, "MMMM yyyy", { locale: ptBR })
                .replace(/^\w/, (c) => c.toUpperCase())}
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

        {/* ── Vendas Reais no Mês (Bling + Connect) ── */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Vendas Reais no Mês
            </span>
            <span className="text-[10px] text-slate-400">Bling + Connect</span>
          </div>

          {isTopSellersLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-7 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className={`text-2xl font-black tabular-nums ${realTextColor}`}>
                    {formatCurrency(realValue)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {realOrders} pedido{realOrders !== 1 ? "s" : ""} · ticket médio {formatCurrency(realAvgTicket)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tabular-nums ${realTextColor}`}>
                    {realPct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-400">da meta</p>
                </div>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${realPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${realPctColor}`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>Vendido: {formatCurrency(realValue)}</span>
                <span>Meta: {formatCurrency(salesGoalNum)}</span>
              </div>
            </>
          )}
        </div>

        <ProgressBar
          label="Volume de Vendas (semanal)"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          achieved={formatCurrency(salesAchieved)}
          goal={formatCurrency(goal.salesGoal)}
          percentage={pct(salesAchieved, Number(goal.salesGoal))}
          colorClass="bg-emerald-500"
          bgClass="bg-emerald-50 dark:bg-emerald-900/20"
          textClass="text-emerald-600 dark:text-emerald-400"
        />
        <ProgressBar
          label="Ticket Médio"
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          achieved={formatCurrency(realAvgTicket)}
          goal={formatCurrency(goal.averageTicket)}
          percentage={pct(realAvgTicket, Number(goal.averageTicket))}
          colorClass="bg-blue-500"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
          textClass="text-blue-600 dark:text-blue-400"
        />
        <ProgressBar
          label="Itens por Venda"
          icon={<Package className="h-3.5 w-3.5" />}
          achieved={`${itemsAchieved} itens`}
          goal={`${goal.itemsPerSale} itens`}
          percentage={pct(itemsAchieved, goal.itemsPerSale)}
          colorClass="bg-purple-500"
          bgClass="bg-purple-50 dark:bg-purple-900/20"
          textClass="text-purple-600 dark:text-purple-400"
        />

        {/* Status Mensal */}
        <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Resultado do Mês</span>
            <span className={monthlyResult ? "text-emerald-500" : "text-slate-400"}>
              {monthlyResult ? "Registrado" : "Pendente"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SellerDashboardPage() {
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: [`/api/users/${user?.id}/seller-dashboard`],
    enabled: !!user?.id,
  });

  const topClients = data?.topClients ?? [];
  const highestAvgTicket = data?.highestAvgTicket ?? [];
  const highestAvgItemValue = data?.highestAvgItemValue ?? [];
  const inactiveClients = data?.inactiveClients ?? [];
  const newClientsThisMonth = (data?.newClientsThisMonth ?? []).slice(0, 18);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 animate-pulse">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard Vendedor
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Visão geral de performance e carteira de clientes
        </p>
      </div>

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Erro ao carregar dados: {String(error)}
        </div>
      )}

      {/* Progresso da Meta */}
      {user && <GoalProgressBlock userId={user.id} />}

      {/* Grid 2 colunas: Top Clientes + Maior Ticket Médio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Clientes */}
        <SectionCard
          title="Top Clientes"
          icon={<Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
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

        {/* Maior Ticket Médio */}
        <SectionCard
          title="Maior Ticket Médio"
          icon={<BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
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

        {/* Maior Valor de Item Médio */}
        <SectionCard
          title="Maior Valor de Item Médio"
          icon={<Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
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

        {/* Clientes Inativos */}
        <SectionCard
          title="Clientes Inativos"
          icon={<UserMinus className="h-4 w-4 text-red-500 dark:text-red-400" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
          count={inactiveClients.length}
        >
          {!inactiveClients.length ? (
            <EmptyState message="Nenhum cliente inativo." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {inactiveClients.map((c, i) => (
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
      </div>

      {/* Últimos Clientes Cadastrados */}
      <SectionCard
        title="Últimos Clientes Cadastrados"
        icon={<UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
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
                secondary={format(parseISO(c.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
