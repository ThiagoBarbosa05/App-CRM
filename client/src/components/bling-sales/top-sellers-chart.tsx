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
import type { TopSeller } from "@/hooks/use-bling-orders";
import { Users } from "lucide-react";

interface TopSellersChartProps {
  data?: TopSeller[];
  isLoading: boolean;
}

const SELLER_COLORS = ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

export function TopSellersChart({ data, isLoading }: TopSellersChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-44 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
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
      name: item.sellerName || "Não informado",
      value: parseFloat(item.totalValue),
      orders: item.totalOrders,
    })) || [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
            {payload[0].payload.name}
          </p>
          <p className="text-sm font-black text-violet-600 dark:text-violet-400">
            {formatCurrency(payload[0].value)}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {payload[0].payload.orders} pedidos
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
          <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Top Vendedores
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
                  width={90}
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  className="text-slate-500 dark:text-slate-400"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) =>
                    v.length > 12 ? `${v.substring(0, 12)}…` : v
                  }
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(124,58,237,0.06)" }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={SELLER_COLORS[index % SELLER_COLORS.length]}
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
