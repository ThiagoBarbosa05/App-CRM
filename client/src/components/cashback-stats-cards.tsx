import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

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
  index: number;
  themeColor: "emerald" | "blue" | "purple";
}> = ({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
  skeletonWidth = "w-24",
  index,
  themeColor,
}) => {
  const themeClasses = {
    emerald: {
      card: "shadow-emerald-500/5 hover:shadow-emerald-500/10",
      gradient: "from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/10",
      iconContainer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20",
      border: "border-emerald-100/50 dark:border-emerald-800/30",
    },
    blue: {
      card: "shadow-blue-500/5 hover:shadow-blue-500/10",
      gradient: "from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 dark:to-indigo-500/10",
      iconContainer: "bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20",
      border: "border-blue-100/50 dark:border-blue-800/30",
    },
    purple: {
      card: "shadow-purple-500/5 hover:shadow-purple-500/10",
      gradient: "from-purple-500/10 to-fuchsia-500/5 dark:from-purple-500/20 dark:to-fuchsia-500/10",
      iconContainer: "bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/20",
      border: "border-purple-100/50 dark:border-purple-800/30",
    },
  };

  const theme = themeClasses[themeColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card
        className={`group relative overflow-hidden transition-all duration-300 border shadow-xl bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl ${theme.border} ${theme.card} hover:-translate-y-1`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        
        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-sm font-bold tracking-tight text-slate-500 dark:text-slate-400 uppercase">
            {title}
          </CardTitle>
          <div className={`rounded-xl p-2.5 ${theme.iconContainer} transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="relative pb-6">
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className={`h-8 bg-slate-200 dark:bg-slate-800 rounded ${skeletonWidth}`}></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded w-3/4"></div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {value}
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors uppercase tracking-widest">
                {description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
      <StatCard
        index={0}
        title="Total em Cashback"
        value={formatCurrency(totalCashback)}
        description="Distribuído aos clientes"
        icon={DollarSign}
        isLoading={isLoading}
        skeletonWidth="w-32"
        themeColor="emerald"
      />

      <StatCard
        index={1}
        title="Clientes Ativos"
        value={activeClients}
        description="Com saldo pendente"
        icon={Users}
        isLoading={isLoading}
        skeletonWidth="w-20"
        themeColor="blue"
      />

      <StatCard
        index={2}
        title="Taxa Média"
        value={`${averageRate.toFixed(1)}%`}
        description="De retorno operacional"
        icon={TrendingUp}
        isLoading={isLoading}
        themeColor="purple"
      />
    </div>
  );
};
