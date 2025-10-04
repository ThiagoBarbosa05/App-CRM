import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp } from "lucide-react";

interface CashbackStatistics {
  totalCashback: number;
  activeClients: number;
  averageRate: number;
  totalClients: number;
  totalTransactions: number;
  totalSettings: number;
}

interface CashbackStatsCardsProps {
  statistics: CashbackStatistics | undefined;
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
  themeColor: "emerald" | "blue" | "purple";
}> = ({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
  skeletonWidth = "w-24",
  themeColor,
}) => {
  const themeClasses = {
    emerald: {
      card: "bg-gradient-to-br from-white to-emerald-50/30 dark:from-gray-900 dark:to-emerald-900/10",
      title: "text-emerald-800 dark:text-emerald-200",
      iconContainer:
        "bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40",
      icon: "text-emerald-600 dark:text-emerald-400",
      description: "text-emerald-600/70 dark:text-emerald-400/70",
      skeleton: "bg-emerald-200 dark:bg-emerald-800/30",
      skeletonSecondary: "bg-emerald-100 dark:bg-emerald-800/20",
    },
    blue: {
      card: "bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10",
      title: "text-blue-800 dark:text-blue-200",
      iconContainer:
        "bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40",
      icon: "text-blue-600 dark:text-blue-400",
      description: "text-blue-600/70 dark:text-blue-400/70",
      skeleton: "bg-blue-200 dark:bg-blue-800/30",
      skeletonSecondary: "bg-blue-100 dark:bg-blue-800/20",
    },
    purple: {
      card: "bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-900/10",
      title: "text-purple-800 dark:text-purple-200",
      iconContainer:
        "bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40",
      icon: "text-purple-600 dark:text-purple-400",
      description: "text-purple-600/70 dark:text-purple-400/70",
      skeleton: "bg-purple-200 dark:bg-purple-800/30",
      skeletonSecondary: "bg-purple-100 dark:bg-purple-800/20",
    },
  };

  const theme = themeClasses[themeColor];

  return (
    <Card
      className={`group hover:shadow-lg transition-all duration-300 border-0 shadow-md ${theme.card}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className={`text-sm font-semibold ${theme.title}`}>
          {title}
        </CardTitle>
        <div
          className={`${theme.iconContainer} rounded-lg p-2 transition-colors`}
        >
          <Icon className={`h-4 w-4 ${theme.icon}`} />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {isLoading ? (
          <div className="animate-pulse">
            <div
              className={`h-8 ${theme.skeleton} rounded ${skeletonWidth} mb-1`}
            ></div>
            <div
              className={`h-3 ${theme.skeletonSecondary} rounded w-3/4`}
            ></div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {value}
            </div>
            <p className={`text-xs font-medium ${theme.description}`}>
              {description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const CashbackStatsCards: React.FC<CashbackStatsCardsProps> = ({
  statistics,
  isLoading,
  formatCurrency,
}) => {
  const totalCashback = statistics?.totalCashback ?? 0;
  const activeClients = statistics?.activeClients ?? 0;
  const averageRate = statistics?.averageRate ?? 0;

  return (
    <div className="grid grid-cols-1 mt-4 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
      <StatCard
        title="Total em Cashback"
        value={formatCurrency(totalCashback)}
        description="Total distribuído em cashback"
        icon={DollarSign}
        isLoading={isLoading}
        skeletonWidth="w-24"
        themeColor="emerald"
      />

      <StatCard
        title="Clientes Ativos"
        value={activeClients}
        description="Com saldo de cashback"
        icon={Users}
        isLoading={isLoading}
        skeletonWidth="w-16"
        themeColor="blue"
      />

      <StatCard
        title="Taxa Média"
        value={`${averageRate.toFixed(1)}%`}
        description="Taxa de cashback média"
        icon={TrendingUp}
        isLoading={isLoading}
        skeletonWidth="w-20"
        themeColor="purple"
      />
    </div>
  );
};
