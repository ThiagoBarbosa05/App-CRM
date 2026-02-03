import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { SalesEvolutionPoint } from "@/hooks/use-bling-orders";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp } from "lucide-react";

interface SalesEvolutionChartProps {
  data?: SalesEvolutionPoint[];
  isLoading: boolean;
  groupBy?: 'day' | 'week' | 'month';
}

export function SalesEvolutionChart({
  data = [],
  isLoading,
  groupBy = 'day',
}: SalesEvolutionChartProps) {
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Evolução de Vendas
          </CardTitle>
          <CardDescription>
            Acompanhe o desempenho de vendas ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  // Formatar datas para exibição
  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    switch (groupBy) {
      case 'month':
        return format(date, "MMM/yy", { locale: ptBR });
      case 'week':
        return format(date, "dd/MM", { locale: ptBR });
      case 'day':
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">
            {formatDateLabel(payload[0].payload.fullDate)}
          </p>
          <p className="text-sm text-blue-600 font-medium">
            Pedidos: {payload[0].value}
          </p>
          <p className="text-sm text-green-600 font-medium">
            Valor: {formatCurrency(payload[1].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Determinar o intervalo do eixo X baseado na quantidade de dados
  const xAxisInterval = data.length > 30 ? Math.floor(data.length / 15) : data.length > 15 ? Math.floor(data.length / 10) : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Evolução de Vendas
        </CardTitle>
        <CardDescription>
          Acompanhe o desempenho de vendas ao longo do tempo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              interval={xAxisInterval}
              angle={data.length > 20 ? -45 : 0}
              textAnchor={data.length > 20 ? "end" : "middle"}
              height={data.length > 20 ? 60 : 30}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              label={{
                value: "Pedidos",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              label={{
                value: "Valor (R$)",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 12 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "14px", paddingTop: "10px" }}
              iconType="line"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="pedidos"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name="Pedidos"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="valor"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name="Valor Total"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
