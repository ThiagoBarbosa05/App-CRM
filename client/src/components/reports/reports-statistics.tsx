import {
  Users,
  Gift,
  UserPlus,
  MessageSquare,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface ReportsStatisticsProps {
  totalClients: number;
  upcomingBirthdaysCount: number;
  newClientsThisMonth: number;
  totalInteractionsThisMonth: number;
  clientGrowthPercent: number;
  interactionGrowthPercent: number;
}

function GrowthBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
        isPositive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export function ReportsStatistics({
  totalClients,
  upcomingBirthdaysCount,
  newClientsThisMonth,
  totalInteractionsThisMonth,
  clientGrowthPercent,
  interactionGrowthPercent,
}: ReportsStatisticsProps) {
  const stats = [
    {
      label: "Total de Clientes",
      value: totalClients,
      description: "clientes cadastrados",
      sub: <GrowthBadge value={clientGrowthPercent} />,
      subLabel: "vs. mês anterior",
      icon: <Users className="h-5 w-5" />,
      color: "emerald",
      iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Aniversariantes",
      value: upcomingBirthdaysCount,
      description: "nos próximos 30 dias",
      sub: null,
      subLabel: "oportunidade de contato",
      icon: <Gift className="h-5 w-5" />,
      color: "amber",
      iconBg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Novos Este Mês",
      value: newClientsThisMonth,
      description: "clientes cadastrados",
      sub: <GrowthBadge value={clientGrowthPercent} />,
      subLabel: "vs. mês anterior",
      icon: <UserPlus className="h-5 w-5" />,
      color: "blue",
      iconBg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Interações Este Mês",
      value: totalInteractionsThisMonth,
      description: "registros de contato",
      sub: <GrowthBadge value={interactionGrowthPercent} />,
      subLabel: "vs. mês anterior",
      icon: <MessageSquare className="h-5 w-5" />,
      color: "violet",
      iconBg: "bg-violet-50 dark:bg-violet-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -4 }}
        >
          <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                    {stat.label}
                  </span>
                  <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                    {stat.value}
                  </span>
                </div>
                <div
                  className={`p-2.5 rounded-xl ${stat.iconBg} text-${stat.color}-600 dark:text-${stat.color}-400`}
                >
                  {stat.icon}
                </div>
              </div>
              <div className="mt-auto">
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stat.description}
                </p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {stat.sub && stat.sub}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    {stat.subLabel}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
