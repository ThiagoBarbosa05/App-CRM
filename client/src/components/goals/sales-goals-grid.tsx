import { Target, BarChart3, TrendingUp, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface WeeklyResult {
  id: string;
  goalId: string;
  week: number;
  salesAchieved: string;
  ticketAchieved: string;
  itemsAchieved: number;
}

interface UserGoal {
  id: string;
  userId: string;
  salesGoal: string;
  averageTicket: string;
  itemsPerSale: number;
  userName: string;
  userEmail: string;
  weeklyResults: WeeklyResult[];
}

interface SalesGoalsGridProps {
  goals: UserGoal[];
  formatCurrency: (value: string | number) => string;
  calculatePercentage: (achieved: number, goal: number) => number;
  getTotalAchieved: (
    weeklyResults: WeeklyResult[],
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved"
  ) => number;
}

export function SalesGoalsGrid({
  goals,
  formatCurrency,
  calculatePercentage,
  getTotalAchieved,
}: SalesGoalsGridProps) {
  if (goals.length === 0) {
    return (
      <Card className="border-dashed border-2 py-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
            <Target className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Nenhuma meta de vendas
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
            Não foram encontradas metas de vendas para o período selecionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {goals.map((goal, index) => (
        <SalesGoalCard
          key={goal.id}
          goal={goal}
          index={index}
          formatCurrency={formatCurrency}
          calculatePercentage={calculatePercentage}
          getTotalAchieved={getTotalAchieved}
        />
      ))}
    </div>
  );
}

function SalesGoalCard({
  goal,
  index,
  formatCurrency,
  calculatePercentage,
  getTotalAchieved,
}: {
  goal: UserGoal;
  index: number;
  formatCurrency: (value: string | number) => string;
  calculatePercentage: (achieved: number, goal: number) => number;
  getTotalAchieved: (
    weeklyResults: WeeklyResult[],
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved"
  ) => number;
}) {
  const weeklyResults = goal.weeklyResults || [];
  const totalSalesAchieved = getTotalAchieved(weeklyResults, "salesAchieved");
  const totalItemsAchieved = getTotalAchieved(weeklyResults, "itemsAchieved");
  const avgTicketAchieved =
    weeklyResults.length > 0
      ? getTotalAchieved(weeklyResults, "ticketAchieved") / weeklyResults.length
      : 0;

  const salesPercentage = calculatePercentage(totalSalesAchieved, Number(goal.salesGoal));
  const ticketPercentage = calculatePercentage(avgTicketAchieved, Number(goal.averageTicket));
  const itemsPercentage = calculatePercentage(totalItemsAchieved, goal.itemsPerSale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
    >
      <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 group">
        <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {goal.userName}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 truncate">
                {goal.userEmail}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-none px-2 py-0.5 h-6 text-xs font-bold whitespace-nowrap">
              {weeklyResults.length}/4 SEMANAS
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Sales Progress */}
          <MetricProgress
            label="Volume de Vendas"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            achieved={formatCurrency(totalSalesAchieved)}
            goal={formatCurrency(goal.salesGoal)}
            percentage={salesPercentage}
            colorClass="bg-emerald-500"
            bgClass="bg-emerald-50 dark:bg-emerald-900/20"
            textClass="text-emerald-600 dark:text-emerald-400"
          />

          {/* Average Ticket Progress */}
          <MetricProgress
            label="Ticket Médio"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            achieved={formatCurrency(avgTicketAchieved)}
            goal={formatCurrency(goal.averageTicket)}
            percentage={ticketPercentage}
            colorClass="bg-blue-500"
            bgClass="bg-blue-50 dark:bg-blue-900/20"
            textClass="text-blue-600 dark:text-blue-400"
          />

          {/* Items Per Sale Progress */}
          <MetricProgress
            label="Itens por Venda"
            icon={<Package className="h-3.5 w-3.5" />}
            achieved={`${totalItemsAchieved} itens`}
            goal={`${goal.itemsPerSale} itens`}
            percentage={itemsPercentage}
            colorClass="bg-purple-500"
            bgClass="bg-purple-50 dark:bg-purple-900/20"
            textClass="text-purple-600 dark:text-purple-400"
          />

          {/* Weekly Status Tracker */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Status Semanal</span>
              <span>{weeklyResults.length} Completas</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((week) => {
                const hasResult = weeklyResults.some((r) => r.week === week);
                return (
                  <div
                    key={week}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      hasResult
                        ? "bg-blue-500 shadow-sm shadow-blue-500/20"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                    title={hasResult ? `Semana ${week} concluída` : `Semana ${week} pendente`}
                  />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MetricProgress({
  label,
  icon,
  achieved,
  goal,
  percentage,
  colorClass,
  bgClass,
  textClass,
}: {
  label: string;
  icon: React.ReactNode;
  achieved: string;
  goal: string;
  percentage: number;
  colorClass: string;
  bgClass: string;
  textClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${bgClass} ${textClass}`}>
            {icon}
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {label}
          </span>
        </div>
        <span className={`text-sm font-black ${textClass}`}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colorClass} rounded-full`}
        />
      </div>
      
      <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span className="truncate max-w-[50%]">Alcançado: {achieved}</span>
        <span className="truncate max-w-[50%]">Meta: {goal}</span>
      </div>
    </div>
  );
}
