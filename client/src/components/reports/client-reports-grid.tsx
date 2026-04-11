import { useState } from "react";
import { Users, PieChart as PieIcon, Tag, MapPin, ChevronDown, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ReportsDataCoverage } from "@/components/reports/reports-data-coverage";
import {
  buildClientAnalyticsDashboardUrl,
  type ClientAnalyticsFilters,
} from "@/lib/client-analytics-filters";

interface ClientReportsGridProps {
  clientsByCategory: Array<{ category: string | null; count: number }>;
  clientsByOrigin: Array<{ origin: string | null; count: number }>;
  clientsByUser: Array<{ userId: string | null; userName: string; count: number }>;
  clientsByMarkers: Array<{ marker: string; count: number }>;
  totalClients?: number;
  clientsWithEmail?: number;
  clientsWithPhone?: number;
  clientsWithCPF?: number;
  clientsWithAddress?: number;
  filterUserId?: string | null;
  search?: string;
  filters?: ClientAnalyticsFilters;
  purchaseStatusDays?: number;
  userId?: string | null;
}

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#a855f7", "#84cc16",
];

export function ClientReportsGrid({
  clientsByCategory,
  clientsByOrigin,
  clientsByUser,
  clientsByMarkers,
  totalClients = 0,
  clientsWithEmail = 0,
  clientsWithPhone = 0,
  clientsWithCPF = 0,
  clientsWithAddress = 0,
  filterUserId,
  search,
  filters,
  purchaseStatusDays,
  userId,
}: ClientReportsGridProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PieCard
          title="Por Categoria"
          description="Segmentação por tipo de cliente"
          items={clientsByCategory.map((d) => ({
            label: d.category ?? "Sem categoria",
            count: d.count,
          }))}
          icon={<PieIcon className="h-5 w-5" />}
          colorStart={0}
        />

        <PieCard
          title="Por Origem"
          description="Como os clientes chegaram até você"
          items={clientsByOrigin.map((d) => ({
            label: d.origin ?? "Sem origem",
            count: d.count,
          }))}
          icon={<MapPin className="h-5 w-5" />}
          colorStart={3}
        />

        <PieCard
          title="Por Responsável"
          description="Distribuição da carteira entre a equipe"
          items={clientsByUser.map((d) => ({
            label: d.userName || "Sem responsável",
            count: d.count,
          }))}
          icon={<Users className="h-5 w-5" />}
          colorStart={6}
        />

        <PieCard
          title="Por Marcadores"
          description="Classificação por etiquetas e tags"
          items={clientsByMarkers.map((d) => ({
            label: d.marker || "Sem marcador",
            count: d.count,
          }))}
          icon={<Tag className="h-5 w-5" />}
          colorStart={9}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopClientesCard
          filterUserId={filterUserId}
          search={search}
          filters={filters}
          purchaseStatusDays={purchaseStatusDays}
        />
        <ReportsDataCoverage
          totalClients={totalClients}
          clientsWithEmail={clientsWithEmail}
          clientsWithPhone={clientsWithPhone}
          clientsWithCPF={clientsWithCPF}
          clientsWithAddress={clientsWithAddress}
        />
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-900/10 dark:to-green-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 text-emerald-600 dark:text-emerald-400 shadow-sm">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

interface PieCardProps {
  title: string;
  description: string;
  items: Array<{ label: string; count: number }>;
  icon: React.ReactNode;
  colorStart: number;
}

function PieCard({ title, description, items, icon, colorStart }: PieCardProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  const data = sorted.map((item, i) => ({
    name: item.label,
    value: item.count,
    color: PALETTE[(colorStart + i) % PALETTE.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader
          className="pb-3 pt-3 px-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2 text-slate-600 dark:text-slate-300 shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {description}
              </CardDescription>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </div>
        </CardHeader>
        {open && (
          <CardContent className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {data.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400 italic">Nenhum dado disponível</p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1.5 min-w-0">
                  {data.map((entry) => {
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                    return (
                      <div key={entry.name} className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{entry.name}</span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                          {entry.value} <span className="text-slate-400">({pct}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="shrink-0 w-[150px] h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={68} paddingAngle={3} dataKey="value">
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const entry = payload[0];
                          const pct = total > 0 ? (((entry.value as number) / total) * 100).toFixed(1) : "0";
                          return (
                            <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", padding: "6px 10px", fontSize: 11 }}>
                              <p style={{ fontWeight: 700, marginBottom: 2, color: entry.payload.color }}>{entry.name}</p>
                              <p style={{ color: "#475569" }}>{entry.value} clientes ({pct}%)</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Top Clientes ─────────────────────────────────────────────────────────��───

interface TopClientRow {
  clientId: string | null;
  clientName: string | null;
  orderCount: number;
  totalValue: number;
}

function TopClientesCard({
  filterUserId,
  search,
  filters,
  purchaseStatusDays,
}: {
  filterUserId?: string | null;
  search?: string;
  filters?: ClientAnalyticsFilters;
  purchaseStatusDays?: number;
}) {
function TopClientesCard({ userId }: { userId?: string | null }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const startDate = format(startOfMonth(now), "yyyy-MM-dd");
  const endDate = format(endOfMonth(now), "yyyy-MM-dd");
  const queryUrl = buildClientAnalyticsDashboardUrl({
    startDate,
    endDate,
    filterUserId,
    search,
    filters,
    purchaseStatusDays,
  });

  const params = new URLSearchParams({ startDate, endDate });
  if (userId) params.set("userId", userId);

  const { data, isLoading } = useQuery<{ topClients: TopClientRow[] }>({
    queryKey: [queryUrl],
  });

  const topClients = data?.topClients ?? [];

  return (
    <Card className="border-gray-200 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-950">
      <CardHeader
        className="pb-3 pt-3 px-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 shrink-0">
            <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              Top Clientes do Mês
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Clientes com maior valor no mês atual
            </CardDescription>
          </div>
          {topClients.length > 0 && (
            <Badge variant="secondary" className="text-xs font-bold shrink-0">{topClients.length}</Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-2 pb-4 px-4 border-t border-slate-100 dark:border-slate-800">
          {isLoading ? (
            <p className="text-sm text-slate-400 text-center py-6">Carregando...</p>
          ) : !topClients.length ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma venda registrada.</p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {topClients.map((c, i) => {
                const content = (
                  <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="w-6 text-center text-xs font-black text-slate-400">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.clientName ?? "—"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.orderCount} pedido{c.orderCount !== 1 ? "s" : ""}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{formatCurrency(c.totalValue)}</Badge>
                  </div>
                );
                return c.clientId ? (
                  <Link key={c.clientId ?? i} href={`/clientes/${c.clientId}`}>{content}</Link>
                ) : (
                  <div key={i}>{content}</div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
