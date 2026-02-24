import { Users, Building2, Gift, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface ReportsStatisticsProps {
  totalClients: number;
  totalCompanies: number;
  upcomingBirthdaysCount: number;
  totalSectors: number;
}

export function ReportsStatistics({
  totalClients,
  totalCompanies,
  upcomingBirthdaysCount,
  totalSectors,
}: ReportsStatisticsProps) {
  const stats = [
    {
      label: "Total de Clientes",
      value: totalClients,
      description: "clientes cadastrados",
      icon: <Users className="h-5 w-5" />,
      color: "emerald",
      gradient: "from-emerald-50 to-green-50 dark:from-emerald-900/40 dark:to-green-900/20",
    },
    {
      label: "Total de Empresas",
      value: totalCompanies,
      description: "empresas cadastradas",
      icon: <Building2 className="h-5 w-5" />,
      color: "blue",
      gradient: "from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/20",
    },
    {
      label: "Aniversariantes",
      value: upcomingBirthdaysCount,
      description: "nos próximos 30 dias",
      icon: <Gift className="h-5 w-5" />,
      color: "amber",
      gradient: "from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/20",
    },
    {
      label: "Setores Ativos",
      value: totalSectors,
      description: "mercados de atuação",
      icon: <FileText className="h-5 w-5" />,
      color: "indigo",
      gradient: "from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/20",
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
          whileHover={{ y: -5 }}
        >
          <Card className={`group relative overflow-hidden border-none shadow-md bg-gradient-to-br ${stat.gradient} h-full`}>
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500`}>
              {stat.icon}
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {stat.label}
              </CardTitle>
              <div className={`p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 text-${stat.color}-600 dark:text-${stat.color}-400 shadow-sm sm:hidden lg:flex`}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-black text-${stat.color}-700 dark:text-${stat.color}-400 mb-1`}>
                {stat.value}
              </div>
              <p className={`text-xs font-medium text-slate-600 dark:text-slate-400`}>
                {stat.description}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
