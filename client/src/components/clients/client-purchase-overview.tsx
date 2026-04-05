import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle, TrendingDown, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";

interface ClientPurchaseOverviewProps {
  data: ClientPurchaseInsightsResponse;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const chartConfig = {
  receita: {
    label: "Receita",
    color: "hsl(262, 83%, 58%)",
  },
} satisfies ChartConfig;

function getRiskBadge(status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"]) {
  switch (status) {
    case "dentro_do_ciclo":
      return { label: "Sem Risco", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    case "atencao":
      return { label: "Atencao", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
    case "risco_de_queda":
    case "reativacao":
      return { label: "Risco Alto", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" };
    default:
      return { label: "Sem Base", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
  }
}

export function ClientPurchaseOverview({ data }: ClientPurchaseOverviewProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const monthlyData = useMemo(() => {
    const monthMap = new Map<number, number>();
    MONTHS.forEach((_, i) => monthMap.set(i, 0));

    data.purchaseHistory.data.forEach((order) => {
      try {
        const date = parseISO(`${order.saleDate}T12:00:00`);
        if (date.getFullYear() === selectedYear) {
          const month = date.getMonth();
          monthMap.set(month, (monthMap.get(month) ?? 0) + order.totalValue);
        }
      } catch {
        // skip unparseable dates
      }
    });

    return MONTHS.map((month, index) => ({
      month,
      receita: monthMap.get(index) ?? 0,
    }));
  }, [data.purchaseHistory.data, selectedYear]);

  const riskBadge = getRiskBadge(data.predictiveAnalysis.status);
  const hasVolumeData = data.purchaseHistory.data.length > 0;
  const hasEnoughOrders = data.summary.purchaseCount >= 3;

  return (
    <div className="space-y-8">
      {/* FATURAMENTO MENSAL */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Faturamento Mensal
        </h2>
        <Card className="mt-3 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Receita Mensal &mdash; {selectedYear}
              </p>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart
                data={monthlyData}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums">
                          {formatCurrency(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="receita"
                  fill="var(--color-receita)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      {/* COMPARATIVO ANUAL */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Comparativo Anual
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Card className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Ultimos 12 meses
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatCurrency(data.summary.totalPurchased)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {data.summary.purchaseCount} pedido(s)
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                12 meses anteriores
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                R$ 0,00
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                0 pedido(s)
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* INDICADORES DE RISCO */}
      <section>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
            Indicadores de Risco
          </h2>
          <Badge className={`border-0 text-xs font-semibold ${riskBadge.className}`}>
            {riskBadge.label}
          </Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <RiskIndicatorCard
            icon={TrendingDown}
            label="Queda de volume (3 meses)"
            description={
              hasVolumeData
                ? "Monitorando variacoes de volume"
                : "Sem dados do periodo anterior"
            }
          />
          <RiskIndicatorCard
            icon={Package}
            label="Ausencia de pedidos"
            description={
              hasEnoughOrders
                ? `${data.predictiveAnalysis.daysSinceLastPurchase ?? 0} dias desde o ultimo pedido`
                : "Dados insuficientes"
            }
          />
          <RiskIndicatorCard
            icon={AlertTriangle}
            label="Reducao de mix"
            description={
              data.inactiveProducts.length > 0
                ? `${data.inactiveProducts.length} produto(s) em risco`
                : "Sem dados do periodo anterior"
            }
          />
        </div>
      </section>
    </div>
  );
}

function RiskIndicatorCard({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" />
      <div className="flex items-start gap-3 pl-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30">
          <Icon className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
