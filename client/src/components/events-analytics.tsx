import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import {
  TrendingUpIcon,
  UsersIcon,
  PieChartIcon,
  BarChart2Icon,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface AnalyticsData {
  revenueByMonth: { month: string; label: string; eventRevenue: number; wineRevenue: number; total: number }[];
  topClients: { clientId: string; name: string; fullName: string; eventCount: number; totalPeople: number }[];
  statusDistribution: { status: string; label: string; total: number }[];
  eventOccupancy: { name: string; fullName: string; date: string; participantCount: number; maxCapacity: number; occupancyPct: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pago: "#22c55e",
  convidado: "#6366f1",
  pendente: "#f59e0b",
  pagar_na_hora: "#3b82f6",
};

const PIE_COLORS = ["#22c55e", "#6366f1", "#f59e0b", "#3b82f6", "#ef4444"];

const formatBRL = (v: number) =>
  v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;

const CustomRevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const evento = payload.find((p: any) => p.dataKey === "eventRevenue")?.value ?? 0;
  const vinho = payload.find((p: any) => p.dataKey === "wineRevenue")?.value ?? 0;
  const total = payload.find((p: any) => p.dataKey === "total")?.value ?? 0;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-orange-600">Evento: {formatCurrency(evento)}</p>
      {vinho > 0 && <p className="text-purple-600">Vinho: {formatCurrency(vinho)}</p>}
      <p className="text-slate-800 dark:text-white font-bold border-t border-slate-200 dark:border-slate-600 mt-1 pt-1">
        Total: {formatCurrency(total)}
      </p>
    </div>
  );
};

const CustomOccupancyTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{d.fullName}</p>
      <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{d.date}</p>
      <p className="text-blue-600">{d.participantCount} / {d.maxCapacity} pessoas</p>
      <p className="font-bold text-slate-800 dark:text-white">{d.occupancyPct}% de ocupação</p>
    </div>
  );
};

const CustomClientTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{d.fullName}</p>
      <p className="text-orange-600">{d.eventCount} evento{d.eventCount !== 1 ? "s" : ""}</p>
      <p className="text-slate-500 dark:text-slate-400">{d.totalPeople} pessoas no total</p>
    </div>
  );
};

function ClickableYAxisTick({ x, y, payload, clients, onNavigate }: any) {
  const client = clients?.find((c: any) => c.name === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill={client ? "#f97316" : "#64748b"}
        fontSize={11}
        style={{ cursor: client ? "pointer" : "default", textDecoration: client ? "underline" : "none" }}
        onClick={() => client && onNavigate(`/clientes/${client.clientId}`)}
      >
        {payload.value}
      </text>
    </g>
  );
}

export default function EventsAnalytics() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["/api/events/analytics"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-3 text-slate-500">Carregando análises...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Não foi possível carregar as análises.
      </div>
    );
  }

  const totalRevenue = data.revenueByMonth.reduce((s, r) => s + r.total, 0);
  const totalParticipants = data.statusDistribution.reduce((s, r) => s + r.total, 0);
  const avgOccupancy =
    data.eventOccupancy.length > 0
      ? data.eventOccupancy.reduce((s, r) => s + r.occupancyPct, 0) / data.eventOccupancy.length
      : 0;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-orange-100 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <TrendingUpIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receita Total</p>
              <p className="text-lg font-bold text-orange-700 dark:text-orange-400">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <UsersIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total de Participantes</p>
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{totalParticipants} pessoas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <BarChart2Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ocupação Média</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {data.eventOccupancy.length > 0 ? `${avgOccupancy.toFixed(1)}%` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1. Receita mês a mês */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
            <TrendingUpIcon className="h-4 w-4 text-orange-500" />
            Receita Mês a Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenueByMonth.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhum dado de receita disponível.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.revenueByMonth} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tickFormatter={formatBRL} tick={{ fontSize: 11, fill: "#64748b" }} width={56} />
                <Tooltip content={<CustomRevenueTooltip />} />
                <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="eventRevenue" name="Receita Evento" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                <Bar dataKey="wineRevenue" name="Venda de Vinhos" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#1e293b"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#1e293b" }}
                  strokeDasharray="4 2"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2 + 3 em linha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Clientes mais assíduos */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
              <UsersIcon className="h-4 w-4 text-orange-500" />
              Clientes Mais Assíduos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topClients.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Nenhum dado disponível.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  layout="vertical"
                  data={data.topClients}
                  margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={<ClickableYAxisTick clients={data.topClients} onNavigate={navigate} />}
                  />
                  <Tooltip content={<CustomClientTooltip />} />
                  <Bar
                    dataKey="eventCount"
                    name="Eventos"
                    fill="#f97316"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(entry: any) => entry?.clientId && navigate(`/clientes/${entry.clientId}`)}
                  >
                    <LabelList dataKey="eventCount" position="right" style={{ fontSize: 11, fill: "#64748b" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Distribuição de status */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
              <PieChartIcon className="h-4 w-4 text-orange-500" />
              Distribuição de Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusDistribution.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Nenhum dado disponível.</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.statusDistribution}
                      dataKey="total"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {data.statusDistribution.map((entry, i) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] ?? PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v} pessoas`, name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3">
                  {data.statusDistribution.map((entry, i) => (
                    <div key={entry.status} className="flex items-center gap-1.5 text-sm">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[entry.status] ?? PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-600 dark:text-slate-300">
                        {entry.label}:
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {entry.total}
                      </span>
                      <span className="text-slate-400 text-xs">
                        ({Math.round((entry.total / totalParticipants) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Ocupação dos eventos */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
            <BarChart2Icon className="h-4 w-4 text-orange-500" />
            Ocupação dos Eventos
            <span className="text-xs font-normal text-slate-400 ml-1">(apenas eventos com capacidade máxima definida)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.eventOccupancy.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">
              Nenhum evento com capacidade máxima definida.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, data.eventOccupancy.length * 42)}>
              <BarChart
                layout="vertical"
                data={data.eventOccupancy}
                margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={130} />
                <Tooltip content={<CustomOccupancyTooltip />} />
                <Bar dataKey="occupancyPct" name="Ocupação" radius={[0, 4, 4, 0]}>
                  {data.eventOccupancy.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.occupancyPct >= 90
                          ? "#22c55e"
                          : entry.occupancyPct >= 60
                          ? "#3b82f6"
                          : entry.occupancyPct >= 30
                          ? "#f59e0b"
                          : "#ef4444"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="occupancyPct"
                    position="right"
                    formatter={(v: number) => `${v}%`}
                    style={{ fontSize: 11, fill: "#64748b" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {data.eventOccupancy.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> ≥90% lotado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> 60-89%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> 30-59%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> &lt;30%</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
