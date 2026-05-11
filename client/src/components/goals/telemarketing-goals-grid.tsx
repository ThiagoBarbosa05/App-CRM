import { Phone, CheckCircle2, XCircle, Clock, Ban, HelpCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface TelemarketingGoal {
  id: string;
  userId: string;
  targetResult: string;
  targetQuantity: number;
  userName: string;
  userEmail: string;
}

interface TelemarketingStats {
  userId: string;
  "COM SUCESSO": number;
  "NÃO ATENDIDA": number;
  "SEM INTERESSE": number;
  "NÃO LIGAR MAIS": number;
  "EM OCUPADO": number;
  OUTROS: number;
  total: number;
}

interface TelemarketingGoalsGridProps {
  goals: TelemarketingGoal[];
  stats: TelemarketingStats[];
  calculatePercentage: (achieved: number, goal: number) => number;
}

export function TelemarketingGoalsGrid({
  goals,
  stats,
  calculatePercentage,
}: TelemarketingGoalsGridProps) {
  if (goals.length === 0) {
    return null; // Don't show the section if no goals
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shadow-inner">
          <Phone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Metas de Telemarketing</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhamento de ligações e prospecção</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...goals]
          .sort((a, b) => {
            const statsA = stats.find((s) => s.userId === a.userId);
            const statsB = stats.find((s) => s.userId === b.userId);
            const achievedA = statsA
              ? ((statsA[a.targetResult as keyof TelemarketingStats] as number) || 0)
              : 0;
            const achievedB = statsB
              ? ((statsB[b.targetResult as keyof TelemarketingStats] as number) || 0)
              : 0;
            const pctA = a.targetQuantity > 0 ? achievedA / a.targetQuantity : 0;
            const pctB = b.targetQuantity > 0 ? achievedB / b.targetQuantity : 0;
            return pctB - pctA;
          })
          .map((goal, index) => {
            const userStats = stats.find((s) => s.userId === goal.userId);
            return (
              <TelemarketingGoalCard
                key={goal.id}
                goal={goal}
                stats={userStats}
                index={index}
                calculatePercentage={calculatePercentage}
              />
            );
          })}
      </div>
    </div>
  );
}

function TelemarketingGoalCard({
  goal,
  stats,
  index,
  calculatePercentage,
}: {
  goal: TelemarketingGoal;
  stats?: TelemarketingStats;
  index: number;
  calculatePercentage: (achieved: number, goal: number) => number;
}) {
  const achieved = stats ? (stats[goal.targetResult as keyof TelemarketingStats] as number) || 0 : 0;
  const percentage = calculatePercentage(achieved, goal.targetQuantity);

  const getResultColor = (result: string) => {
    switch (result) {
      case "COM SUCESSO": return "emerald";
      case "NÃO ATENDIDA": return "amber";
      case "SEM INTERESSE": return "rose";
      case "NÃO LIGAR MAIS": return "slate";
      case "EM OCUPADO": return "orange";
      default: return "blue";
    }
  };

  const color = getResultColor(goal.targetResult);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className={`pb-4 border-b border-white/10 bg-${color}-500/10 dark:bg-${color}-500/20`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                {goal.userName}
              </CardTitle>
              <CardDescription className={`text-${color}-600 dark:text-${color}-400 font-medium`}>
                Foco: {goal.targetResult}
              </CardDescription>
            </div>
            <div className={`p-2 rounded-xl bg-${color}-500 text-white shadow-lg shadow-${color}-500/20`}>
              <Phone className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Main Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Progresso da Meta</span>
              <span className={`text-xl font-black text-${color}-600 dark:text-${color}-400`}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(percentage, 100)}%` }}
                className={`h-full bg-${color}-500 rounded-full shadow-sm shadow-${color}-500/20`}
              />
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-400">
              <span>{achieved} chamadas</span>
              <span>Meta: {goal.targetQuantity}</span>
            </div>
          </div>

          {/* Stats Breakdown */}
          {stats && (
            <div className="pt-4 border-t border-slate-50 dark:border-slate-800 grid grid-cols-2 gap-4">
              <StatMiniItem
                label="Total"
                value={stats.total}
                icon={<Phone className="h-3 w-3" />}
                color="blue"
              />
              <StatMiniItem
                label="Sucesso"
                value={stats["COM SUCESSO"]}
                icon={<CheckCircle2 className="h-3 w-3" />}
                color="emerald"
              />
              <StatMiniItem
                label="S/ Interesse"
                value={stats["SEM INTERESSE"]}
                icon={<XCircle className="h-3 w-3" />}
                color="rose"
              />
              <StatMiniItem
                label="Ocupado"
                value={stats["EM OCUPADO"]}
                icon={<Clock className="h-3 w-3" />}
                color="orange"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatMiniItem({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{value}</p>
      </div>
    </div>
  );
}
