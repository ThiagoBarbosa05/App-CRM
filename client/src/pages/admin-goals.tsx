import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Target,
  Edit,
  Users,
  DollarSign,
  ShoppingCart,
  Package,
  Trash2,
  Phone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const goalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  salesGoal: z
    .string()
    .min(1, "Meta de vendas é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo",
    ),
  averageTicket: z
    .string()
    .min(1, "Ticket médio é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo",
    ),
  itemsPerSale: z
    .string()
    .min(1, "Itens por venda é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1",
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

const telemarketingGoalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  targetResult: z.string().min(1, "Resultado esperado é obrigatório"),
  targetQuantity: z
    .string()
    .min(1, "Quantidade é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1",
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

const clientRegistrationGoalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  targetQuantity: z
    .string()
    .min(1, "Quantidade é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1",
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

type GoalFormData = z.infer<typeof goalSchema>;
type TelemarketingGoalFormData = z.infer<typeof telemarketingGoalSchema>;
type ClientRegistrationGoalFormData = z.infer<
  typeof clientRegistrationGoalSchema
>;

interface TelemarketingGoal {
  id: string;
  userId: string;
  targetResult: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientRegistrationGoal {
  id: string;
  userId: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

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
  createdAt: string;
  updatedAt: string;
  weeklyResults: WeeklyResult[];
}

const weeklyResultSchema = z.object({
  goalId: z.string().min(1, "Meta é obrigatória"),
  week: z
    .string()
    .min(1, "Semana é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1",
    ),
  salesAchieved: z
    .string()
    .min(1, "Vendas atingidas é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo",
    ),
  ticketAchieved: z
    .string()
    .min(1, "Ticket atingido é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo",
    ),
  itemsAchieved: z
    .string()
    .min(1, "Itens atingidos é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1",
    ),
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
  const [selectedGoalForResults, setSelectedGoalForResults] =
    useState<UserGoal | null>(null);

  // Estado para metas de telemarketing
  const [isTelemarketingModalOpen, setIsTelemarketingModalOpen] =
    useState(false);
  const [editingTelemarketingGoal, setEditingTelemarketingGoal] =
    useState<TelemarketingGoal | null>(null);

  // Estado para metas de cadastros de clientes
  const [isClientRegistrationModalOpen, setIsClientRegistrationModalOpen] =
    useState(false);
  const [editingClientRegistrationGoal, setEditingClientRegistrationGoal] =
    useState<ClientRegistrationGoal | null>(null);

  // Estado para controlar mês/ano atual
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Verificar se o usuário é admin ou gerente
  if (user?.role !== "admin" && user?.role !== "gerente") {
    return (
      <div className=" flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página. Apenas
              administradores e gerentes podem gerenciar metas de usuários.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  });

  const {
    register: registerResult,
    handleSubmit: handleSubmitResult,
    reset: resetResult,
    setValue: setValueResult,
    formState: { errors: resultErrors },
  } = useForm<WeeklyResultFormData>({
    resolver: zodResolver(weeklyResultSchema),
  });

  // Buscar metas dos usuários do mês/ano selecionado
  const { data: userGoals = [], isLoading } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  // Buscar todos os usuários
  const { data: users = [] } = useQuery<
    { id: string; name: string; email: string; role: string }[]
  >({
    queryKey: ["/api/users"],
  });

  // Buscar metas de telemarketing
  const { data: telemarketingGoals = [] } = useQuery<TelemarketingGoal[]>({
    queryKey: [`/api/telemarketing-goals/${selectedMonth}/${selectedYear}`],
  });

  // Buscar metas de cadastros de clientes
  const clientRegistrationGoalsQuery = useQuery<ClientRegistrationGoal[]>({
    queryKey: [
      `/api/client-registration-goals/${selectedMonth}/${selectedYear}`,
    ],
  });
  const clientRegistrationGoals = clientRegistrationGoalsQuery.data || [];

  // Buscar estatísticas de cadastros de clientes
  const { data: clientRegistrationStats = [] } = useQuery<
    { userId: string; totalRegistrations: number }[]
  >({
    queryKey: [
      `/api/client-registration-stats/${selectedMonth}/${selectedYear}`,
    ],
  });

  // Form para telemarketing
  const {
    register: registerTelemarketing,
    handleSubmit: handleSubmitTelemarketing,
    reset: resetTelemarketing,
    setValue: setValueTelemarketing,
    formState: { errors: telemarketingErrors },
  } = useForm<TelemarketingGoalFormData>({
    resolver: zodResolver(telemarketingGoalSchema),
  });

  // Form para metas de cadastros de clientes
  const {
    register: registerClientRegistration,
    handleSubmit: handleSubmitClientRegistration,
    reset: resetClientRegistration,
    setValue: setValueClientRegistration,
    formState: { errors: clientRegistrationErrors },
  } = useForm<ClientRegistrationGoalFormData>({
    resolver: zodResolver(clientRegistrationGoalSchema),
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
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
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
        description:
          error.message ||
          `Erro ao ${editingGoal ? "atualizar" : "criar"} meta.`,
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
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
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

  // Mutation para deletar meta
  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest(`/api/user-goals/${goalId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: "Meta excluída",
        description: "Meta do usuário foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir meta.",
        variant: "destructive",
      });
    },
  });

  // Mutation para metas de telemarketing
  const telemarketingGoalMutation = useMutation({
    mutationFn: async (data: TelemarketingGoalFormData) => {
      const goalData = {
        userId: data.userId,
        targetResult: data.targetResult,
        targetQuantity: parseInt(data.targetQuantity),
        month: parseInt(data.month),
        year: parseInt(data.year),
      };

      if (editingTelemarketingGoal) {
        return apiRequest(
          `/api/telemarketing-goals/${editingTelemarketingGoal.id}`,
          "PUT",
          goalData,
        );
      } else {
        return apiRequest("/api/telemarketing-goals", "POST", goalData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/telemarketing-goals/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: editingTelemarketingGoal
          ? "Meta de telemarketing atualizada"
          : "Meta de telemarketing criada",
        description: `Meta de telemarketing foi ${editingTelemarketingGoal ? "atualizada" : "criada"} com sucesso.`,
      });
      handleCloseTelemarketingModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description:
          error.message ||
          `Erro ao ${editingTelemarketingGoal ? "atualizar" : "criar"} meta de telemarketing.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar meta de telemarketing
  const deleteTelemarketingMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest(`/api/telemarketing-goals/${goalId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/telemarketing-goals/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: "Meta de telemarketing excluída",
        description: "Meta de telemarketing foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir meta de telemarketing.",
        variant: "destructive",
      });
    },
  });

  // Mutation para metas de cadastros de clientes
  const clientRegistrationGoalMutation = useMutation({
    mutationFn: async (data: ClientRegistrationGoalFormData) => {
      const goalData = {
        userId: data.userId,
        targetQuantity: parseInt(data.targetQuantity),
        month: parseInt(data.month),
        year: parseInt(data.year),
      };

      if (editingClientRegistrationGoal) {
        return apiRequest(
          `/api/client-registration-goals/${editingClientRegistrationGoal.id}`,
          "PUT",
          goalData,
        );
      } else {
        return apiRequest("/api/client-registration-goals", "POST", goalData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/client-registration-goals/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: editingClientRegistrationGoal
          ? "Meta de cadastros atualizada"
          : "Meta de cadastros criada",
        description: `Meta de cadastros foi ${editingClientRegistrationGoal ? "atualizada" : "criada"} com sucesso.`,
      });
      handleCloseClientRegistrationModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description:
          error.message ||
          `Erro ao ${editingClientRegistrationGoal ? "atualizar" : "criar"} meta de cadastros.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar meta de cadastros
  const deleteClientRegistrationMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest(`/api/client-registration-goals/${goalId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/client-registration-goals/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: "Meta de cadastros excluída",
        description: "Meta de cadastros foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir meta de cadastros.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteGoal = (goal: UserGoal) => {
    if (confirm(`Tem certeza que deseja excluir a meta de ${goal.userName}?`)) {
      deleteMutation.mutate(goal.id);
    }
  };

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
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));
  };

  // Função para calcular o total alcançado até o momento
  const getTotalAchieved = (
    weeklyResults: WeeklyResult[],
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved",
  ) => {
    return weeklyResults.reduce((sum, result) => {
      if (field === "itemsAchieved") {
        return sum + result[field];
      }
      return sum + Number(result[field]);
    }, 0);
  };

  // Obter usuários sem metas para novo cadastro
  const usersWithoutGoals = users.filter(
    (user) => !userGoals.some((goal) => goal.userId === user.id),
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

  // Handlers para metas de telemarketing
  const handleEditTelemarketingGoal = (goal: TelemarketingGoal) => {
    setEditingTelemarketingGoal(goal);
    setValueTelemarketing("userId", goal.userId);
    setValueTelemarketing("targetResult", goal.targetResult);
    setValueTelemarketing("targetQuantity", goal.targetQuantity.toString());
    setValueTelemarketing("month", goal.month.toString());
    setValueTelemarketing("year", goal.year.toString());
    setIsTelemarketingModalOpen(true);
  };

  const handleCloseTelemarketingModal = () => {
    setIsTelemarketingModalOpen(false);
    setEditingTelemarketingGoal(null);
    resetTelemarketing();
  };

  const handleDeleteTelemarketingGoal = (goal: TelemarketingGoal) => {
    if (
      confirm(
        `Deseja realmente excluir a meta de telemarketing para ${goal.userName}?`,
      )
    ) {
      deleteTelemarketingMutation.mutate(goal.id);
    }
  };

  const onSubmitTelemarketing = (data: TelemarketingGoalFormData) => {
    telemarketingGoalMutation.mutate(data);
  };

  // Handlers para metas de cadastros de clientes
  const handleEditClientRegistrationGoal = (goal: ClientRegistrationGoal) => {
    setEditingClientRegistrationGoal(goal);
    setValueClientRegistration("userId", goal.userId);
    setValueClientRegistration(
      "targetQuantity",
      goal.targetQuantity.toString(),
    );
    setValueClientRegistration("month", goal.month.toString());
    setValueClientRegistration("year", goal.year.toString());
    setIsClientRegistrationModalOpen(true);
  };

  const handleCloseClientRegistrationModal = () => {
    setIsClientRegistrationModalOpen(false);
    setEditingClientRegistrationGoal(null);
    resetClientRegistration();
  };

  const handleDeleteClientRegistrationGoal = (goal: ClientRegistrationGoal) => {
    if (
      confirm(
        `Deseja realmente excluir a meta de cadastros para ${goal.userName}?`,
      )
    ) {
      deleteClientRegistrationMutation.mutate(goal.id);
    }
  };

  const onSubmitClientRegistration = (data: ClientRegistrationGoalFormData) => {
    clientRegistrationGoalMutation.mutate(data);
  };

  return (
    <div>
      <div className="flex-1 ml-0 ">
        <div className="max-w-7xl  mx-auto">
          <div className="mb-8 flex flex-col items-start gap-4">
            <div>
              <h1 className="text-3xl text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Target className="h-8 w-8 shrink-0 text-blue-600" />
                Administração de Metas
              </h1>
              <p className="text-gray-600 text-sm sm:text-base mt-2">
                Gerencie as metas de vendas, ticket médio e itens por venda de
                todos os usuários do sistema
              </p>
            </div>

            <div className="flex items-center flex-wrap flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="month-select">Mês:</Label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                        month: "long",
                      })}
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
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
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
                <CardTitle className="text-sm font-medium">
                  Total de Usuários
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Metas Definidas
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Meta Total
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    userGoals
                      .reduce((sum, goal) => sum + Number(goal.salesGoal), 0)
                      .toString(),
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Soma de todas as metas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Ticket Médio Geral
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userGoals.length > 0
                    ? formatCurrency(
                        (
                          userGoals.reduce(
                            (sum, goal) => sum + Number(goal.averageTicket),
                            0,
                          ) / userGoals.length
                        ).toString(),
                      )
                    : "R$ 0,00"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Média dos tickets
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs para Metas de Vendas, Telemarketing e Cadastros */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="admin-metas">
                <Target className="h-4 w-4 mr-2" />
                Metas de Vendas
              </TabsTrigger>
              <TabsTrigger value="metas-telemarketing">
                <Phone className="h-4 w-4 mr-2" />
                Metas de Ligação
              </TabsTrigger>
              <TabsTrigger value="metas-cadastros">
                <Users className="h-4 w-4 mr-2" />
                Metas de Cadastros
              </TabsTrigger>
            </TabsList>

            {/* Tab Content: Metas de Vendas */}
            <TabsContent value="admin-metas" className="w-full overflow-hidden">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-2xl">
                    <Users className="h-5 w-5" />
                    Metas de Vendas por Usuário
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Lista de todos os usuários e suas respectivas metas de
                    vendas
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-500">Carregando metas...</div>
                    </div>
                  ) : userGoals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">
                        Nenhuma meta cadastrada
                      </p>
                      <p className="text-sm">
                        Comece definindo metas para os usuários do sistema
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Meta de Vendas</TableHead>
                            <TableHead>Valor Alcançado</TableHead>
                            <TableHead>Ticket Médio</TableHead>
                            <TableHead>Itens por Venda</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="">
                          {userGoals.map((goal) => {
                            const totalSalesAchieved = getTotalAchieved(
                              goal.weeklyResults || [],
                              "salesAchieved",
                            );
                            const progressPercentage =
                              Number(goal.salesGoal) > 0
                                ? Math.min(
                                    (totalSalesAchieved /
                                      Number(goal.salesGoal)) *
                                      100,
                                    100,
                                  )
                                : 0;

                            return (
                              <TableRow key={goal.id}>
                                <TableCell className="font-medium">
                                  {goal.userName}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {new Date(
                                    0,
                                    goal.month - 1,
                                  ).toLocaleDateString("pt-BR", {
                                    month: "long",
                                  })}{" "}
                                  {goal.year}
                                </TableCell>
                                <TableCell className="font-semibold text-green-600">
                                  {formatCurrency(goal.salesGoal)}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  <div className="flex flex-col gap-1">
                                    <span
                                      className={`${progressPercentage >= 100 ? "text-green-600" : progressPercentage >= 75 ? "text-blue-600" : progressPercentage >= 50 ? "text-orange-600" : "text-red-600"}`}
                                    >
                                      {formatCurrency(
                                        totalSalesAchieved.toString(),
                                      )}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {progressPercentage.toFixed(1)}% da meta
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold text-blue-600">
                                  {formatCurrency(goal.averageTicket)}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {goal.itemsPerSale} itens
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
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
                                      onClick={() =>
                                        handleOpenResultModal(goal)
                                      }
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Add result
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteGoal(goal)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      disabled={deleteMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Excluir
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Content: Metas de Telemarketing */}
            <TabsContent
              value="metas-telemarketing"
              className="w-full overflow-hidden"
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items:start gap-2 sm:items-center justify-between">
                    <div>
                      <CardTitle className="flex text-sm sm:text-2xl items-center gap-2">
                        <Phone className="size-4 sm:size-5" />
                        Metas de Ligação por Usuário
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-base">
                        Gestão de metas baseadas em resultados de ligação
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setValueTelemarketing(
                          "month",
                          selectedMonth.toString(),
                        );
                        setValueTelemarketing("year", selectedYear.toString());
                        setIsTelemarketingModalOpen(true);
                      }}
                      className="bg-purple-600 text-white hover:bg-purple-700"
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Nova Meta de Ligação
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {telemarketingGoals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">
                        Nenhuma meta de ligação cadastrada
                      </p>
                      <p className="text-sm">
                        Comece definindo metas de ligação para os usuários
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Resultado Esperado</TableHead>
                            <TableHead>Meta de Quantidade</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {telemarketingGoals.map((goal) => (
                            <TableRow key={goal.id}>
                              <TableCell className="font-medium">
                                {goal.userName}
                              </TableCell>
                              <TableCell className="font-medium">
                                {new Date(0, goal.month - 1).toLocaleDateString(
                                  "pt-BR",
                                  { month: "long" },
                                )}{" "}
                                {goal.year}
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  {goal.targetResult}
                                </span>
                              </TableCell>
                              <TableCell className="font-semibold text-purple-600">
                                {goal.targetQuantity} chamadas
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleEditTelemarketingGoal(goal)
                                    }
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteTelemarketingGoal(goal)
                                    }
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={
                                      deleteTelemarketingMutation.isPending
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Excluir
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab de Metas de Cadastros */}
            <TabsContent
              value="metas-cadastros"
              className="w-full overflow-hidden"
            >
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row items-start justify-between sm:items-center">
                    <CardTitle className="text-xl font-bold text-emerald-700">
                      Metas de Cadastros de Clientes
                    </CardTitle>
                    <Button
                      onClick={() => {
                        setValueClientRegistration(
                          "month",
                          selectedMonth.toString(),
                        );
                        setValueClientRegistration(
                          "year",
                          selectedYear.toString(),
                        );
                        setIsClientRegistrationModalOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Nova Meta
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {clientRegistrationGoalsQuery.isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="text-gray-500">
                        Carregando metas de cadastros...
                      </div>
                    </div>
                  ) : clientRegistrationGoals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma meta de cadastros definida para este período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Meta</TableHead>
                            <TableHead>Alcançado</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Porcentagem</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientRegistrationGoals.map((goal) => {
                            // Buscar estatísticas do usuário
                            const userStats = clientRegistrationStats.find(
                              (stat) => stat.userId === goal.userId,
                            );
                            const achieved = userStats
                              ? userStats.totalRegistrations
                              : 0;
                            const percentage =
                              goal.targetQuantity > 0
                                ? (achieved / goal.targetQuantity) * 100
                                : 0;

                            return (
                              <TableRow key={goal.id}>
                                <TableCell className="font-medium">
                                  {goal.userName}
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold text-emerald-600">
                                    {goal.targetQuantity} clientes
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold">
                                    {achieved} clientes
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="w-32">
                                    <div className="bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                                        style={{
                                          width: `${Math.min(percentage, 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`font-semibold ${
                                      percentage >= 100
                                        ? "text-emerald-600"
                                        : percentage >= 50
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                    }`}
                                  >
                                    {percentage.toFixed(1)}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleEditClientRegistrationGoal(goal)
                                      }
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Editar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDeleteClientRegistrationGoal(goal)
                                      }
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      disabled={
                                        deleteClientRegistrationMutation.isPending
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Excluir
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
                      .filter((u) => u.id === editingGoal.userId)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))
                  : usersWithoutGoals.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
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
                <p className="text-sm text-red-600">
                  {errors.salesGoal.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {errors.averageTicket.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {errors.itemsPerSale.message}
                </p>
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
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                        month: "long",
                      })}
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
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i,
                  ).map((year) => (
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
                    : "Criar Meta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Modal de formulário de resultado semanal */}
      <Dialog open={isResultModalOpen} onOpenChange={handleCloseResultModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Resultado Semanal</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmitResult(onSubmitResult)}
            className="space-y-4"
          >
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
                <p className="text-sm text-red-600">
                  {resultErrors.week.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {resultErrors.salesAchieved.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {resultErrors.ticketAchieved.message}
                </p>
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
                <p className="text-sm text-red-600">
                  {resultErrors.itemsAchieved.message}
                </p>
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

      {/* Modal de metas de telemarketing */}
      <Dialog
        open={isTelemarketingModalOpen}
        onOpenChange={handleCloseTelemarketingModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTelemarketingGoal
                ? "Editar Meta de Ligação"
                : "Nova Meta de Ligação"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmitTelemarketing(onSubmitTelemarketing)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="telemarketingUserId">Usuário</Label>
              <select
                id="telemarketingUserId"
                {...registerTelemarketing("userId")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={!!editingTelemarketingGoal}
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {telemarketingErrors.userId && (
                <p className="text-sm text-red-600">
                  {telemarketingErrors.userId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetResult">Resultado Esperado</Label>
              <select
                id="targetResult"
                {...registerTelemarketing("targetResult")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione um resultado</option>
                <option value="COM SUCESSO">COM SUCESSO</option>
                <option value="NÃO ATENDIDA">NÃO ATENDIDA</option>
                <option value="SEM INTERESSE">SEM INTERESSE</option>
                <option value="NÃO LIGAR MAIS">NÃO LIGAR MAIS</option>
                <option value="EM OCUPADO">EM OCUPADO</option>
                <option value="OUTROS">OUTROS</option>
              </select>
              {telemarketingErrors.targetResult && (
                <p className="text-sm text-red-600">
                  {telemarketingErrors.targetResult.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetQuantity">Meta de Quantidade</Label>
              <Input
                id="targetQuantity"
                type="number"
                min="1"
                placeholder="Quantidade de chamadas"
                {...registerTelemarketing("targetQuantity")}
              />
              {telemarketingErrors.targetQuantity && (
                <p className="text-sm text-red-600">
                  {telemarketingErrors.targetQuantity.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telemarketingMonth">Mês</Label>
                <select
                  id="telemarketingMonth"
                  {...registerTelemarketing("month")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={!!editingTelemarketingGoal}
                >
                  <option value="">Selecione o mês</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
                {telemarketingErrors.month && (
                  <p className="text-sm text-red-600">
                    {telemarketingErrors.month.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telemarketingYear">Ano</Label>
                <select
                  id="telemarketingYear"
                  {...registerTelemarketing("year")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={!!editingTelemarketingGoal}
                >
                  <option value="">Selecione o ano</option>
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {telemarketingErrors.year && (
                  <p className="text-sm text-red-600">
                    {telemarketingErrors.year.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseTelemarketingModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={telemarketingGoalMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {telemarketingGoalMutation.isPending
                  ? "Salvando..."
                  : editingTelemarketingGoal
                    ? "Atualizar Meta"
                    : "Criar Meta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de metas de cadastros de clientes */}
      <Dialog
        open={isClientRegistrationModalOpen}
        onOpenChange={handleCloseClientRegistrationModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClientRegistrationGoal
                ? "Editar Meta de Cadastros"
                : "Nova Meta de Cadastros"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmitClientRegistration(
              onSubmitClientRegistration,
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="clientRegistrationUserId">Usuário</Label>
              <select
                id="clientRegistrationUserId"
                {...registerClientRegistration("userId")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={!!editingClientRegistrationGoal}
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {clientRegistrationErrors.userId && (
                <p className="text-sm text-red-600">
                  {clientRegistrationErrors.userId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientRegistrationTargetQuantity">
                Quantidade de Clientes
              </Label>
              <Input
                id="clientRegistrationTargetQuantity"
                type="number"
                min="1"
                placeholder="50"
                {...registerClientRegistration("targetQuantity")}
              />
              {clientRegistrationErrors.targetQuantity && (
                <p className="text-sm text-red-600">
                  {clientRegistrationErrors.targetQuantity.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientRegistrationMonth">Mês</Label>
                <select
                  id="clientRegistrationMonth"
                  {...registerClientRegistration("month")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={!!editingClientRegistrationGoal}
                >
                  <option value="">Selecione o mês</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
                {clientRegistrationErrors.month && (
                  <p className="text-sm text-red-600">
                    {clientRegistrationErrors.month.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientRegistrationYear">Ano</Label>
                <select
                  id="clientRegistrationYear"
                  {...registerClientRegistration("year")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={!!editingClientRegistrationGoal}
                >
                  <option value="">Selecione o ano</option>
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {clientRegistrationErrors.year && (
                  <p className="text-sm text-red-600">
                    {clientRegistrationErrors.year.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseClientRegistrationModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={clientRegistrationGoalMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {clientRegistrationGoalMutation.isPending
                  ? "Salvando..."
                  : editingClientRegistrationGoal
                    ? "Atualizar Meta"
                    : "Criar Meta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}