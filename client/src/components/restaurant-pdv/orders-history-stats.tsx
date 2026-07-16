import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ClipboardList, DollarSign, Receipt } from "lucide-react";
import type { RestaurantOrder } from "@shared/schema";

interface DailySummary {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
}

interface OrdersHistoryStatsProps {
  orders: RestaurantOrder[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrdersHistoryStats({ orders }: OrdersHistoryStatsProps) {
  const openOrdersCount = orders.filter((o) => o.status === "aberta").length;

  const { data: summary } = useQuery<DailySummary>({
    queryKey: ["/api/restaurant-pdv/reports/daily-summary"],
  });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={ClipboardList}
        label="Comandas abertas agora"
        value={String(openOrdersCount)}
        color="text-emerald-600 dark:text-emerald-400"
        bg="bg-emerald-50 dark:bg-emerald-900/30"
      />
      <StatCard
        icon={DollarSign}
        label="Faturamento do dia"
        value={formatCurrency(summary?.totalRevenue ?? 0)}
        color="text-blue-600 dark:text-blue-400"
        bg="bg-blue-50 dark:bg-blue-900/30"
      />
      <StatCard
        icon={Receipt}
        label="Ticket médio hoje"
        value={formatCurrency(summary?.averageTicket ?? 0)}
        color="text-violet-600 dark:text-violet-400"
        bg="bg-violet-50 dark:bg-violet-900/30"
      />
    </div>
  );
}
