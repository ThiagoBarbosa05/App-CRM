import { Users, Tag, MessageSquare, ArrowUpRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface ActivityGoalsSectionsProps {
  registrationGoals: any[];
  registrationStats: any[];
  markerGoals: any[];
  markerStats: any[];
  interactionGoals: any[];
  interactionStats: any[];
  calculatePercentage: (achieved: number, goal: number) => number;
  getInteractionTypeLabel: (type: string) => string;
}

export function ActivityGoalsSections({
  registrationGoals,
  registrationStats,
  markerGoals,
  markerStats,
  interactionGoals,
  interactionStats,
  calculatePercentage,
  getInteractionTypeLabel,
}: ActivityGoalsSectionsProps) {
  return (
    <div className="space-y-12">
      {/* Registration Goals */}
      {registrationGoals.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            icon={<Users className="h-5 w-5" />}
            title="Cadastros de Clientes"
            description="Metas de aquisição de novos clientes"
            color="emerald"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...registrationGoals]
              .sort((a, b) => {
                const sA = registrationStats.find((s) => s.userId === a.userId);
                const sB = registrationStats.find((s) => s.userId === b.userId);
                const pctA = a.targetQuantity > 0 ? (sA?.totalRegistrations || 0) / a.targetQuantity : 0;
                const pctB = b.targetQuantity > 0 ? (sB?.totalRegistrations || 0) / b.targetQuantity : 0;
                return pctB - pctA;
              })
              .map((goal, index) => {
                const stats = registrationStats.find(
                  (s) => s.userId === goal.userId,
                );
                const achieved = stats?.totalRegistrations || 0;
                const incomplete = stats?.incompleteRegistrations || 0;
                return (
                  <ActivityGoalCard
                    key={goal.id}
                    title={goal.userName}
                    subtitle="Novos Cadastros Completos"
                    achieved={achieved}
                    goal={goal.targetQuantity}
                    percentage={calculatePercentage(
                      achieved,
                      goal.targetQuantity,
                    )}
                    incompleteCount={incomplete}
                    index={index}
                    color="emerald"
                  />
                );
              })}
          </div>
        </section>
      )}

      {/* Marker Goals */}
      {markerGoals.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            icon={<Tag className="h-5 w-5" />}
            title="Marcadores de Clientes"
            description="Metas de faturamento/classificação"
            color="amber"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...markerGoals]
              .sort((a, b) => {
                const sA = markerStats.find((s) => s.markerName === a.markerName && s.userId === a.userId);
                const sB = markerStats.find((s) => s.markerName === b.markerName && s.userId === b.userId);
                const pctA = a.targetQuantity > 0 ? (sA?.totalClients || 0) / a.targetQuantity : 0;
                const pctB = b.targetQuantity > 0 ? (sB?.totalClients || 0) / b.targetQuantity : 0;
                return pctB - pctA;
              })
              .map((goal, index) => {
                const stats = markerStats.find(
                  (s) =>
                    s.markerName === goal.markerName && s.userId === goal.userId,
                );
                const achieved = stats?.totalClients || 0;
                return (
                  <ActivityGoalCard
                    key={goal.id}
                    title={goal.userName}
                    subtitle={`Marcador: ${goal.markerName}`}
                    achieved={achieved}
                    goal={goal.targetQuantity}
                    percentage={calculatePercentage(
                      achieved,
                      goal.targetQuantity,
                    )}
                    index={index}
                    color="amber"
                  />
                );
              })}
          </div>
        </section>
      )}

      {/* Interaction Goals */}
      {interactionGoals.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            icon={<MessageSquare className="h-5 w-5" />}
            title="Atividades e Interações"
            description="Metas de engajamento e contato"
            color="blue"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...interactionGoals]
              .sort((a, b) => {
                const sA = interactionStats.find((s) => s.interactionType === a.interactionType && s.userId === a.userId);
                const sB = interactionStats.find((s) => s.interactionType === b.interactionType && s.userId === b.userId);
                const pctA = a.targetQuantity > 0 ? (sA?.totalInteractions || 0) / a.targetQuantity : 0;
                const pctB = b.targetQuantity > 0 ? (sB?.totalInteractions || 0) / b.targetQuantity : 0;
                return pctB - pctA;
              })
              .map((goal, index) => {
                const stats = interactionStats.find(
                  (s) =>
                    s.interactionType === goal.interactionType &&
                    s.userId === goal.userId,
                );
                const achieved = stats?.totalInteractions || 0;
                return (
                  <ActivityGoalCard
                    key={goal.id}
                    title={goal.userName}
                    subtitle={getInteractionTypeLabel(goal.interactionType)}
                    achieved={achieved}
                    goal={goal.targetQuantity}
                    percentage={calculatePercentage(
                      achieved,
                      goal.targetQuantity,
                    )}
                    index={index}
                    color="blue"
                  />
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  color,
}: {
  icon: any;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${color}-50 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 shadow-inner`}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function ActivityGoalCard({
  title,
  subtitle,
  achieved,
  goal,
  percentage,
  incompleteCount = 0,
  index,
  color,
}: {
  title: string;
  subtitle: string;
  achieved: number;
  goal: number;
  percentage: number;
  incompleteCount?: number;
  index: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 group">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white truncate">
              {title}
            </CardTitle>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          </div>
          <div
            className={`h-8 w-8 rounded-full bg-${color}-500/10 flex items-center justify-center text-${color}-600`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                {achieved}
              </span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Realizado
              </p>
            </div>
            <div className="text-right space-y-1">
              <span
                className={`text-lg font-bold text-${color}-600 dark:text-${color}-400 leading-none`}
              >
                {percentage.toFixed(0)}%
              </span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Atingido
              </p>
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentage, 100)}%` }}
              className={`h-full bg-${color}-500 rounded-full shadow-sm shadow-${color}-500/20`}
            />
          </div>

          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="text-[10px] bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500"
            >
              META: {goal}
            </Badge>
          </div>

          {incompleteCount > 0 && (
            <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-snug">
                {incompleteCount} cadastro{incompleteCount !== 1 ? "s" : ""} incompleto{incompleteCount !== 1 ? "s" : ""} não contabilizado{incompleteCount !== 1 ? "s" : ""} na meta
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
