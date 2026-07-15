import { motion } from "framer-motion";
import { Users, Target, Edit, Plus, Trash2 } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

// Using existing interfaces from admin-goals.tsx (they will be moved to a types file later)
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
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  weeklyResults: WeeklyResult[];
  productGoalId?: string | null;
  productGoalQty?: number | null;
  productGoalName?: string | null;
}

interface SalesGoalsTabProps {
  goals: UserGoal[];
  isLoading: boolean;
  selectedMonth: number;
  selectedYear: number;
  onEdit: (goal: UserGoal) => void;
  onAddResult: (goal: UserGoal) => void;
  onDelete: (goalId: string) => void;
  isAdmin: boolean;
}

export function SalesGoalsTab({ goals, isLoading, selectedMonth, selectedYear, onEdit, onAddResult, onDelete, isAdmin }: SalesGoalsTabProps) {
  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));
  };

  const getTotalAchieved = (weeklyResults: WeeklyResult[], field: keyof WeeklyResult) => {
    return (weeklyResults || []).reduce((sum, result) => {
      if (field === "itemsAchieved") return sum + (result[field] as number);
      return sum + Number(result[field]);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent shadow-xl shadow-blue-500/20" />
          <span className="text-sm font-black uppercase tracking-widest text-slate-400">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 mb-6 text-slate-300">
          <Target className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nenhuma meta</h3>
        <p className="text-slate-500 mt-2 font-medium">As metas de vendas por usuário aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-b border-slate-100 dark:border-slate-800 p-8">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 shadow-lg shadow-blue-500/20 rounded-2xl p-3">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Metas de Vendas por Usuário</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Lista de performance e KPI's por colaborador</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Vendedor</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Período</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Meta</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Progresso</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Ticket Médio</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Itens/Venda</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal, index) => {
                const totalSales = getTotalAchieved(goal.weeklyResults, "salesAchieved");
                const percentage = Number(goal.salesGoal) > 0 ? Math.min((totalSales / Number(goal.salesGoal)) * 100, 100) : 0;
                
                return (
                  <motion.tr
                    key={goal.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <TableCell className="py-6 px-8 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                          {goal.userName?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase tracking-tight">{goal.userName}</p>
                          <p className="text-[10px] font-bold text-slate-400 lowercase truncate max-w-[150px]">{goal.userEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-6 px-8 text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {new Date(0, goal.month - 1).toLocaleDateString("pt-BR", { month: "short" })} {goal.year}
                    </TableCell>
                    <TableCell className="py-6 px-8">
                       <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                         {formatCurrency(goal.salesGoal)}
                       </span>
                    </TableCell>
                    <TableCell className="py-6 px-8">
                      <div className="space-y-2 min-w-[140px]">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                          <span className={`${percentage >= 100 ? 'text-emerald-500' : 'text-blue-500'}`}>
                            {formatCurrency(totalSales)}
                          </span>
                          <span className="text-slate-400">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full shadow-lg ${
                              percentage >= 100 
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-emerald-500/20' 
                                : 'bg-gradient-to-r from-blue-400 to-indigo-600 shadow-blue-500/20'
                            }`}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-6 px-8">
                       <div className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 w-fit">
                         <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">{formatCurrency(goal.averageTicket)}</span>
                       </div>
                    </TableCell>
                    <TableCell className="py-6 px-8">
                       <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">{goal.itemsPerSale} ITENS</span>
                    </TableCell>
                    <TableCell className="py-6 px-8 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(goal)}
                          className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                          <Edit className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onAddResult(goal)}
                          className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                          <Plus className="h-4 w-4 text-emerald-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(goal.id)}
                          className="h-9 w-9 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
