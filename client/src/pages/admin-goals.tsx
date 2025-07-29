import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Target, Edit, Users, DollarSign, ShoppingCart, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const goalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  salesGoal: z.string().min(1, "Meta de vendas é obrigatória").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
  averageTicket: z.string().min(1, "Ticket médio é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
  itemsPerSale: z.string().min(1, "Itens por venda é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 1, "Deve ser pelo menos 1"),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

type GoalFormData = z.infer<typeof goalSchema>;

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
  createdAt: string;
  updatedAt: string;
}

const weeklyResultSchema = z.object({
  goalId: z.string().min(1, "Meta é obrigatória"),
  week: z.string().min(1, "Semana é obrigatória").refine((val) => !isNaN(Number(val)) && Number(val) >= 1, "Deve ser pelo menos 1"),
  salesAchieved: z.string().min(1, "Vendas atingidas é obrigatória").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
  ticketAchieved: z.string().min(1, "Ticket atingido é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Valor deve ser um número positivo"),
  itemsAchieved: z.string().min(1, "Itens atingidos é obrigatório").refine((val) => !isNaN(Number(val)) && Number(val) >= 1, "Deve ser pelo menos 1"),
});

type WeeklyResultFormData = z.infer<typeof weeklyResultSchema>;

export default function AdminGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("admin-metas");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedGoalForResults, setSelectedGoalForResults] = useState<UserGoal | null>(null);

  // Estado para controlar mês/ano atual
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Verificar se o usuário é admin
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
              Apenas administradores podem gerenciar metas de usuários.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  });

  const { register: registerResult, handleSubmit: handleSubmitResult, reset: resetResult, setValue: setValueResult, formState: { errors: resultErrors } } = useForm<WeeklyResultFormData>({
    resolver: zodResolver(weeklyResultSchema),
  });

  // Buscar metas dos usuários do mês/ano selecionado
  const { data: userGoals = [], isLoading } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  // Buscar todos os usuários
  const { data: users = [] } = useQuery<{id: string; name: string; email: string; role: string}[]>({
    queryKey: ["/api/users"],
  });

  // Mutation para criar/atualizar meta
  const goalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const goalData = {
        userId: data.userId,
        salesGoal: data.salesGoal,
        averageTicket: data.averageTicket,
        itemsPerSale: parseInt(data.itemsPerSale),
        month: parseInt(data.month),
        year: parseInt(data.year),
      };

      if (editingGoal) {
        return apiRequest(`/api/user-goals/${editingGoal.id}`, "PUT", goalData);
      } else {
        return apiRequest("/api/user-goals", "POST", goalData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`] });
      toast({
        title: editingGoal ? "Meta atualizada" : "Meta criada",
        description: `Meta do usuário foi ${editingGoal ? "atualizada" : "criada"} com sucesso.`,
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      console.error("Error creating goal:", error);
      toast({
        title: "Erro",
        description: error.message || `Erro ao ${editingGoal ? "atualizar" : "criar"} meta.`,
        variant: "destructive",
      });
    },
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

  const handleEditGoal = (goal: UserGoal) => {
    setEditingGoal(goal);
    setValue("userId", goal.userId);
    setValue("salesGoal", goal.salesGoal);
    setValue("averageTicket", goal.averageTicket);
    setValue("itemsPerSale", goal.itemsPerSale.toString());
    setValue("month", goal.month.toString());
    setValue("year", goal.year.toString());
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
    reset();
  };

  const onSubmit = (data: GoalFormData) => {
    goalMutation.mutate(data);
  };

  // Função para formatar valores monetários
  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value));
  };

  // Obter usuários sem metas para novo cadastro
  const usersWithoutGoals = users.filter(user => 
    !userGoals.some(goal => goal.userId === user.id)
  );

    const handleOpenResultModal = (goal: UserGoal) => {
    setSelectedGoalForResults(goal);
    setValueResult("goalId", goal.id);
    setIsResultModalOpen(true);
  };

  const handleCloseResultModal = () => {
    setIsResultModalOpen(false);
    setSelectedGoalForResults(null);
    resetResult();
  };

  const onSubmitResult = (data: WeeklyResultFormData) => {
    resultMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 sm:ml-64">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <Target className="h-8 w-8 text-blue-600" />
                  Administração de Metas
                </h1>
                <p className="text-gray-600 mt-2">
                  Gerencie as metas de vendas, ticket médio e itens por venda de todos os usuários do sistema
                </p>
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

              <Button 
                onClick={() => {
                  setValue("month", selectedMonth.toString());
                  setValue("year", selectedYear.toString());
                  setIsModalOpen(true);
                }}
                disabled={usersWithoutGoals.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Target className="mr-2 h-4 w-4" />
                Nova Meta
              </Button>
            </div>
          </div>

          {/* Cards com estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">
                  Usuários cadastrados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Metas Definidas</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userGoals.length}</div>
                <p className="text-xs text-muted-foreground">
                  Usuários com metas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meta Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    userGoals.reduce((sum, goal) => sum + Number(goal.salesGoal), 0).toString()
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Soma de todas as metas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio Geral</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userGoals.length > 0 
                    ? formatCurrency(
                        (userGoals.reduce((sum, goal) => sum + Number(goal.averageTicket), 0) / userGoals.length).toString()
                      )
                    : "R$ 0,00"
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Média dos tickets
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de metas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Metas por Usuário
              </CardTitle>
              <CardDescription>
                Lista de todos os usuários e suas respectivas metas de vendas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Carregando metas...</div>
                </div>
              ) : userGoals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Nenhuma meta cadastrada</p>
                  <p className="text-sm">Comece definindo metas para os usuários do sistema</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Meta de Vendas</TableHead>
                        <TableHead>Ticket Médio</TableHead>
                        <TableHead>Itens por Venda</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userGoals.map((goal) => (
                        <TableRow key={goal.id}>
                          <TableCell className="font-medium">{goal.userName}</TableCell>
                          <TableCell>{goal.userEmail}</TableCell>
                          <TableCell className="font-medium">
                            {new Date(0, goal.month - 1).toLocaleDateString('pt-BR', { month: 'long' })} {goal.year}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(goal.salesGoal)}
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600">
                            {formatCurrency(goal.averageTicket)}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {goal.itemsPerSale} itens
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditGoal(goal)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                             <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenResultModal(goal)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Add result
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal de formulário */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? "Editar Meta" : "Nova Meta de Usuário"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">Usuário</Label>
              <select
                id="userId"
                {...register("userId")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!!editingGoal}
              >
                <option value="">Selecione um usuário</option>
                {editingGoal 
                  ? users
                      .filter(u => u.id === editingGoal.userId)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))
                  : usersWithoutGoals.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))
                }
              </select>
              {errors.userId && (
                <p className="text-sm text-red-600">{errors.userId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesGoal">Meta de Vendas (R$)</Label>
              <Input
                id="salesGoal"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("salesGoal")}
              />
              {errors.salesGoal && (
                <p className="text-sm text-red-600">{errors.salesGoal.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="averageTicket">Ticket Médio (R$)</Label>
              <Input
                id="averageTicket"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("averageTicket")}
              />
              {errors.averageTicket && (
                <p className="text-sm text-red-600">{errors.averageTicket.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemsPerSale">Itens por Venda</Label>
              <Input
                id="itemsPerSale"
                type="number"
                min="1"
                placeholder="1"
                {...register("itemsPerSale")}
              />
              {errors.itemsPerSale && (
                <p className="text-sm text-red-600">{errors.itemsPerSale.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">Mês</Label>
                <select
                  id="month"
                  {...register("month")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!editingGoal}
                >
                  <option value="">Selecione o mês</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                    </option>
                  ))}
                </select>
                {errors.month && (
                  <p className="text-sm text-red-600">{errors.month.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Ano</Label>
                <select
                  id="year"
                  {...register("year")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!editingGoal}
                >
                  <option value="">Selecione o ano</option>
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {errors.year && (
                  <p className="text-sm text-red-600">{errors.year.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={goalMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {goalMutation.isPending 
                  ? "Salvando..." 
                  : editingGoal 
                    ? "Atualizar Meta" 
                    : "Criar Meta"
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
       {/* Modal de formulário de resultado semanal */}
      <Dialog open={isResultModalOpen} onOpenChange={handleCloseResultModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Adicionar Resultado Semanal
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitResult(onSubmitResult)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="week">Semana</Label>
              <Input
                id="week"
                type="number"
                min="1"
                placeholder="1"
                {...registerResult("week")}
              />
              {resultErrors.week && (
                <p className="text-sm text-red-600">{resultErrors.week.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesAchieved">Vendas Atingidas (R$)</Label>
              <Input
                id="salesAchieved"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...registerResult("salesAchieved")}
              />
              {resultErrors.salesAchieved && (
                <p className="text-sm text-red-600">{resultErrors.salesAchieved.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticketAchieved">Ticket Médio Atingido (R$)</Label>
              <Input
                id="ticketAchieved"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...registerResult("ticketAchieved")}
              />
              {resultErrors.ticketAchieved && (
                <p className="text-sm text-red-600">{resultErrors.ticketAchieved.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemsAchieved">Itens por Venda Atingidos</Label>
              <Input
                id="itemsAchieved"
                type="number"
                min="1"
                placeholder="1"
                {...registerResult("itemsAchieved")}
              />
              {resultErrors.itemsAchieved && (
                <p className="text-sm text-red-600">{resultErrors.itemsAchieved.message}</p>
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
                {resultMutation.isPending
                  ? "Salvando..."
                  : "Salvar Resultado"
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}