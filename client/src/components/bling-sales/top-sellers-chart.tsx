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
import type { TopSeller } from "@/hooks/use-bling-orders";

interface TopSellersChartProps {
  data?: TopSeller[];
  isLoading: boolean;
}

export function TopSellersChart({ data, isLoading }: TopSellersChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Top Vendedores</CardTitle>
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
      name: item.sellerName || "Não informado",
      value: parseFloat(item.totalValue),
      orders: item.totalOrders,
    })) || [];

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Top Vendedores</CardTitle>
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
                  width={100}
                  tick={{ fontSize: 12 }}
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
                  fill="#9333ea"
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
