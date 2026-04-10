import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Trophy,
  BarChart2,
  UserX,
  UserPlus,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

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

interface AggregateData {
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
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
  return (
    <div className="bg-white dark:bg-slate-950 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex-1">{title}</h3>
        {badge !== undefined && badge > 0 && (
          <Badge variant="secondary" className="text-xs">{badge}</Badge>
        )}
      </div>
      {children}
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

  return (
    <Tabs defaultValue="ranking" className="space-y-4">
      <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md">
        <TabsList className="grid w-full grid-cols-3 rounded-lg bg-slate-50 dark:bg-slate-900">
          <TabsTrigger
            value="ranking"
            className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
              data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-amber-200 dark:data-[state=active]:border-amber-800
              hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
          >
            <Trophy className="h-4 w-4 shrink-0" />
            <span className="truncate">Ranking</span>
          </TabsTrigger>

          <TabsTrigger
            value="ticket"
            className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
              data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800
              hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
          >
            <BarChart2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Ticket / Item</span>
          </TabsTrigger>

          <TabsTrigger
            value="carteira"
            className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
              data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800
              hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            <span className="truncate">Carteira</span>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* ── Ranking ─────────────────────────────────────────────────────────── */}
      <TabsContent value="ranking" className="m-0 outline-none">
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
      </TabsContent>

      {/* ── Ticket / Item ───────────────────────────────────────────────────── */}
      <TabsContent value="ticket" className="m-0 outline-none space-y-4">
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
      </TabsContent>

      {/* ── Carteira ────────────────────────────────────────────────────────── */}
      <TabsContent value="carteira" className="m-0 outline-none space-y-4">
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
      </TabsContent>
    </Tabs>
  );
}
