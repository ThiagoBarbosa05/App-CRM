import { formatCurrency } from "@/lib/utils";
import { SalesEvolutionPoint } from "@/hooks/use-bling-orders";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp } from "lucide-react";

interface SalesEvolutionChartProps {
  data?: SalesEvolutionPoint[];
  isLoading: boolean;
  groupBy?: "day" | "week" | "month";
}

export function SalesEvolutionChart({
  data = [],
  isLoading,
  groupBy = "day",
}: SalesEvolutionChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-blue-50 dark:bg-blue-900/30 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[300px] bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Evolução de Vendas
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Desempenho ao longo do tempo
            </p>
          </div>
        </div>
        <div className="flex h-[300px] items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
          Nenhum dado disponível para o período selecionado
        </div>
      </div>
    );
  }

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    switch (groupBy) {
      case "month":
        return format(date, "MMM/yy", { locale: ptBR });
      case "week":
      case "day":
      default:
        return format(date, "dd/MM", { locale: ptBR });
    }
  };

  const chartData = data.map((point) => ({
    date: formatDateLabel(point.date),
    fullDate: point.date,
    pedidos: point.totalOrders,
    valor: point.totalValue,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            {formatDateLabel(payload[0].payload.fullDate)}
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {payload[0]?.value ?? 0} pedidos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {formatCurrency(payload[1]?.value ?? 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const xAxisInterval =
    data.length > 30
      ? Math.floor(data.length / 15)
      : data.length > 15
        ? Math.floor(data.length / 10)
        : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Evolução de Vendas
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Desempenho ao longo do tempo
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500" /> Pedidos
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" /> Valor
          </span>
        </div>
      </div>
      <div className="px-2 pb-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="pedidosGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="valorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fontWeight: 700, fill: "currentColor" }}
                className="text-slate-400"
                interval={xAxisInterval}
                angle={data.length > 20 ? -40 : 0}
                textAnchor={data.length > 20 ? "end" : "middle"}
                height={data.length > 20 ? 55 : 28}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fontWeight: 700, fill: "currentColor" }}
                className="text-slate-400"
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fontWeight: 700, fill: "currentColor" }}
                className="text-slate-400"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="pedidos"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#pedidosGrad)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#3b82f6" }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="valor"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#valorGrad)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#10b981" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
