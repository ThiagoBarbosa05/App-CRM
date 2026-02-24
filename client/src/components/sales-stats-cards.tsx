import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign, Percent } from "lucide-react";
import { motion } from "framer-motion";

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
  index: number;
  themeColor: "blue" | "emerald" | "slate" | "orange" | "teal";
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
    blue: {
      card: "shadow-blue-500/5 hover:shadow-blue-500/10",
      gradient: "from-blue-500/10 to-indigo-500/5",
      iconContainer: "bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20",
      border: "border-blue-100/50 dark:border-blue-800/30",
    },
    emerald: {
      card: "shadow-emerald-500/5 hover:shadow-emerald-500/10",
      gradient: "from-emerald-500/10 to-teal-500/5",
      iconContainer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20",
      border: "border-emerald-100/50 dark:border-emerald-800/30",
    },
    slate: {
      card: "shadow-slate-500/5 hover:shadow-slate-500/10",
      gradient: "from-slate-500/10 to-gray-500/5",
      iconContainer: "bg-slate-500/10 text-slate-600 dark:text-slate-400 dark:bg-slate-500/20",
      border: "border-slate-100/50 dark:border-slate-800/30",
    },
    orange: {
      card: "shadow-orange-500/5 hover:shadow-orange-500/10",
      gradient: "from-orange-500/10 to-amber-500/5",
      iconContainer: "bg-orange-500/10 text-orange-600 dark:text-orange-400 dark:bg-orange-500/20",
      border: "border-orange-100/50 dark:border-orange-800/30",
    },
    teal: {
      card: "shadow-teal-500/5 hover:shadow-teal-500/10",
      gradient: "from-teal-500/10 to-emerald-500/5",
      iconContainer: "bg-teal-500/10 text-teal-600 dark:text-teal-400 dark:bg-teal-500/20",
      border: "border-teal-100/50 dark:border-teal-800/30",
    },
  };

  const theme = themeClasses[themeColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Card
        className={`group relative overflow-hidden transition-all duration-300 border shadow-xl bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl ${theme.border} ${theme.card} hover:-translate-y-1`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        
        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-[10px] font-black tracking-[0.1em] text-slate-500 dark:text-slate-400 uppercase">
            {title}
          </CardTitle>
          <div className={`rounded-xl p-2 ${theme.iconContainer} transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative pb-5">
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className={`h-7 bg-slate-200 dark:bg-slate-800 rounded ${skeletonWidth}`}></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded w-1/2"></div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                {value}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5">
      <StatCard
        index={0}
        title="Total de Vendas"
        value={salesCount}
        description="Últimos 30 dias"
        icon={Receipt}
        isLoading={isLoading}
        skeletonWidth="w-16"
        themeColor="blue"
      />

      <StatCard
        index={1}
        title="Valor Total Bruto"
        value={formatCurrency(totalSales)}
        description="Valor integral"
        icon={DollarSign}
        isLoading={isLoading}
        skeletonWidth="w-24"
        themeColor="slate"
      />

      <StatCard
        index={2}
        title="Valor Líquido"
        value={formatCurrency(netValue)}
        description="Após deduções"
        icon={DollarSign}
        isLoading={isLoading}
        skeletonWidth="w-24"
        themeColor="teal"
      />

      <StatCard
        index={3}
        title="Cashback Usado"
        value={formatCurrency(totalCashbackUsed)}
        description="Total redimido"
        icon={Percent}
        isLoading={isLoading}
        skeletonWidth="w-24"
        themeColor="orange"
      />

      <StatCard
        index={4}
        title="Cashback Gerado"
        value={formatCurrency(totalCashbackGenerated)}
        description="Novo acúmulo"
        icon={Percent}
        isLoading={isLoading}
        skeletonWidth="w-24"
        themeColor="emerald"
      />
    </div>
  );
};
