import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { TopProduct } from "@/hooks/use-bling-orders";
import { ShoppingBag } from "lucide-react";

interface TopProductsChartProps {
  data?: TopProduct[];
  isLoading: boolean;
}

const PRODUCT_COLORS = ["#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe"];

export function TopProductsChart({ data, isLoading }: TopProductsChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-sky-50 dark:bg-sky-900/30 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[220px] bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const chartData =
    data?.map((item) => ({
      name: item.description,
      value: parseFloat(item.totalValue),
      quantity: parseInt(item.totalQuantity),
    })) || [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 max-w-[160px] truncate">
            {payload[0].payload.name}
          </p>
          <p className="text-sm font-black text-sky-600 dark:text-sky-400">
            {formatCurrency(payload[0].value)}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {payload[0].payload.quantity} unid.
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-2xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Top Produtos
          </h3>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            Ranking por valor de vendas
          </p>
        </div>
      </div>
      <div className="px-2 pb-6">
        {chartData.length > 0 ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
              >
                <XAxis type="number" hide axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  className="text-slate-500 dark:text-slate-400"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) =>
                    v.length > 14 ? `${v.substring(0, 14)}…` : v
                  }
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(14,165,233,0.06)" }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
            Nenhum dado disponível
          </div>
        )}
      </div>
    </div>
  );
}
