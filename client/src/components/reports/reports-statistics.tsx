import { Users, Gift, UserPlus, MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
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
      gradient:
        "from-emerald-50 to-green-50 dark:from-emerald-900/40 dark:to-green-900/20",
    },
    {
      label: "Aniversariantes",
      value: upcomingBirthdaysCount,
      description: "nos próximos 30 dias",
      sub: null,
      subLabel: "oportunidade de contato",
      icon: <Gift className="h-5 w-5" />,
      color: "amber",
      gradient:
        "from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/20",
    },
    {
      label: "Novos Este Mês",
      value: newClientsThisMonth,
      description: "clientes cadastrados",
      sub: <GrowthBadge value={clientGrowthPercent} />,
      subLabel: "vs. mês anterior",
      icon: <UserPlus className="h-5 w-5" />,
      color: "blue",
      gradient:
        "from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/20",
    },
    {
      label: "Interações Este Mês",
      value: totalInteractionsThisMonth,
      description: "registros de contato",
      sub: <GrowthBadge value={interactionGrowthPercent} />,
      subLabel: "vs. mês anterior",
      icon: <MessageSquare className="h-5 w-5" />,
      color: "violet",
      gradient:
        "from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/20",
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
          <Card
            className={`group relative overflow-hidden border-none shadow-md bg-gradient-to-br ${stat.gradient} h-full`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {stat.label}
              </CardTitle>
              <div
                className={`p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 text-${stat.color}-600 dark:text-${stat.color}-400 shadow-sm sm:hidden lg:flex`}
              >
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-black text-${stat.color}-700 dark:text-${stat.color}-400 mb-1`}
              >
                {stat.value}
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                {stat.description}
              </p>
              {stat.sub && (
                <div className="flex items-center gap-1.5">
                  {stat.sub}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {stat.subLabel}
                  </span>
                </div>
              )}
              {!stat.sub && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                  {stat.subLabel}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
