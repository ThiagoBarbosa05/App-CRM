
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Target, Users, TrendingUp, Calendar, BarChart3, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Sidebar from "@/components/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

const weeklyResultSchema = z.object({
  goalId: z.string().min(1, "ID da meta é obrigatório"),
  week: z.string().min(1, "Semana é obrigatória"),
  salesAchieved: z.string().min(1, "Vendas alcançadas é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
  ticketAchieved: z.string().min(1, "Ticket médio alcançado é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
  itemsAchieved: z.string().min(1, "Itens alcançados é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
});

type WeeklyResultFormData = z.infer<typeof weeklyResultSchema>;

interface WeeklyResult {
  id: string;
  goalId: string;
  week: number;
  salesAchieved: string;
  ticketAchieved: string;
  itemsAchieved: number;
  createdAt: string;
  updatedAt: string;
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
}

export default function Metas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para controlar mês/ano atual
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<UserGoal | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<WeeklyResultFormData>({
    resolver: zodResolver(weeklyResultSchema),
  });

  // Buscar metas do mês/ano selecionado
  const { data: userGoals = [], isLoading } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  // Mutation para salvar resultado semanal
  const resultMutation = useMutation({
    mutationFn: async (data: WeeklyResultFormData) => {
      const resultData = {
        goalId: data.goalId,
        week: parseInt(data.week),
        salesAchieved: data.salesAchieved,
        ticketAchieved: data.ticketAchieved,
        itemsAchieved: parseInt(data.itemsAchieved),
      };

      return apiRequest("/api/weekly-results", "POST", resultData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`] });
      toast({
        title: "Resultado salvo",
        description: "Resultado semanal foi salvo com sucesso.",
      });
      handleCloseResultModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar resultado semanal.",
        variant: "destructive",
      });
    },
  });

  const handleOpenResultModal = (goal: UserGoal) => {
    setSelectedGoal(goal);
    setValue("goalId", goal.id);
    setIsResultModalOpen(true);
  };

  const handleCloseResultModal = () => {
    setIsResultModalOpen(false);
    setSelectedGoal(null);
    reset();
  };

  const onSubmit = (data: WeeklyResultFormData) => {
    resultMutation.mutate(data);
  };

  // Função para calcular percentual atingido
  const calculatePercentage = (achieved: number, goal: number) => {
    if (goal === 0) return 0;
    return Math.min((achieved / goal) * 100, 100);
  };

  // Função para somar resultados semanais
  const getTotalAchieved = (weeklyResults: WeeklyResult[], field: 'salesAchieved' | 'ticketAchieved' | 'itemsAchieved') => {
    return weeklyResults.reduce((sum, result) => {
      if (field === 'itemsAchieved') {
        return sum + result[field];
      }
      return sum + Number(result[field]);
    }, 0);
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value));
  };

  // Filtrar metas do usuário logado ou mostrar todas se for admin/gerente
  const filteredGoals = user?.role === "admin" || user?.role === "gerente" 
    ? userGoals 
    : userGoals.filter(goal => goal.userId === user?.id);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab="metas" onTabChange={() => {}} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Análise de Metas</h1>
                <p className="text-gray-600">
                  Acompanhe o progresso das metas de vendas em {format(new Date(selectedYear, selectedMonth - 1), "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="month-select">Mês:</Label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="year-select">Ano:</Label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Cards de Metas por Usuário */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Carregando metas...</div>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nenhuma meta encontrada para este período</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGoals.map((goal) => {
                const totalSalesAchieved = getTotalAchieved(goal.weeklyResults, 'salesAchieved');
                const totalItemsAchieved = getTotalAchieved(goal.weeklyResults, 'itemsAchieved');
                const avgTicketAchieved = goal.weeklyResults.length > 0 
                  ? getTotalAchieved(goal.weeklyResults, 'ticketAchieved') / goal.weeklyResults.length 
                  : 0;

                const salesPercentage = calculatePercentage(totalSalesAchieved, Number(goal.salesGoal));
                const ticketPercentage = calculatePercentage(avgTicketAchieved, Number(goal.averageTicket));
                const itemsPercentage = calculatePercentage(totalItemsAchieved, goal.itemsPerSale);

                return (
                  <Card key={goal.id} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{goal.userName}</CardTitle>
                        {(user?.role === "admin" || user?.role === "gerente") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResultModal(goal)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Resultado
                          </Button>
                        )}
                      </div>
                      <CardDescription>{goal.userEmail}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Meta de Vendas */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Vendas</span>
                          <span className="text-sm text-gray-500">{salesPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-green-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(salesPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{formatCurrency(totalSalesAchieved)}</span>
                          <span>{formatCurrency(goal.salesGoal)}</span>
                        </div>
                      </div>

                      {/* Meta de Ticket Médio */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Ticket Médio</span>
                          <span className="text-sm text-gray-500">{ticketPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(ticketPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{formatCurrency(avgTicketAchieved)}</span>
                          <span>{formatCurrency(goal.averageTicket)}</span>
                        </div>
                      </div>

                      {/* Meta de Itens por Venda */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Itens Vendidos</span>
                          <span className="text-sm text-gray-500">{itemsPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(itemsPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{totalItemsAchieved} itens</span>
                          <span>{goal.itemsPerSale} itens</span>
                        </div>
                      </div>

                      {/* Resumo das Semanas */}
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500 mb-2">Resultados por semana:</p>
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map(week => {
                            const weekResult = goal.weeklyResults.find(r => r.week === week);
                            return (
                              <div 
                                key={week} 
                                className={`text-center p-1 rounded text-xs ${
                                  weekResult ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                S{week}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Resultado Semanal */}
      <Dialog open={isResultModalOpen} onOpenChange={handleCloseResultModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Adicionar Resultado Semanal - {selectedGoal?.userName}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="week">Semana</Label>
              <select
                id="week"
                {...register("week")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione a semana</option>
                <option value="1">Semana 1</option>
                <option value="2">Semana 2</option>
                <option value="3">Semana 3</option>
                <option value="4">Semana 4</option>
              </select>
              {errors.week && (
                <p className="text-sm text-red-600">{errors.week.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesAchieved">Vendas Alcançadas (R$)</Label>
              <Input
                id="salesAchieved"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("salesAchieved")}
              />
              {errors.salesAchieved && (
                <p className="text-sm text-red-600">{errors.salesAchieved.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticketAchieved">Ticket Médio Alcançado (R$)</Label>
              <Input
                id="ticketAchieved"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("ticketAchieved")}
              />
              {errors.ticketAchieved && (
                <p className="text-sm text-red-600">{errors.ticketAchieved.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemsAchieved">Itens Vendidos</Label>
              <Input
                id="itemsAchieved"
                type="number"
                min="0"
                placeholder="0"
                {...register("itemsAchieved")}
              />
              {errors.itemsAchieved && (
                <p className="text-sm text-red-600">{errors.itemsAchieved.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseResultModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={resultMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {resultMutation.isPending ? "Salvando..." : "Salvar Resultado"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
