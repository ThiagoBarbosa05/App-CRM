import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Trophy,
  BarChart2,
  UserX,
  UserPlus,
  Phone,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

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

interface SellerPortfolioStats {
  userId: string;
  sellerName: string;
  total: number;
  active: number;
  inactive: number;
  positivacao: number;
}

interface AggregateData {
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
  sellerPortfolioStats: SellerPortfolioStats[];
}

interface ClientCommercialGridProps {
  startDate: string;
  endDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ClientLink({ clientId, children }: { clientId: string | null; children: React.ReactNode }) {
  if (clientId) return <Link href={`/clientes/${clientId}`}>{children}</Link>;
  return <>{children}</>;
}

function RankRow({ rank, clientId, name, secondary, badge }: {
  rank: number;
  clientId: string | null;
  name: string | null;
  secondary: string;
  badge: string;
}) {
  return (
    <ClientLink clientId={clientId}>
      <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
        <span className="w-6 text-center text-xs font-black text-slate-400">#{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{name ?? "—"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">{badge}</Badge>
      </div>
    </ClientLink>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">{message}</p>;
}

function SectionCard({ icon, title, badge, children }: {
  icon: React.ReactNode;
  title: string;
  badge?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1">{title}</h3>
        {badge !== undefined && badge > 0 && (
          <Badge variant="secondary" className="text-xs shrink-0">{badge}</Badge>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ClientCommercialGrid({ startDate, endDate }: ClientCommercialGridProps) {
  const { data, isLoading } = useQuery<AggregateData>({
    queryKey: [`/api/users/seller-dashboard/aggregate?startDate=${startDate}&endDate=${endDate}`],
  });

  const topClients = data?.topClients ?? [];
  const highestAvgTicket = data?.highestAvgTicket ?? [];
  const highestAvgItemValue = data?.highestAvgItemValue ?? [];
  const inactiveClients = data?.inactiveClients ?? [];
  const newClients = data?.newClientsThisMonth ?? [];

  // Soma os stats de carteira de todos os vendedores
  const portfolioStats = (data?.sellerPortfolioStats ?? []).reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      active: acc.active + s.active,
      inactive: acc.inactive + s.inactive,
      positivacao: 0,
    }),
    { total: 0, active: 0, inactive: 0, positivacao: 0 },
  );
  if (portfolioStats.total > 0) {
    portfolioStats.positivacao = (portfolioStats.active / portfolioStats.total) * 100;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top Clientes por Valor */}
      <SectionCard
        icon={<div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20"><Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>}
        title="Top Clientes por Valor"
      >
        {isLoading ? <EmptyState message="Carregando..." /> : !topClients.length ? (
          <EmptyState message="Nenhuma venda no período." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {topClients.map((c, i) => (
              <RankRow key={c.clientId ?? i} rank={i + 1} clientId={c.clientId} name={c.clientName}
                secondary={`${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""}`}
                badge={formatCurrency(c.totalValue)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Maior Ticket Médio */}
      <SectionCard
        icon={<div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20"><BarChart2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>}
        title="Maior Ticket Médio"
      >
        {isLoading ? <EmptyState message="Carregando..." /> : !highestAvgTicket.length ? (
          <EmptyState message="Nenhum dado disponível." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {highestAvgTicket.map((c, i) => (
              <RankRow key={c.clientId ?? i} rank={i + 1} clientId={c.clientId} name={c.clientName}
                secondary={`${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""}`}
                badge={formatCurrency(c.avgTicket)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Maior Valor Médio por Item */}
      <SectionCard
        icon={<div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20"><BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /></div>}
        title="Maior Valor Médio por Item"
      >
        {isLoading ? <EmptyState message="Carregando..." /> : !highestAvgItemValue.length ? (
          <EmptyState message="Nenhum dado disponível." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {highestAvgItemValue.map((c, i) => (
              <RankRow key={c.clientId ?? i} rank={i + 1} clientId={c.clientId} name={c.clientName}
                secondary={`${c.itemCount} item${c.itemCount !== 1 ? "ns" : ""}`}
                badge={formatCurrency(c.avgItemValue)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Carteira / Positivação */}
      <PortfolioKpiCard stats={portfolioStats} newClientsCount={newClients.length} />

      {/* Clientes Inativos */}
      <SectionCard
        icon={<div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20"><UserX className="h-4 w-4 text-red-600 dark:text-red-400" /></div>}
        title="Clientes Inativos"
        badge={inactiveClients.length}
      >
        {isLoading ? <EmptyState message="Carregando..." /> : !inactiveClients.length ? (
          <EmptyState message="Nenhum cliente inativo." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {inactiveClients.map((c) => (
              <ClientLink key={c.clientId} clientId={c.clientId}>
                <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.clientName}</p>
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                    {c.daysSincePurchase != null ? `${c.daysSincePurchase}d sem compra` : "Sem registro"}
                  </Badge>
                </div>
              </ClientLink>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Novos Clientes no Período */}
      <SectionCard
        icon={<div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/20"><UserPlus className="h-4 w-4 text-green-600 dark:text-green-400" /></div>}
        title="Novos Clientes no Período"
        badge={newClients.length}
      >
        {isLoading ? <EmptyState message="Carregando..." /> : !newClients.length ? (
          <EmptyState message="Nenhum cliente novo no período." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {newClients.map((c) => (
              <ClientLink key={c.clientId} clientId={c.clientId}>
                <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.clientName}</p>
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    {format(new Date(c.createdAt), "dd/MM/yy")}
                  </Badge>
                </div>
              </ClientLink>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── PortfolioKpiCard ─────────────────────────────────────────────────────────

function PortfolioKpiCard({
  stats,
  newClientsCount,
}: {
  stats: { total: number; active: number; inactive: number; positivacao: number };
  newClientsCount: number;
}) {
  const [open, setOpen] = useState(false);
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
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={`p-2 rounded-xl ${iconBg} shrink-0`}>
          <TrendingUp className={`h-4 w-4 ${pctColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Carteira de Clientes</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Positivação e distribuição da base</p>
        </div>
        <span className={`text-sm font-black tabular-nums shrink-0 ${pctColor}`}>
          {stats.positivacao.toFixed(1)}%
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total</p>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100">{stats.total}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-red-500 dark:text-red-400 mb-1">Inativos</p>
              <p className="text-xl font-black text-red-600 dark:text-red-400">{stats.inactive}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Novos</p>
              <p className="text-xl font-black text-green-600 dark:text-green-400">{newClientsCount}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Positivação</span>
            <div className={`flex items-center gap-1.5 ${iconBg} px-2.5 py-1 rounded-lg`}>
              <TrendingUp className={`h-3.5 w-3.5 ${pctColor}`} />
              <span className={`text-sm font-black tabular-nums ${pctColor}`}>{stats.positivacao.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.positivacao, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${barColor}`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.active} ativo{stats.active !== 1 ? "s" : ""}</span>
            <span className="text-red-500 dark:text-red-400 font-semibold">{stats.inactive} inativo{stats.inactive !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
