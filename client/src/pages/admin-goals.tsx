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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
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
  MessageSquare,
  Plus,
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
      "Valor deve ser um número positivo"
    ),
  averageTicket: z
    .string()
    .min(1, "Ticket médio é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo"
    ),
  itemsPerSale: z
    .string()
    .min(1, "Itens por venda é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1"
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
      "Deve ser pelo menos 1"
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
      "Deve ser pelo menos 1"
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

const markerGoalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  markerName: z.string().min(1, "Nome do marcador é obrigatório"),
  targetQuantity: z
    .string()
    .min(1, "Quantidade é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1"
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

const interactionGoalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  interactionType: z.string().min(1, "Tipo de interação é obrigatório"),
  targetQuantity: z
    .string()
    .min(1, "Quantidade é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1"
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

type GoalFormData = z.infer<typeof goalSchema>;
type TelemarketingGoalFormData = z.infer<typeof telemarketingGoalSchema>;
type ClientRegistrationGoalFormData = z.infer<
  typeof clientRegistrationGoalSchema
>;
type MarkerGoalFormData = z.infer<typeof markerGoalSchema>;
type InteractionGoalFormData = z.infer<typeof interactionGoalSchema>;

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

interface MarkerGoal {
  id: string;
  userId: string;
  markerName: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface InteractionGoal {
  id: string;
  userId: string;
  interactionType: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface MarkerStats {
  markerName: string;
  totalClients: number;
  userId: string;
  userName: string;
  userEmail: string;
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
      "Deve ser pelo menos 1"
    ),
  salesAchieved: z
    .string()
    .min(1, "Vendas atingidas é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo"
    ),
  ticketAchieved: z
    .string()
    .min(1, "Ticket atingido é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo"
    ),
  itemsAchieved: z
    .string()
    .min(1, "Itens atingidos é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1"
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

  // Estado para metas de marcadores
  const [isMarkerGoalModalOpen, setIsMarkerGoalModalOpen] = useState(false);
  const [editingMarkerGoal, setEditingMarkerGoal] = useState<MarkerGoal | null>(
    null
  );

  // Estado para metas de interações
  const [isInteractionGoalModalOpen, setIsInteractionGoalModalOpen] =
    useState(false);
  const [editingInteractionGoal, setEditingInteractionGoal] =
    useState<InteractionGoal | null>(null);

  // Estado para controlar mês/ano atual
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Verificar se o usuário é admin ou gerente
  if (user?.role !== "admin" && user?.role !== "gerente") {
    return (
      <div className=" flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Acesso Negado</CardTitle>
            <CardDescription className="dark:text-slate-400">
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

  // Buscar metas de marcadores
  const { data: markerGoals = [] } = useQuery<MarkerGoal[]>({
    queryKey: [`/api/marker-goals/${selectedMonth}/${selectedYear}`],
  });

  // Buscar estatísticas de marcadores
  const { data: markerStats = [] } = useQuery<MarkerStats[]>({
    queryKey: [`/api/marker-stats/${selectedMonth}/${selectedYear}`],
  });

  // Buscar marcadores cadastrados
  const { data: availableMarkers = [] } = useQuery<
    { id: string; name: string; color: string }[]
  >({
    queryKey: ["/api/tags/markers"],
  });

  // Buscar metas de interações
  const { data: interactionGoals = [] } = useQuery<InteractionGoal[]>({
    queryKey: [`/api/interaction-goals/${selectedMonth}/${selectedYear}`],
  });

  // Buscar estatísticas de interações
  const { data: interactionStats = [] } = useQuery<
    {
      interactionType: string;
      totalInteractions: number;
      userId: string;
      userName: string;
      userEmail: string;
    }[]
  >({
    queryKey: [`/api/interaction-stats/${selectedMonth}/${selectedYear}`],
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

  // Form para metas de marcadores
  const {
    register: registerMarker,
    handleSubmit: handleSubmitMarker,
    reset: resetMarker,
    setValue: setValueMarker,
    watch: watchMarker,
    control: formMarkerControl,
    formState: { errors: markerErrors },
  } = useForm<MarkerGoalFormData>({
    resolver: zodResolver(markerGoalSchema),
    defaultValues: {
      markerName: "",
    },
  });

  // Form para metas de interações
  const {
    register: registerInteraction,
    handleSubmit: handleSubmitInteraction,
    reset: resetInteraction,
    setValue: setValueInteraction,
    formState: { errors: interactionErrors },
  } = useForm<InteractionGoalFormData>({
    resolver: zodResolver(interactionGoalSchema),
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
        return apiRequest("PUT", `/api/user-goals/${editingGoal.id}`, goalData);
      } else {
        return apiRequest("POST", "/api/user-goals", goalData);
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
        description: `Meta do usuário foi ${
          editingGoal ? "atualizada" : "criada"
        } com sucesso.`,
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

      return apiRequest("POST", "/api/weekly-results", resultData);
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
      return apiRequest("DELETE", `/api/user-goals/${goalId}`);
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
          "PUT",
          `/api/telemarketing-goals/${editingTelemarketingGoal.id}`,
          goalData
        );
      } else {
        return apiRequest("POST", "/api/telemarketing-goals", goalData);
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
        description: `Meta de telemarketing foi ${
          editingTelemarketingGoal ? "atualizada" : "criada"
        } com sucesso.`,
      });
      handleCloseTelemarketingModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description:
          error.message ||
          `Erro ao ${
            editingTelemarketingGoal ? "atualizar" : "criar"
          } meta de telemarketing.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar meta de telemarketing
  const deleteTelemarketingMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/telemarketing-goals/${goalId}`);
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
          "PUT",
          `/api/client-registration-goals/${editingClientRegistrationGoal.id}`,
          goalData
        );
      } else {
        return apiRequest("POST", "/api/client-registration-goals", goalData);
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
        description: `Meta de cadastros foi ${
          editingClientRegistrationGoal ? "atualizada" : "criada"
        } com sucesso.`,
      });
      handleCloseClientRegistrationModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description:
          error.message ||
          `Erro ao ${
            editingClientRegistrationGoal ? "atualizar" : "criar"
          } meta de cadastros.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar meta de cadastros
  const deleteClientRegistrationMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/client-registration-goals/${goalId}`);
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

  // Mutation para metas de marcadores
  const markerGoalMutation = useMutation({
    mutationFn: async (data: MarkerGoalFormData) => {
      const goalData = {
        userId: data.userId,
        markerName: data.markerName,
        targetQuantity: parseInt(data.targetQuantity),
        month: parseInt(data.month),
        year: parseInt(data.year),
      };

      if (editingMarkerGoal) {
        return apiRequest(
          "PUT",
          `/api/marker-goals/${editingMarkerGoal.id}`,
          goalData
        );
      } else {
        return apiRequest("POST", "/api/marker-goals", goalData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/marker-goals/${selectedMonth}/${selectedYear}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/marker-stats/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: editingMarkerGoal
          ? "Meta de marcadores atualizada"
          : "Meta de marcadores criada",
        description: `Meta de marcadores foi ${
          editingMarkerGoal ? "atualizada" : "criada"
        } com sucesso.`,
      });
      handleCloseMarkerGoalModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description:
          error.message ||
          `Erro ao ${
            editingMarkerGoal ? "atualizar" : "criar"
          } meta de marcadores.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar meta de marcadores
  const deleteMarkerGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/marker-goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/marker-goals/${selectedMonth}/${selectedYear}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/marker-stats/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: "Meta de marcadores excluída",
        description: "Meta de marcadores foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir meta de marcadores.",
        variant: "destructive",
      });
    },
  });

  // Mutation para metas de interações
  const interactionGoalMutation = useMutation({
    mutationFn: async (data: InteractionGoalFormData) => {
      const goalData = {
        userId: data.userId,
        interactionType: data.interactionType,
        targetQuantity: parseInt(data.targetQuantity),
        month: parseInt(data.month),
        year: parseInt(data.year),
      };

      if (editingInteractionGoal) {
        return apiRequest(
          "PUT",
          `/api/interaction-goals/${editingInteractionGoal.id}`,
          goalData
        );
      } else {
        return apiRequest("POST", "/api/interaction-goals", goalData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/interaction-goals/${selectedMonth}/${selectedYear}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/interaction-stats/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: editingInteractionGoal
          ? "Meta de interações atualizada"
          : "Meta de interações criada",
        description: `Meta de interações foi ${
          editingInteractionGoal ? "atualizada" : "criada"
        } com sucesso.`,
      });
      handleCloseInteractionGoalModal();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description:
          error.message ||
          `Erro ao ${
            editingInteractionGoal ? "atualizar" : "criar"
          } meta de interações.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar meta de interações
  const deleteInteractionGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/interaction-goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/interaction-goals/${selectedMonth}/${selectedYear}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/interaction-stats/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: "Meta de interações excluída",
        description: "Meta de interações foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir meta de interações.",
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
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved"
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
    (user) => !userGoals.some((goal) => goal.userId === user.id)
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
        `Deseja realmente excluir a meta de telemarketing para ${goal.userName}?`
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
      goal.targetQuantity.toString()
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
        `Deseja realmente excluir a meta de cadastros para ${goal.userName}?`
      )
    ) {
      deleteClientRegistrationMutation.mutate(goal.id);
    }
  };

  const onSubmitClientRegistration = (data: ClientRegistrationGoalFormData) => {
    clientRegistrationGoalMutation.mutate(data);
  };

  // Handlers para metas de marcadores
  const handleEditMarkerGoal = (goal: MarkerGoal) => {
    setEditingMarkerGoal(goal);
    setValueMarker("userId", goal.userId);
    setValueMarker("markerName", goal.markerName);
    setValueMarker("targetQuantity", goal.targetQuantity.toString());
    setValueMarker("month", goal.month.toString());
    setValueMarker("year", goal.year.toString());
    setIsMarkerGoalModalOpen(true);
  };

  const handleCloseMarkerGoalModal = () => {
    setIsMarkerGoalModalOpen(false);
    setEditingMarkerGoal(null);
    resetMarker();
  };

  const handleDeleteMarkerGoal = (goal: MarkerGoal) => {
    if (
      confirm(
        `Deseja realmente excluir a meta de marcadores para ${goal.userName}?`
      )
    ) {
      deleteMarkerGoalMutation.mutate(goal.id);
    }
  };

  const onSubmitMarkerGoal = (data: MarkerGoalFormData) => {
    markerGoalMutation.mutate(data);
  };

  // Handlers para metas de interações
  const handleEditInteractionGoal = (goal: InteractionGoal) => {
    setEditingInteractionGoal(goal);
    setValueInteraction("userId", goal.userId);
    setValueInteraction("interactionType", goal.interactionType);
    setValueInteraction("targetQuantity", goal.targetQuantity.toString());
    setValueInteraction("month", goal.month.toString());
    setValueInteraction("year", goal.year.toString());
    setIsInteractionGoalModalOpen(true);
  };

  const handleCloseInteractionGoalModal = () => {
    setIsInteractionGoalModalOpen(false);
    setEditingInteractionGoal(null);
    resetInteraction();
  };

  const handleDeleteInteractionGoal = (goal: InteractionGoal) => {
    if (
      confirm(
        `Deseja realmente excluir a meta de interações para ${goal.userName}?`
      )
    ) {
      deleteInteractionGoalMutation.mutate(goal.id);
    }
  };

  const onSubmitInteractionGoal = (data: InteractionGoalFormData) => {
    interactionGoalMutation.mutate(data);
  };

  return (
    <div>
      <div className="flex-1 ml-0 ">
        <div className="">
          <div className="bg-white dark:bg-slate-950 border-b dark:border dark:border-slate-700 border-gray-200 px-4 sm:px-6 py-4 rounded-lg shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <Target className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
                    Administração de Metas
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1 overflow-hidden">
                    Gerencie as metas de vendas, ticket médio e itens por venda
                    de todos os usuários do sistema
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                <div className="flex  xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="month-select"
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      Mês:
                    </Label>
                    <select
                      id="month-select"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="flex-1 xs:flex-none min-w-0 px-2 sm:px-3 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(
                        (month) => (
                          <option key={month} value={month}>
                            {new Date(0, month - 1).toLocaleDateString(
                              "pt-BR",
                              {
                                month: "long",
                              }
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="year-select"
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      Ano:
                    </Label>
                    <select
                      id="year-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="flex-1 xs:flex-none min-w-0 px-2 sm:px-3 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Array.from(
                        { length: 5 },
                        (_, i) => currentDate.getFullYear() - 2 + i
                      ).map((year) => (
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
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto shrink-0"
                >
                  <Target className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Nova Meta</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Cards com estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-6 gap-4 lg:gap-6 mb-8">
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Total de Usuários
                </CardTitle>
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {users.length}
                </div>
                <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400">
                  Usuários cadastrados
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Metas Definidas
                </CardTitle>
                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-2 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 transition-colors">
                  <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {userGoals.length}
                </div>
                <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400">
                  Usuários com metas
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                  Meta Total
                </CardTitle>
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                  <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {formatCurrency(
                    userGoals
                      .reduce((sum, goal) => sum + Number(goal.salesGoal), 0)
                      .toString()
                  )}
                </div>
                <p className="text-xs font-medium text-purple-600/70 dark:text-purple-400">
                  Soma de todas as metas
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                  Ticket Médio Geral
                </CardTitle>
                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40 transition-colors">
                  <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {userGoals.length > 0
                    ? formatCurrency(
                        (
                          userGoals.reduce(
                            (sum, goal) => sum + Number(goal.averageTicket),
                            0
                          ) / userGoals.length
                        ).toString()
                      )
                    : "R$ 0,00"}
                </div>
                <p className="text-xs font-medium text-orange-600/70 dark:text-orange-400">
                  Média dos tickets
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs para Metas de Vendas, Telemarketing, Cadastros, Marcadores e Interações */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1 p-1 bg-gray-50 dark:bg-gray-900 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700 h-auto">
              <TabsTrigger
                value="admin-metas"
                className="group flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
              >
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-md p-1.5 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 group-data-[state=active]:bg-blue-200 dark:group-data-[state=active]:bg-blue-800/40 transition-colors">
                  <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="hidden sm:inline truncate">
                  Metas de Vendas
                </span>
                <span className="sm:hidden truncate">Vendas</span>
              </TabsTrigger>
              <TabsTrigger
                value="metas-telemarketing"
                className="group flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-md p-1.5 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 group-data-[state=active]:bg-purple-200 dark:group-data-[state=active]:bg-purple-800/40 transition-colors">
                  <Phone className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="hidden sm:inline truncate">
                  Metas de Ligação
                </span>
                <span className="sm:hidden truncate">Ligação</span>
              </TabsTrigger>
              <TabsTrigger
                value="metas-cadastros"
                className="group flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-md p-1.5 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 group-data-[state=active]:bg-emerald-200 dark:group-data-[state=active]:bg-emerald-800/40 transition-colors">
                  <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="hidden sm:inline truncate">
                  Metas de Cadastros
                </span>
                <span className="sm:hidden truncate">Cadastros</span>
              </TabsTrigger>
              <TabsTrigger
                value="metas-marcadores"
                className="group flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-md p-1.5 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 group-data-[state=active]:bg-amber-200 dark:group-data-[state=active]:bg-amber-800/40 transition-colors">
                  <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="hidden sm:inline truncate">
                  Metas de Marcadores
                </span>
                <span className="sm:hidden truncate">Marcadores</span>
              </TabsTrigger>
              <TabsTrigger
                value="metas-interacoes"
                className="group flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-md p-1.5 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/40 group-data-[state=active]:bg-indigo-200 dark:group-data-[state=active]:bg-indigo-800/40 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="hidden sm:inline truncate">
                  Metas de Interações
                </span>
                <span className="sm:hidden truncate">Interações</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content: Metas de Vendas */}
            <TabsContent
              value="admin-metas"
              className="w-full overflow-hidden mt-6"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2.5">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                        Metas de Vendas por Usuário
                      </CardTitle>
                      <CardDescription className="text-sm text-blue-600/70 dark:text-blue-400 mt-1">
                        Lista de todos os usuários e suas respectivas metas de
                        vendas
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center gap-3 text-gray-500 dark-text-slate-400">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                        <span className="font-medium">Carregando metas...</span>
                      </div>
                    </div>
                  ) : userGoals.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Target className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhuma meta cadastrada
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Comece definindo metas para os usuários do sistema
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Usuário
                              </TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Período
                              </TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Meta de Vendas
                              </TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Valor Alcançado
                              </TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Ticket Médio
                              </TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Itens por Venda
                              </TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                                Ações
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userGoals.map((goal) => {
                              const totalSalesAchieved = getTotalAchieved(
                                goal.weeklyResults || [],
                                "salesAchieved"
                              );
                              const progressPercentage =
                                Number(goal.salesGoal) > 0
                                  ? Math.min(
                                      (totalSalesAchieved /
                                        Number(goal.salesGoal)) *
                                        100,
                                      100
                                    )
                                  : 0;

                              return (
                                <TableRow
                                  key={goal.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 transition-colors"
                                >
                                  <TableCell className="font-medium text-gray-900 dark:text-white py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full w-8 h-8 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                          {goal.userName &&
                                            goal.userName
                                              .trim()
                                              .charAt(0)
                                              .toUpperCase()}
                                        </span>
                                      </div>
                                      <span>{goal.userName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-gray-700 dark:text-gray-300 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-1">
                                        <span className="text-xs font-medium">
                                          {new Date(0, goal.month - 1)
                                            .toLocaleDateString("pt-BR", {
                                              month: "short",
                                            })
                                            .replace(".", "")}{" "}
                                          {goal.year}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-md px-2 py-1">
                                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                          {formatCurrency(goal.salesGoal)}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`rounded-md px-2 py-1 ${
                                            progressPercentage >= 100
                                              ? "bg-green-100 dark:bg-green-900/30"
                                              : progressPercentage >= 75
                                              ? "bg-blue-100 dark:bg-blue-900/30"
                                              : progressPercentage >= 50
                                              ? "bg-orange-100 dark:bg-orange-900/30"
                                              : "bg-red-100 dark:bg-red-900/30"
                                          }`}
                                        >
                                          <span
                                            className={`text-sm font-semibold ${
                                              progressPercentage >= 100
                                                ? "text-green-700 dark:text-green-400"
                                                : progressPercentage >= 75
                                                ? "text-blue-700 dark:text-blue-400"
                                                : progressPercentage >= 50
                                                ? "text-orange-700 dark:text-orange-400"
                                                : "text-red-700 dark:text-red-400"
                                            }`}
                                          >
                                            {formatCurrency(
                                              totalSalesAchieved.toString()
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            progressPercentage >= 100
                                              ? "bg-green-500"
                                              : progressPercentage >= 75
                                              ? "bg-blue-500"
                                              : progressPercentage >= 50
                                              ? "bg-orange-500"
                                              : "bg-red-500"
                                          }`}
                                          style={{
                                            width: `${Math.min(
                                              progressPercentage,
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {progressPercentage.toFixed(1)}% da meta
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-md px-2 py-1 inline-block">
                                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                        {formatCurrency(goal.averageTicket)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-md px-2 py-1 inline-block">
                                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                                        {goal.itemsPerSale} itens
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEditGoal(goal)}
                                        className="h-8 px-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 dark:hover:border-blue-700 transition-colors"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                        <span className="sr-only">Editar</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleOpenResultModal(goal)
                                        }
                                        className="h-8 px-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 dark:hover:border-emerald-700 transition-colors"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span className="sr-only">
                                          Adicionar resultado
                                        </span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteGoal(goal)}
                                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 transition-colors"
                                        disabled={deleteMutation.isPending}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="sr-only">Excluir</span>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Content: Metas de Telemarketing */}
            <TabsContent
              value="metas-telemarketing"
              className="w-full overflow-hidden mt-6"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-900/10">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-b border-purple-100 dark:border-purple-800/30">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2.5">
                        <Phone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                          Metas de Ligação por Usuário
                        </CardTitle>
                        <CardDescription className="text-sm text-purple-600/70 dark:text-purple-400/70 mt-1">
                          Gestão de metas baseadas em resultados de ligação
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setValueTelemarketing(
                          "month",
                          selectedMonth.toString()
                        );
                        setValueTelemarketing("year", selectedYear.toString());
                        setIsTelemarketingModalOpen(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 w-full lg:w-auto"
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Nova Meta de Ligação
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {telemarketingGoals.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Phone className="h-8 w-8 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhuma meta de ligação cadastrada
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Comece definindo metas de ligação para os usuários
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-purple-200 dark:border-purple-700/50 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                              <TableHead className="font-semibold text-purple-700 dark:text-purple-300">
                                Usuário
                              </TableHead>
                              <TableHead className="font-semibold text-purple-700 dark:text-purple-300">
                                Período
                              </TableHead>
                              <TableHead className="font-semibold text-purple-700 dark:text-purple-300">
                                Resultado Esperado
                              </TableHead>
                              <TableHead className="font-semibold text-purple-700 dark:text-purple-300">
                                Meta de Quantidade
                              </TableHead>
                              <TableHead className="font-semibold text-purple-700 dark:text-purple-300">
                                Ações
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {telemarketingGoals.map((goal) => (
                              <TableRow
                                key={goal.id}
                                className="hover:bg-purple-50/50 dark:hover:bg-purple-900/10 border-b border-purple-100/50 dark:border-purple-700/30 transition-colors"
                              >
                                <TableCell className="font-medium text-gray-900 dark:text-white py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full w-10 h-10 flex items-center justify-center">
                                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                        {goal.userName &&
                                          goal.userName
                                            .trim()
                                            .charAt(0)
                                            .toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">
                                        {goal.userName}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {goal.userEmail}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-2 inline-block">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {new Date(0, goal.month - 1)
                                        .toLocaleDateString("pt-BR", {
                                          month: "short",
                                        })
                                        .replace(".", "")}{" "}
                                      {goal.year}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg px-3 py-2 inline-block">
                                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                      {goal.targetResult}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg px-3 py-2 inline-block">
                                    <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                                      {goal.targetQuantity} chamadas
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="flex gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleEditTelemarketingGoal(goal)
                                      }
                                      className="h-8 px-2 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 dark:hover:border-purple-700 transition-colors"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                      <span className="sr-only">Editar</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDeleteTelemarketingGoal(goal)
                                      }
                                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 transition-colors"
                                      disabled={
                                        deleteTelemarketingMutation.isPending
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span className="sr-only">Excluir</span>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab de Metas de Cadastros */}
            <TabsContent
              value="metas-cadastros"
              className="w-full overflow-hidden mt-6"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-emerald-50/30 dark:from-gray-900 dark:to-emerald-900/10">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-emerald-100 dark:border-emerald-800/30">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-2.5">
                        <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                          Metas de Cadastros de Clientes
                        </CardTitle>
                        <CardDescription className="text-sm text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                          Gestão de metas para cadastros de novos clientes
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setValueClientRegistration(
                          "month",
                          selectedMonth.toString()
                        );
                        setValueClientRegistration(
                          "year",
                          selectedYear.toString()
                        );
                        setIsClientRegistrationModalOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 w-full lg:w-auto"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Nova Meta
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {clientRegistrationGoalsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center gap-3 text-gray-500">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent"></div>
                        <span className="font-medium">
                          Carregando metas de cadastros...
                        </span>
                      </div>
                    </div>
                  ) : clientRegistrationGoals.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Users className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhuma meta de cadastros definida
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Defina metas de cadastros para este período
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/50 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                              <TableHead className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Usuário
                              </TableHead>
                              <TableHead className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Meta
                              </TableHead>
                              <TableHead className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Alcançado
                              </TableHead>
                              <TableHead className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Progresso
                              </TableHead>
                              <TableHead className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Porcentagem
                              </TableHead>
                              <TableHead className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Ações
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientRegistrationGoals.map((goal) => {
                              // Buscar estatísticas do usuário
                              const userStats = clientRegistrationStats.find(
                                (stat) => stat.userId === goal.userId
                              );
                              const achieved = userStats
                                ? userStats.totalRegistrations
                                : 0;
                              const percentage =
                                goal.targetQuantity > 0
                                  ? (achieved / goal.targetQuantity) * 100
                                  : 0;

                              return (
                                <TableRow
                                  key={goal.id}
                                  className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 border-b border-emerald-100/50 dark:border-emerald-700/30 transition-colors"
                                >
                                  <TableCell className="font-medium text-gray-900 dark:text-white py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-full w-10 h-10 flex items-center justify-center">
                                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                          {goal.userName &&
                                            goal.userName
                                              .trim()
                                              .charAt(0)
                                              .toUpperCase()}
                                        </span>
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                          {goal.userName}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {goal.userEmail}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg px-3 py-2 inline-block">
                                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                        {goal.targetQuantity} clientes
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div
                                      className={`rounded-lg px-3 py-2 inline-block ${
                                        percentage >= 100
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : percentage >= 50
                                          ? "bg-yellow-100 dark:bg-yellow-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                      }`}
                                    >
                                      <span
                                        className={`text-sm font-semibold ${
                                          percentage >= 100
                                            ? "text-green-700 dark:text-green-300"
                                            : percentage >= 50
                                            ? "text-yellow-700 dark:text-yellow-300"
                                            : "text-red-700 dark:text-red-300"
                                        }`}
                                      >
                                        {achieved} clientes
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex flex-col gap-2">
                                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            percentage >= 100
                                              ? "bg-green-500"
                                              : percentage >= 75
                                              ? "bg-emerald-500"
                                              : percentage >= 50
                                              ? "bg-yellow-500"
                                              : "bg-red-500"
                                          }`}
                                          style={{
                                            width: `${Math.min(
                                              percentage,
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        percentage >= 100
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                          : percentage >= 75
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                          : percentage >= 50
                                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                      }`}
                                    >
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleEditClientRegistrationGoal(goal)
                                        }
                                        className="h-8 px-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 dark:hover:border-emerald-700 transition-colors"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                        <span className="sr-only">Editar</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteClientRegistrationGoal(
                                            goal
                                          )
                                        }
                                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 transition-colors"
                                        disabled={
                                          deleteClientRegistrationMutation.isPending
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="sr-only">Excluir</span>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab de Metas de Marcadores */}
            <TabsContent
              value="metas-marcadores"
              className="w-full overflow-hidden mt-6"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-amber-50/30 dark:from-gray-900 dark:to-amber-900/10">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-100 dark:border-amber-800/30">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2.5">
                        <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                          Metas de Marcadores
                        </CardTitle>
                        <CardDescription className="text-sm text-amber-600/70 dark:text-amber-400/70 mt-1">
                          Gestão de metas para marcadores de clientes
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setValueMarker("month", selectedMonth.toString());
                        setValueMarker("year", selectedYear.toString());
                        setIsMarkerGoalModalOpen(true);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg transition-all duration-200 w-full lg:w-auto"
                      data-testid="button-new-marker-goal"
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Nova Meta de Marcadores
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {markerGoals.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Package className="h-8 w-8 text-amber-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhuma meta de marcadores cadastrada
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Comece definindo metas de marcadores para os usuários
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Usuário
                              </TableHead>
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Marcador
                              </TableHead>
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Meta
                              </TableHead>
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Período
                              </TableHead>
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Atual
                              </TableHead>
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Progresso
                              </TableHead>
                              <TableHead className="font-semibold text-amber-700 dark:text-amber-300">
                                Ações
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {markerGoals.map((goal) => {
                              const stats = markerStats.find(
                                (s) =>
                                  s.userId === goal.userId &&
                                  s.markerName === goal.markerName
                              );
                              const currentCount = stats?.totalClients || 0;
                              const progressPercentage =
                                goal.targetQuantity > 0
                                  ? Math.min(
                                      (currentCount / goal.targetQuantity) *
                                        100,
                                      100
                                    )
                                  : 0;

                              return (
                                <TableRow
                                  key={goal.id}
                                  className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 border-b border-amber-100/50 dark:border-amber-700/30 transition-colors"
                                >
                                  <TableCell
                                    className="font-medium text-gray-900 dark:text-white py-4"
                                    data-testid={`text-user-${goal.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full w-10 h-10 flex items-center justify-center">
                                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                          {goal.userName &&
                                            goal.userName
                                              .trim()
                                              .charAt(0)
                                              .toUpperCase()}
                                        </span>
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                          {goal.userName}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {goal.userEmail}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className="py-4"
                                    data-testid={`text-marker-${goal.id}`}
                                  >
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                      <Package className="w-3 h-3 mr-1.5" />
                                      {goal.markerName}
                                    </span>
                                  </TableCell>
                                  <TableCell
                                    className="py-4"
                                    data-testid={`text-target-${goal.id}`}
                                  >
                                    <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg px-3 py-2 inline-block">
                                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                        {goal.targetQuantity}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className="py-4"
                                    data-testid={`text-period-${goal.id}`}
                                  >
                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                      {new Date(
                                        0,
                                        goal.month - 1
                                      ).toLocaleDateString("pt-BR", {
                                        month: "long",
                                      })}
                                      /{goal.year}
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className="py-4"
                                    data-testid={`text-current-${goal.id}`}
                                  >
                                    <div
                                      className={`rounded-lg px-3 py-2 inline-block ${
                                        progressPercentage >= 100
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : progressPercentage >= 50
                                          ? "bg-yellow-100 dark:bg-yellow-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                      }`}
                                    >
                                      <span
                                        className={`text-sm font-semibold ${
                                          progressPercentage >= 100
                                            ? "text-green-700 dark:text-green-300"
                                            : progressPercentage >= 50
                                            ? "text-yellow-700 dark:text-yellow-300"
                                            : "text-red-700 dark:text-red-300"
                                        }`}
                                      >
                                        {currentCount}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className="py-4"
                                    data-testid={`text-progress-${goal.id}`}
                                  >
                                    <div className="flex flex-col gap-2">
                                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            progressPercentage >= 100
                                              ? "bg-green-500"
                                              : progressPercentage >= 75
                                              ? "bg-amber-500"
                                              : progressPercentage >= 50
                                              ? "bg-yellow-500"
                                              : "bg-red-500"
                                          }`}
                                          style={{
                                            width: `${Math.min(
                                              progressPercentage,
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          progressPercentage >= 100
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                            : progressPercentage >= 75
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                            : progressPercentage >= 50
                                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                        }`}
                                      >
                                        {progressPercentage.toFixed(0)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex gap-1.5">
                                      <Button
                                        onClick={() =>
                                          handleEditMarkerGoal(goal)
                                        }
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 dark:hover:border-amber-700 transition-colors"
                                        data-testid={`button-edit-marker-${goal.id}`}
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                        <span className="sr-only">Editar</span>
                                      </Button>
                                      <Button
                                        onClick={() =>
                                          handleDeleteMarkerGoal(goal)
                                        }
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 transition-colors"
                                        data-testid={`button-delete-marker-${goal.id}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="sr-only">Excluir</span>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Content: Metas de Interações */}
            <TabsContent
              value="metas-interacoes"
              className="w-full overflow-hidden mt-6"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30 dark:from-gray-900 dark:to-indigo-900/10">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b border-indigo-100 dark:border-indigo-800/30">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-2.5">
                        <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                          Metas de Interações por Usuário
                        </CardTitle>
                        <CardDescription className="text-sm text-indigo-600/70 dark:text-indigo-400/70 mt-1">
                          Gestão de metas baseadas em tipos de interação com
                          clientes
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setValueInteraction("month", selectedMonth.toString());
                        setValueInteraction("year", selectedYear.toString());
                        setIsInteractionGoalModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 w-full lg:w-auto"
                      data-testid="button-new-interaction-goal"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Nova Meta de Interação
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {interactionGoals.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <MessageSquare className="h-8 w-8 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nenhuma meta de interação cadastrada
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Comece definindo metas de interação para os usuários
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Usuário
                              </TableHead>
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Tipo de Interação
                              </TableHead>
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Meta
                              </TableHead>
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Período
                              </TableHead>
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Realizadas
                              </TableHead>
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Progresso
                              </TableHead>
                              <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Ações
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {interactionGoals.map((goal) => {
                              // Buscar estatísticas do usuário para este tipo de interação
                              const stats = interactionStats.find(
                                (stat) =>
                                  stat.userId === goal.userId &&
                                  stat.interactionType === goal.interactionType
                              );
                              const totalInteractions =
                                stats?.totalInteractions || 0;
                              const progressPercentage =
                                goal.targetQuantity > 0
                                  ? Math.min(
                                      (totalInteractions /
                                        goal.targetQuantity) *
                                        100,
                                      100
                                    )
                                  : 0;

                              // Função para traduzir tipos de interação
                              const getInteractionTypeLabel = (
                                type: string
                              ) => {
                                const types: Record<string, string> = {
                                  telemarketing: "Ligação",
                                  email: "E-mail",
                                  meeting: "Reunião",
                                  whatsapp: "WhatsApp",
                                  visit: "Visita",
                                  note: "Anotação",
                                  other: "Outro",
                                };
                                return types[type] || type;
                              };

                              return (
                                <TableRow
                                  key={goal.id}
                                  className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 border-b border-indigo-100/50 dark:border-indigo-700/30 transition-colors"
                                >
                                  <TableCell className="font-medium text-gray-900 dark:text-white py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full w-10 h-10 flex items-center justify-center">
                                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                          {goal.userName &&
                                            goal.userName
                                              .trim()
                                              .charAt(0)
                                              .toUpperCase()}
                                        </span>
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                          {goal.userName}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {goal.userEmail}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                      <MessageSquare className="w-3 h-3 mr-1.5" />
                                      {getInteractionTypeLabel(
                                        goal.interactionType
                                      )}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg px-3 py-2 inline-block">
                                      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                                        {goal.targetQuantity}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                      {new Date(
                                        0,
                                        goal.month - 1
                                      ).toLocaleDateString("pt-BR", {
                                        month: "long",
                                      })}{" "}
                                      {goal.year}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div
                                      className={`rounded-lg px-3 py-2 inline-block ${
                                        progressPercentage >= 100
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : progressPercentage >= 50
                                          ? "bg-yellow-100 dark:bg-yellow-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                      }`}
                                    >
                                      <span
                                        className={`text-sm font-semibold ${
                                          progressPercentage >= 100
                                            ? "text-green-700 dark:text-green-300"
                                            : progressPercentage >= 50
                                            ? "text-yellow-700 dark:text-yellow-300"
                                            : "text-red-700 dark:text-red-300"
                                        }`}
                                      >
                                        {totalInteractions}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex flex-col gap-2">
                                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            progressPercentage >= 100
                                              ? "bg-green-500"
                                              : progressPercentage >= 75
                                              ? "bg-indigo-500"
                                              : progressPercentage >= 50
                                              ? "bg-yellow-500"
                                              : "bg-red-500"
                                          }`}
                                          style={{
                                            width: `${Math.min(
                                              progressPercentage,
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          progressPercentage >= 100
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                            : progressPercentage >= 75
                                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                                            : progressPercentage >= 50
                                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                        }`}
                                      >
                                        {progressPercentage.toFixed(1)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleEditInteractionGoal(goal)
                                        }
                                        className="h-8 px-2 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 dark:hover:border-indigo-700 transition-colors"
                                        data-testid={`button-edit-interaction-${goal.id}`}
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                        <span className="sr-only">Editar</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteInteractionGoal(goal)
                                        }
                                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 transition-colors"
                                        disabled={
                                          deleteInteractionGoalMutation.isPending
                                        }
                                        data-testid={`button-delete-interaction-${goal.id}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="sr-only">Excluir</span>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
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
                    (_, i) => currentDate.getFullYear() - 2 + i
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
                    (_, i) => currentDate.getFullYear() - 2 + i
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
              onSubmitClientRegistration
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
                    (_, i) => currentDate.getFullYear() - 2 + i
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

      {/* Modal de metas de marcadores */}
      <Dialog
        open={isMarkerGoalModalOpen}
        onOpenChange={handleCloseMarkerGoalModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMarkerGoal
                ? "Editar Meta de Marcadores"
                : "Nova Meta de Marcadores"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmitMarker(onSubmitMarkerGoal)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="markerUserId">Usuário</Label>
              <select
                id="markerUserId"
                {...registerMarker("userId")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={!!editingMarkerGoal}
                data-testid="select-marker-user"
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {markerErrors.userId && (
                <p className="text-sm text-red-600">
                  {markerErrors.userId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="markerName">Nome do Marcador</Label>
              <Controller
                name="markerName"
                control={formMarkerControl}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    data-testid="select-marker-name"
                    disabled={availableMarkers.length === 0}
                  >
                    <SelectTrigger id="markerName">
                      <SelectValue
                        placeholder={
                          availableMarkers.length === 0
                            ? "Carregando marcadores..."
                            : "Selecione um marcador"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMarkers.map((marker) => (
                        <SelectItem key={marker.id} value={marker.name}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: marker.color }}
                            />
                            {marker.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {markerErrors.markerName && (
                <p className="text-sm text-red-600">
                  {markerErrors.markerName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="markerTargetQuantity">Quantidade Meta</Label>
              <Input
                id="markerTargetQuantity"
                type="number"
                min="1"
                placeholder="10"
                {...registerMarker("targetQuantity")}
                data-testid="input-marker-quantity"
              />
              {markerErrors.targetQuantity && (
                <p className="text-sm text-red-600">
                  {markerErrors.targetQuantity.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="markerMonth">Mês</Label>
                <select
                  id="markerMonth"
                  {...registerMarker("month")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  disabled={!!editingMarkerGoal}
                  data-testid="select-marker-month"
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
                {markerErrors.month && (
                  <p className="text-sm text-red-600">
                    {markerErrors.month.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="markerYear">Ano</Label>
                <select
                  id="markerYear"
                  {...registerMarker("year")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  disabled={!!editingMarkerGoal}
                  data-testid="select-marker-year"
                >
                  <option value="">Selecione o ano</option>
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {markerErrors.year && (
                  <p className="text-sm text-red-600">
                    {markerErrors.year.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseMarkerGoalModal}
                data-testid="button-cancel-marker"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={markerGoalMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-submit-marker"
              >
                {markerGoalMutation.isPending
                  ? "Salvando..."
                  : editingMarkerGoal
                  ? "Atualizar Meta"
                  : "Criar Meta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de metas de interações */}
      <Dialog
        open={isInteractionGoalModalOpen}
        onOpenChange={handleCloseInteractionGoalModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingInteractionGoal
                ? "Editar Meta de Interações"
                : "Nova Meta de Interações"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmitInteraction(onSubmitInteractionGoal)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="interactionUserId">Usuário</Label>
              <select
                id="interactionUserId"
                {...registerInteraction("userId")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={!!editingInteractionGoal}
                data-testid="select-interaction-user"
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {interactionErrors.userId && (
                <p className="text-sm text-red-600">
                  {interactionErrors.userId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="interactionType">Tipo de Interação</Label>
              <select
                id="interactionType"
                {...registerInteraction("interactionType")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                data-testid="select-interaction-type"
              >
                <option value="">Selecione o tipo de interação</option>
                <option value="telemarketing">Ligação</option>
                <option value="email">E-mail</option>
                <option value="meeting">Reunião</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="visit">Visita</option>
                <option value="note">Anotação</option>
                <option value="other">Outro</option>
              </select>
              {interactionErrors.interactionType && (
                <p className="text-sm text-red-600">
                  {interactionErrors.interactionType.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="interactionTargetQuantity">Quantidade Meta</Label>
              <Input
                id="interactionTargetQuantity"
                type="number"
                min="1"
                placeholder="50"
                {...registerInteraction("targetQuantity")}
                data-testid="input-interaction-quantity"
              />
              {interactionErrors.targetQuantity && (
                <p className="text-sm text-red-600">
                  {interactionErrors.targetQuantity.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interactionMonth">Mês</Label>
                <select
                  id="interactionMonth"
                  {...registerInteraction("month")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={!!editingInteractionGoal}
                  data-testid="select-interaction-month"
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
                {interactionErrors.month && (
                  <p className="text-sm text-red-600">
                    {interactionErrors.month.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interactionYear">Ano</Label>
                <select
                  id="interactionYear"
                  {...registerInteraction("year")}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={!!editingInteractionGoal}
                  data-testid="select-interaction-year"
                >
                  <option value="">Selecione o ano</option>
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {interactionErrors.year && (
                  <p className="text-sm text-red-600">
                    {interactionErrors.year.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseInteractionGoalModal}
                data-testid="button-cancel-interaction"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={interactionGoalMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-submit-interaction"
              >
                {interactionGoalMutation.isPending
                  ? "Salvando..."
                  : editingInteractionGoal
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
