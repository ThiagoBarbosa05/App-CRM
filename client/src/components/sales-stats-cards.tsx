import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign, Percent } from "lucide-react";

interface SalesStatistics {
  salesCount: number;
  totalSales: number;
  totalCashbackUsed: number;
  totalCashbackGenerated: number;
  netValue: number;
  averageSaleValue: number;
  period: string;
}

interface SalesStatsCardsProps {
  statistics: SalesStatistics | undefined;
  isLoading: boolean;
  formatCurrency: (value: string | number) => string;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  skeletonWidth?: string;
  valueColor?: string;
  iconColor?: string;
  skeletonColor?: string;
}> = ({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
  skeletonWidth = "w-24",
  valueColor = "text-slate-900 dark:text-slate-100",
  iconColor = "text-slate-500 dark:text-slate-400",
  skeletonColor = "bg-slate-200 dark:bg-slate-700",
}) => (
  <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg hover:shadow-slate-200/20 dark:hover:shadow-slate-900/20 transition-all duration-200 bg-white dark:bg-slate-950">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {title}
      </CardTitle>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="animate-pulse">
          <div
            className={`h-8 ${skeletonColor} rounded ${skeletonWidth}`}
          ></div>
        </div>
      ) : (
        <div className={`text-xl sm:text-2xl font-bold ${valueColor}`}>
          {value}
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {description}
      </p>
    </CardContent>
  </Card>
);

export const SalesStatsCards: React.FC<SalesStatsCardsProps> = ({
  statistics,
  isLoading,
  formatCurrency,
}) => {
  const salesCount = statistics?.salesCount ?? 0;
  const totalSales = statistics?.totalSales ?? 0;
  const totalCashbackUsed = statistics?.totalCashbackUsed ?? 0;
  const totalCashbackGenerated = statistics?.totalCashbackGenerated ?? 0;
  const netValue = statistics?.netValue ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <StatCard
        title="Total de Vendas"
        value={salesCount}
        description="Últimos 30 dias"
        icon={Receipt}
        isLoading={isLoading}
        skeletonWidth="w-16"
        valueColor="text-blue-600 dark:text-blue-400"
        iconColor="text-blue-500 dark:text-blue-400"
        skeletonColor="bg-blue-100 dark:bg-blue-900/30"
      />

      <StatCard
        title="Valor Total Bruto"
        value={formatCurrency(totalSales)}
        description="Últimos 30 dias"
        icon={DollarSign}
        isLoading={isLoading}
        skeletonWidth="w-24"
        valueColor="text-slate-900 dark:text-slate-100"
        iconColor="text-emerald-500 dark:text-emerald-400"
        skeletonColor="bg-slate-200 dark:bg-slate-700"
      />

      <StatCard
        title="Valor Líquido"
        value={formatCurrency(netValue)}
        description="Últimos 30 dias"
        icon={DollarSign}
        isLoading={isLoading}
        skeletonWidth="w-24"
        valueColor="text-slate-900 dark:text-slate-100"
        iconColor="text-slate-500 dark:text-slate-400"
        skeletonColor="bg-slate-200 dark:bg-slate-700"
      />

      <StatCard
        title="Cashback Utilizado"
        value={formatCurrency(totalCashbackUsed)}
        description="Últimos 30 dias"
        icon={Percent}
        isLoading={isLoading}
        skeletonWidth="w-24"
        valueColor="text-orange-600 dark:text-orange-400"
        iconColor="text-orange-500 dark:text-orange-400"
        skeletonColor="bg-orange-100 dark:bg-orange-900/30"
      />

      <StatCard
        title="Cashback Gerado"
        value={formatCurrency(totalCashbackGenerated)}
        description="Últimos 30 dias"
        icon={Percent}
        isLoading={isLoading}
        skeletonWidth="w-24"
        valueColor="text-emerald-600 dark:text-emerald-400"
        iconColor="text-emerald-500 dark:text-emerald-400"
        skeletonColor="bg-emerald-100 dark:bg-emerald-900/30"
      />
    </div>
  );
};
