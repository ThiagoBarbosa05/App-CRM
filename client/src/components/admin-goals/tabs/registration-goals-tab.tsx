import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Users, Edit, Trash2, UserPlus } from "lucide-react";
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

interface ClientRegistrationGoal {
  id: string;
  userId: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
}

interface ClientRegistrationStats {
  userId: string;
  totalRegistrations: number;
}

interface RegistrationGoalsTabProps {
  selectedMonth: number;
  selectedYear: number;
  onEdit: (goal: ClientRegistrationGoal) => void;
  onNew: () => void;
  isAdmin: boolean;
}

export function ClientRegistrationGoalsTab({ selectedMonth, selectedYear, onEdit, onNew, isAdmin }: RegistrationGoalsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery<ClientRegistrationGoal[]>({
    queryKey: [`/api/client-registration-goals/${selectedMonth}/${selectedYear}`],
  });

  const { data: stats = [] } = useQuery<ClientRegistrationStats[]>({
    queryKey: [`/api/client-registration-stats/${selectedMonth}/${selectedYear}`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/client-registration-goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client-registration-goals/${selectedMonth}/${selectedYear}`] });
      toast({
        title: "Meta excluída",
        description: "A meta de cadastros foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent shadow-xl shadow-emerald-500/20" />
          <span className="text-sm font-black uppercase tracking-widest text-slate-400">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <UserPlus className="h-10 w-10 mx-auto text-slate-300 mb-6" />
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Sem metas de cadastro</h3>
        <p className="text-slate-500 mt-2 font-medium">As metas de prospecção/cadastro aparecerão aqui.</p>
        <Button 
          onClick={onNew}
          className="mt-8 h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-black uppercase text-[10px] tracking-widest"
        >
          Nova Meta de Cadastro
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-900/10 dark:to-green-900/10 border-b border-slate-100 dark:border-slate-800 p-8 flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-600 shadow-lg shadow-emerald-500/20 rounded-2xl p-3">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Metas de Cadastros</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Fomento à prospecção e novos clientes</CardDescription>
          </div>
        </div>
        <Button 
          onClick={onNew}
          className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-black uppercase text-[10px] tracking-widest gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Nova Meta
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Vendedor</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Progresso / Alvo</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Período</TableHead>
                <TableHead className="py-6 px-8 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal, index) => {
                const userStats = stats.find(s => s.userId === goal.userId);
                const achieved = userStats?.totalRegistrations || 0;
                const percentage = Math.min((achieved / goal.targetQuantity) * 100, 100);

                return (
                  <motion.tr
                    key={goal.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <TableCell className="py-6 px-8 font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">
                      {goal.userName}
                    </TableCell>
                    <TableCell className="py-6 px-8">
                       <div className="flex items-center gap-4">
                         <div className="min-w-[60px] text-xs font-black text-emerald-600 dark:text-emerald-400">
                           {achieved} / {goal.targetQuantity}
                         </div>
                         <div className="h-1.5 w-40 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${percentage}%` }}
                             className="h-full bg-emerald-500 rounded-full"
                           />
                         </div>
                       </div>
                    </TableCell>
                    <TableCell className="py-6 px-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
                       {new Date(0, goal.month - 1).toLocaleDateString("pt-BR", { month: "short" })} {goal.year}
                    </TableCell>
                    <TableCell className="py-6 px-8 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(goal)}
                          className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                          <Edit className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(goal.id)}
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
