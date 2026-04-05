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
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const chartConfig = {
  receita: {
    label: "Receita",
    color: "hsl(38, 92%, 50%)",
  },
} satisfies ChartConfig;

function getRiskBadge(
  status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"],
) {
  switch (status) {
    case "dentro_do_ciclo":
      return {
        label: "Sem Risco",
        className:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      };
    case "atencao":
      return {
        label: "Atencao",
        className:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      };
    case "risco_de_queda":
    case "reativacao":
      return {
        label: "Risco Alto",
        className:
          "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
      };
    default:
      return {
        label: "Sem Base",
        className:
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      };
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
    <div className="space-y-6">
      {/* FATURAMENTO MENSAL */}
      <section>
        <div className="flex items-center gap-3 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Faturamento Mensal
          </h2>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>
        <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
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
                    value >= 1000
                      ? `${(value / 1000).toFixed(0)}k`
                      : String(value)
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
        <div className="flex items-center gap-3 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Comparativo Anual
          </h2>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="relative overflow-hidden rounded-xl border-amber-200/60 bg-white shadow-sm dark:border-amber-800/30 dark:bg-slate-900">
            <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-gradient-to-b from-amber-300 to-amber-500" />
            <CardContent className="p-5 pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Ultimos 12 meses
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formatCurrency(data.summary.totalPurchased)}
              </p>
              <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
                {data.summary.purchaseCount} pedido(s)
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden rounded-xl border-slate-200/80 bg-slate-50/50 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700" />
            <CardContent className="p-5 pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                12 meses anteriores
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-500 dark:text-slate-400">
                R$ 0,00
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                0 pedido(s)
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* INDICADORES DE RISCO */}
      <section>
        <div className="flex items-center gap-3 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Indicadores de Risco
          </h2>
          <Badge
            className={`border-0 text-xs font-semibold ${riskBadge.className}`}
          >
            {riskBadge.label}
          </Badge>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <RiskIndicatorCard
            icon={TrendingDown}
            label="Queda de volume (3 meses)"
            severity={hasVolumeData ? "warning" : "neutral"}
            description={
              hasVolumeData
                ? "Monitorando variacoes de volume"
                : "Sem dados do periodo anterior"
            }
          />
          <RiskIndicatorCard
            icon={Package}
            label="Ausencia de pedidos"
            severity={
              hasEnoughOrders
                ? data.predictiveAnalysis.daysSinceLastPurchase !== null &&
                  data.predictiveAnalysis.daysSinceLastPurchase > 60
                  ? "danger"
                  : "ok"
                : "neutral"
            }
            description={
              hasEnoughOrders
                ? `${data.predictiveAnalysis.daysSinceLastPurchase ?? 0} dias desde o ultimo pedido`
                : "Dados insuficientes"
            }
          />
          <RiskIndicatorCard
            icon={AlertTriangle}
            label="Reducao de mix"
            severity={data.inactiveProducts.length > 0 ? "danger" : "ok"}
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

const riskSeverityStyles = {
  ok: {
    border: "border-emerald-200/60 dark:border-emerald-800/30",
    accent: "bg-gradient-to-b from-emerald-300 to-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
    icon: "text-emerald-500",
  },
  warning: {
    border: "border-amber-200/60 dark:border-amber-800/30",
    accent: "bg-gradient-to-b from-amber-300 to-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    icon: "text-amber-500",
  },
  danger: {
    border: "border-rose-200/60 dark:border-rose-800/30",
    accent: "bg-gradient-to-b from-rose-300 to-rose-500",
    iconBg: "bg-rose-50 dark:bg-rose-900/20",
    icon: "text-rose-500",
  },
  neutral: {
    border: "border-slate-200/80 dark:border-slate-800/80",
    accent:
      "bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
    iconBg: "bg-slate-50 dark:bg-slate-800/50",
    icon: "text-slate-400",
  },
};

function RiskIndicatorCard({
  icon: Icon,
  label,
  description,
  severity = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  severity?: "ok" | "warning" | "danger" | "neutral";
}) {
  const styles = riskSeverityStyles[severity];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${styles.border}`}
    >
      <div
        className={`absolute bottom-0 left-0 top-0 w-[3px] ${styles.accent}`}
      />
      <div className="flex items-start gap-3 pl-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.iconBg}`}
        >
          <Icon className={`h-3.5 w-3.5 ${styles.icon}`} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
