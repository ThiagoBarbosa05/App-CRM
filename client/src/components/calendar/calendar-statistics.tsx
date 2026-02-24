import { Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface StatItemProps {
  label: string;
  count: number;
  index: number;
}

function StatItem({ label, count, index }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="text-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 shadow-sm group hover:shadow-md"
    >
      <div className="flex justify-center mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shadow-inner">
          <Gift className="h-5 w-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        {count}
      </div>
      <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
        {label}
      </div>
    </motion.div>
  );
}

interface CalendarStatisticsProps {
  stats: {
    today: number;
    tomorrow: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export function CalendarStatistics({ stats }: CalendarStatisticsProps) {
  const items = [
    { label: "Hoje", count: stats.today },
    { label: "Amanhã", count: stats.tomorrow },
    { label: "Esta Semana", count: stats.thisWeek },
    { label: "Este Mês", count: stats.thisMonth },
  ];

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50/30 dark:bg-slate-900/30 rounded-3xl overflow-hidden">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardTitle className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Gift className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              Estatísticas
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-normal">
              Resumo de aniversariantes por período
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item, index) => (
            <StatItem
              key={item.label}
              label={item.label}
              count={item.count}
              index={index}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
