import {
  Target,
  BarChart3,
  Plus,
  Pencil,
  ShoppingBag,
  ShoppingCart,
  Wine,
  Users,
  Edit,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { TopSeller } from "@/hooks/use-bling-orders";
import { getBottleGoalProgress } from "@/pages/seller-dashboard-goals";

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
  ordersGoal: number;
  avgBottleValueGoal: string;
  positivityGoal: number;
  positivityAchieved: number;
  positivityTotal: number;
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
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved",
  ) => number;
  onAddResult?: (goal: UserGoal) => void;
  onEditResult?: (goal: UserGoal, result: WeeklyResult) => void;
  onEdit?: (goal: UserGoal) => void;
  onDelete?: (goalId: string) => void;
  isAdmin?: boolean;
  topSellersData?: TopSeller[];
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findSellerData(
  userName: string,
  topSellers: TopSeller[],
): TopSeller | null {
  const normUser = normalizeName(userName);
  return (
    topSellers.find((s) => {
      if (!s.sellerName) return false;
      const normSeller = normalizeName(s.sellerName);
      return (
        normUser === normSeller ||
        normUser.startsWith(normSeller) ||
        normSeller.startsWith(normUser)
      );
    }) ?? null
  );
}

export function SalesGoalsGrid({
  goals,
  formatCurrency,
  calculatePercentage,
  getTotalAchieved,
  onAddResult,
  onEditResult,
  onEdit,
  onDelete,
  isAdmin,
  topSellersData = [],
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
          onAddResult={onAddResult}
          onEditResult={onEditResult}
          onEdit={onEdit}
          onDelete={onDelete}
          isAdmin={isAdmin}
          sellerData={findSellerData(goal.userName, topSellersData)}
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
  onAddResult,
  onEditResult,
  onEdit,
  onDelete,
  isAdmin,
  sellerData,
}: {
  goal: UserGoal;
  index: number;
  formatCurrency: (value: string | number) => string;
  calculatePercentage: (achieved: number, goal: number) => number;
  getTotalAchieved: (
    weeklyResults: WeeklyResult[],
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved",
  ) => number;
  onAddResult?: (goal: UserGoal) => void;
  onEditResult?: (goal: UserGoal, result: WeeklyResult) => void;
  onEdit?: (goal: UserGoal) => void;
  onDelete?: (goalId: string) => void;
  isAdmin?: boolean;
  sellerData?: TopSeller | null;
}) {
  const weeklyResults = goal.weeklyResults || [];
  const monthlyResult = weeklyResults[0] ?? null;

  const realSalesValue = sellerData ? Number(sellerData.totalValue) : 0;
  const realSalesOrders = sellerData ? Number(sellerData.totalOrders) : 0;
  const avgTicketAchieved =
    realSalesOrders > 0 ? realSalesValue / realSalesOrders : 0;
  const ticketPercentage = calculatePercentage(
    avgTicketAchieved,
    Number(goal.averageTicket),
  );
  const realSalesPercentage = calculatePercentage(
    realSalesValue,
    Number(goal.salesGoal),
  );

  const ordersGoalValue = goal.ordersGoal ?? 0;
  const totalItemsSold = sellerData?.totalItems ?? 0;
  const bottleGoalProgress = getBottleGoalProgress(
    { totalItems: totalItemsSold, totalOrders: realSalesOrders },
    ordersGoalValue,
  );
  const avgBottleValue =
    totalItemsSold > 0 ? realSalesValue / totalItemsSold : 0;
  const avgBottleGoalValue = Number(goal.avgBottleValueGoal ?? "0");
  const avgBottlePercentage = calculatePercentage(
    avgBottleValue,
    avgBottleGoalValue,
  );

  const positivacaoAchieved = goal.positivityAchieved ?? 0;
  const positivacaoPercentage = calculatePercentage(
    positivacaoAchieved,
    goal.positivityGoal,
  );

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
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant="secondary"
                className={`border-none px-2 py-0.5 h-6 text-xs font-bold whitespace-nowrap ${monthlyResult ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
              >
                {monthlyResult ? "✓ REGISTRADO" : "PENDENTE"}
              </Badge>
              {/* Ações admin: editar e excluir meta */}
              {isAdmin && onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(goal)}
                  className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Edit className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              )}
              {isAdmin && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(goal.id)}
                  className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Vendas Reais no Mês (Bling/Connect) */}
          <div
            className={`rounded-2xl p-4 border ${
              realSalesPercentage >= 100
                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40"
                : realSalesPercentage >= 50
                  ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40"
                  : "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/40"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg ${
                    realSalesPercentage >= 100
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : realSalesPercentage >= 50
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-rose-100 dark:bg-rose-900/30"
                  }`}
                >
                  <ShoppingBag
                    className={`h-3.5 w-3.5 ${
                      realSalesPercentage >= 100
                        ? "text-emerald-600 dark:text-emerald-400"
                        : realSalesPercentage >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                    }`}
                  />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Vendas Reais no Mês
                </span>
              </div>
              <span
                className={`text-xs font-black ${
                  realSalesPercentage >= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : realSalesPercentage >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {realSalesPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mb-2">
              <span
                className={`text-xl font-black ${
                  realSalesPercentage >= 100
                    ? "text-emerald-700 dark:text-emerald-300"
                    : realSalesPercentage >= 50
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-rose-700 dark:text-rose-300"
                }`}
              >
                {sellerData ? formatCurrency(realSalesValue) : "—"}
              </span>
              {sellerData && (
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {realSalesOrders} pedido{realSalesOrders !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="w-full bg-white/60 dark:bg-slate-800/60 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(realSalesPercentage, 100)}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  realSalesPercentage >= 100
                    ? "bg-emerald-500"
                    : realSalesPercentage >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1.5">
              <span>Meta: {formatCurrency(goal.salesGoal)}</span>
              {!sellerData && (
                <span className="italic">Sem pedidos no período</span>
              )}
            </div>
          </div>

          {/* Total de GRFs no Mês */}
          <MetricProgress
            label="Total de GRFs no Mês"
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            achieved={`${bottleGoalProgress.achieved} GRF${bottleGoalProgress.achieved !== 1 ? "s" : ""}`}
            goal={`${ordersGoalValue} GRF${ordersGoalValue !== 1 ? "s" : ""}`}
            percentage={bottleGoalProgress.percentage}
            colorClass="bg-indigo-500"
            bgClass="bg-indigo-50 dark:bg-indigo-900/20"
            textClass="text-indigo-600 dark:text-indigo-400"
          />

          {/* Ticket Médio */}
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

          {/* Valor Médio por Garrafa */}
          <MetricProgress
            label="Valor Médio por Garrafa"
            icon={<Wine className="h-3.5 w-3.5" />}
            achieved={totalItemsSold > 0 ? formatCurrency(avgBottleValue) : "—"}
            goal={formatCurrency(goal.avgBottleValueGoal ?? "0")}
            percentage={avgBottleGoalValue > 0 ? avgBottlePercentage : 0}
            colorClass="bg-rose-500"
            bgClass="bg-rose-50 dark:bg-rose-900/20"
            textClass="text-rose-600 dark:text-rose-400"
          />

          {/* Positivação */}
          <MetricProgress
            label="Positivação da Carteira"
            icon={<Users className="h-3.5 w-3.5" />}
            achieved={`${positivacaoAchieved.toFixed(1)}%`}
            goal={`${goal.positivityGoal}%`}
            percentage={goal.positivityGoal > 0 ? positivacaoPercentage : 0}
            colorClass="bg-violet-500"
            bgClass="bg-violet-50 dark:bg-violet-900/20"
            textClass="text-violet-600 dark:text-violet-400"
          />

          {/* Resultado do Mês — admin */}
          {isAdmin && (
            <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span>Resultado do Mês</span>
                <span
                  className={
                    monthlyResult ? "text-emerald-500" : "text-slate-400"
                  }
                >
                  {monthlyResult ? "Registrado" : "Pendente"}
                </span>
              </div>

              <div className="flex gap-2">
                {!monthlyResult && onAddResult && (
                  <Button
                    size="sm"
                    onClick={() => onAddResult(goal)}
                    className="flex-1 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-none font-bold text-[10px] uppercase tracking-widest gap-1.5 transition-all"
                    variant="ghost"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Registrar Resultado
                  </Button>
                )}
                {monthlyResult && onEditResult && (
                  <Button
                    size="sm"
                    onClick={() => onEditResult(goal, monthlyResult)}
                    className="flex-1 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-none font-bold text-[10px] uppercase tracking-widest gap-1.5 transition-all"
                    variant="ghost"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar Resultado
                  </Button>
                )}
              </div>
            </div>
          )}
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
          <div className={`p-1 rounded-md ${bgClass} ${textClass}`}>{icon}</div>
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
