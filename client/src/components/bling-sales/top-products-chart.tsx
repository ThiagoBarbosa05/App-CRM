import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { TopProduct } from "@/hooks/use-bling-orders";

interface TopProductsChartProps {
  data?: TopProduct[];
  isLoading: boolean;
}

export function TopProductsChart({ data, isLoading }: TopProductsChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Top Produtos</CardTitle>
          <CardDescription>Ranking por valor de vendas</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData =
    data?.map((item) => ({
      name: item.description,
      value: parseFloat(item.totalValue),
      quantity: parseInt(item.totalQuantity),
    })) || [];

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Top Produtos</CardTitle>
        <CardDescription>Ranking por valor de vendas</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    value.length > 20 ? `${value.substring(0, 20)}...` : value
                  }
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    "Vendas",
                  ]}
                  labelStyle={{ color: "black" }}
                />
                <Bar
                  dataKey="value"
                  fill="#0ea5e9" // Sky blue distinct from sellers chart
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        )}
      </CardContent>
    </Card>
  );
}
