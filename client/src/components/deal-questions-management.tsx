import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  HelpCircle,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  Shuffle,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Schemas de validação - alinhado com o schema do backend
const questionSchema = z
  .object({
    question: z.string().min(5, "Pergunta deve ter pelo menos 5 caracteres"),
    questionType: z.enum([
      "boolean",
      "number",
      "text",
      "select",
      "multiselect",
    ]),
    isRequired: z.boolean().default(false),
    helpText: z.string().optional(),
    placeholder: z.string().optional(),
    options: z.string().optional(),
  })
  .refine(
    (data) => {
      // Se for select/multiselect, deve ter opções
      if (
        data.questionType === "select" ||
        data.questionType === "multiselect"
      ) {
        return data.options && data.options.trim().length > 0;
      }
      return true;
    },
    {
      message: "Perguntas do tipo seleção devem ter pelo menos uma opção",
      path: ["options"],
    }
  );

type QuestionFormData = z.infer<typeof questionSchema>;

interface DealQuestion {
  id: string;
  question: string;
  questionType: "boolean" | "number" | "text" | "select" | "multiselect";
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  helpText?: string;
  placeholder?: string;
  createdAt: string;
  updatedAt: string;
}

interface QuestionStats {
  totalQuestions: number;
  activeQuestions: number;
  usageStats: Array<{
    questionId: string;
    question: string;
    answeredCount: number;
    totalDeals: number;
    completionRate: number;
  }>;
}

// Cache Keys - mais específicos para invalidação seletiva
const QUERY_KEYS = {
  questions: {
    all: ["deal-questions"] as const,
    lists: () => [...QUERY_KEYS.questions.all, "list"] as const,
    list: (filters?: { isActive?: boolean }) =>
      [...QUERY_KEYS.questions.lists(), { filters }] as const,
    details: () => [...QUERY_KEYS.questions.all, "detail"] as const,
    detail: (id: string) => [...QUERY_KEYS.questions.details(), id] as const,
  },
  stats: {
    all: ["deal-questions-stats"] as const,
    summary: () => [...QUERY_KEYS.stats.all, "summary"] as const,
    usage: () => [...QUERY_KEYS.stats.all, "usage"] as const,
  },
  categories: ["deal-questions-categories"] as const,
};

// API Functions
const fetchQuestions = async (): Promise<DealQuestion[]> => {
  const response = await fetch("/api/deal-questions");
  if (!response.ok) {
    throw new Error("Erro ao carregar perguntas");
  }
  return response.json();
};

const fetchQuestionStats = async (): Promise<QuestionStats> => {
  const response = await fetch("/api/deal-questions/stats");
  if (!response.ok) {
    throw new Error("Erro ao carregar estatísticas");
  }
  return response.json();
};

const createQuestion = async (
  question: QuestionFormData
): Promise<DealQuestion> => {
  const payload = {
    ...question,
    options: question.options
      ? question.options
          .split(",")
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
      : [],
  };

  const response = await fetch("/api/deal-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "current-user-id", // TODO: Pegar do contexto de auth
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    if (errorData.errors && Array.isArray(errorData.errors)) {
      throw new Error(
        errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ")
      );
    }
    throw new Error(errorData.message || "Erro ao criar pergunta");
  }

  return response.json();
};

const updateQuestion = async ({
  id,
  ...question
}: QuestionFormData & { id: string }): Promise<DealQuestion> => {
  const payload = {
    ...question,
    options: question.options
      ? question.options
          .split(",")
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
      : [],
  };

  const response = await fetch(`/api/deal-questions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    if (errorData.errors && Array.isArray(errorData.errors)) {
      throw new Error(
        errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ")
      );
    }
    throw new Error(errorData.message || "Erro ao atualizar pergunta");
  }

  return response.json();
};

const deleteQuestion = async (id: string): Promise<void> => {
  const response = await fetch(`/api/deal-questions/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao deletar pergunta");
  }
};

const toggleQuestionStatus = async ({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}): Promise<DealQuestion> => {
  const response = await fetch(`/api/deal-questions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao alterar status da pergunta");
  }

  return response.json();
};

const seedDefaultQuestions = async (): Promise<void> => {
  const response = await fetch("/api/deal-questions/seed", {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao popular perguntas padrão");
  }
};

// Componente principal
export function DealQuestionsManagement() {
  const [selectedQuestion, setSelectedQuestion] = useState<DealQuestion | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Debounced filters for better performance
  const [debouncedFilters, setDebouncedFilters] = useState<{
    isActive?: boolean;
  }>({
    isActive: !showInactive ? true : undefined,
  });

  // Debounce filter changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters({
        isActive: !showInactive ? true : undefined,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [showInactive]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries com cache mais específico
  const {
    data: questions = [],
    isLoading: questionsLoading,
    error: questionsError,
    refetch: refetchQuestions,
  } = useQuery({
    queryKey: QUERY_KEYS.questions.list(debouncedFilters),
    queryFn: fetchQuestions,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: QUERY_KEYS.stats.summary(),
    queryFn: fetchQuestionStats,
    staleTime: 2 * 60 * 1000, // 2 minutos
    enabled: !!questions.length, // Só buscar stats se houver perguntas
    retry: 1,
  });

  // Mutations com cache invalidation mais específico e optimistic updates
  const createMutation = useMutation({
    mutationFn: createQuestion,
    onMutate: async (newQuestion) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.questions.lists(),
      });

      // Optimistic update
      const previousQuestions = queryClient.getQueryData(
        QUERY_KEYS.questions.list({
          isActive: !showInactive ? true : undefined,
        })
      );

      if (previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          (old: DealQuestion[]) => [
            ...old,
            {
              ...newQuestion,
              id: "temp-" + Date.now(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]
        );
      }

      return { previousQuestions };
    },
    onSuccess: () => {
      // Invalidar caches relevantes de forma seletiva
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions.lists() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats.all });
      toast({
        title: "Sucesso",
        description: "Pergunta criada com sucesso",
      });
      setIsDialogOpen(false);
      setSelectedQuestion(null);
    },
    onError: (error: Error, newQuestion, context) => {
      // Rollback optimistic update
      if (context?.previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          context.previousQuestions
        );
      }
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateQuestion,
    onMutate: async ({ id, ...updatedData }) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.questions.lists(),
      });

      const previousQuestions = queryClient.getQueryData(
        QUERY_KEYS.questions.list({
          isActive: !showInactive ? true : undefined,
        })
      );

      // Optimistic update
      if (previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          (old: DealQuestion[]) =>
            old.map((q) =>
              q.id === id
                ? { ...q, ...updatedData, updatedAt: new Date().toISOString() }
                : q
            )
        );
      }

      return { previousQuestions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions.lists() });
      // Só invalidar stats se mudou status ou categoria
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats.all });
      toast({
        title: "Sucesso",
        description: "Pergunta atualizada com sucesso",
      });
      setIsDialogOpen(false);
      setSelectedQuestion(null);
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          context.previousQuestions
        );
      }
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuestion,
    onMutate: async (questionId) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.questions.lists(),
      });

      const previousQuestions = queryClient.getQueryData(
        QUERY_KEYS.questions.list({
          isActive: !showInactive ? true : undefined,
        })
      );

      // Optimistic delete
      if (previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          (old: DealQuestion[]) => old.filter((q) => q.id !== questionId)
        );
      }

      return { previousQuestions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions.lists() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats.all });
      toast({
        title: "Sucesso",
        description: "Pergunta deletada com sucesso",
      });
    },
    onError: (error: Error, questionId, context) => {
      if (context?.previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          context.previousQuestions
        );
      }
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: toggleQuestionStatus,
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.questions.lists(),
      });

      const previousQuestions = queryClient.getQueryData(
        QUERY_KEYS.questions.list({
          isActive: !showInactive ? true : undefined,
        })
      );

      // Optimistic update
      if (previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          (old: DealQuestion[]) =>
            old.map((q) =>
              q.id === id
                ? { ...q, isActive, updatedAt: new Date().toISOString() }
                : q
            )
        );
      }

      return { previousQuestions };
    },
    onSuccess: () => {
      // Invalidar múltiplas variações de cache pois status pode afetar filtros
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions.lists() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats.all });
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousQuestions) {
        queryClient.setQueryData(
          QUERY_KEYS.questions.list({
            isActive: !showInactive ? true : undefined,
          }),
          context.previousQuestions
        );
      }
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const seedMutation = useMutation({
    mutationFn: seedDefaultQuestions,
    onSuccess: () => {
      // Seed é uma operação grande, invalidar tudo
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions.all });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats.all });
      toast({
        title: "Sucesso",
        description: "Perguntas padrão adicionadas com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Dados processados
  const filteredQuestions = React.useMemo(() => {
    return questions.filter((question) => {
      const statusMatch = showInactive || question.isActive;
      return statusMatch;
    });
  }, [questions, showInactive]);

  // Handlers
  const handleCreateQuestion = () => {
    setSelectedQuestion(null);
    setIsDialogOpen(true);
  };

  const handleEditQuestion = (question: DealQuestion) => {
    setSelectedQuestion(question);
    setIsDialogOpen(true);
  };

  const handleDeleteQuestion = async (question: DealQuestion) => {
    if (
      window.confirm(
        `Tem certeza que deseja deletar a pergunta "${question.question}"?`
      )
    ) {
      deleteMutation.mutate(question.id);
    }
  };

  const handleToggleStatus = (question: DealQuestion) => {
    toggleStatusMutation.mutate({
      id: question.id,
      isActive: !question.isActive,
    });
  };

  const getQuestionTypeLabel = (type: string) => {
    const types = {
      boolean: "Sim/Não",
      number: "Número",
      text: "Texto",
      select: "Seleção",
      multiselect: "Múltipla Escolha",
    };
    return types[type as keyof typeof types] || type;
  };

  const getQuestionTypeColor = (type: string) => {
    const colors = {
      boolean: "bg-green-100 text-green-800",
      number: "bg-blue-100 text-blue-800",
      text: "bg-gray-100 text-gray-800",
      select: "bg-purple-100 text-purple-800",
      multiselect: "bg-orange-100 text-orange-800",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (questionsError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200 mb-2">
              Erro ao carregar perguntas
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-4">
              {questionsError instanceof Error
                ? questionsError.message
                : "Erro desconhecido"}
            </p>
            <Button
              variant="outline"
              onClick={() => refetchQuestions()}
              disabled={questionsLoading}
            >
              {questionsLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header minimalista */}
      <div className="bg-white border dark:bg-slate-800 dark:border-slate-700 border-gray-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-200" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                Questionário dos Deals
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 max-w-2xl">
              Configure as perguntas que aparecem nos deals para coletar
              informações dos clientes
            </p>
          </div>
          <div className="flex flex-col xs:flex-row gap-3">
            {/* <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 h-9"
            >
              {seedMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Shuffle className="h-4 w-4 mr-2" />
              Popular Padrão
            </Button> */}
            <Button
              onClick={handleCreateQuestion}
              className="bg-purple-600 hover:bg-purple-700 text-white h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Pergunta
            </Button>
          </div>
        </div>
      </div>

      {/* Estatísticas minimalistas */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Total de Perguntas
                </p>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stats.totalQuestions}
                </p>
                <p className="text-xs text-gray-600">No questionário</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <HelpCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Perguntas Ativas
                </p>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stats.activeQuestions}
                </p>
                <p className="text-xs text-gray-600">Visíveis nos deals</p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Taxa de Resposta
                </p>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stats.usageStats.length > 0
                    ? Math.round(
                        stats.usageStats.reduce(
                          (acc, stat) => acc + stat.completionRate,
                          0
                        ) / stats.usageStats.length
                      )
                    : 0}
                  %
                </p>
                <p className="text-xs text-gray-600">Média geral</p>
              </div>
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions" className="dark:text-slate-300">Questionário</TabsTrigger>
          <TabsTrigger value="statistics" className="dark:text-slate-300">Estatísticas de Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          {/* Filtros minimalistas */}
          <div className="bg-white border dark:bg-slate-800 dark:border-slate-700 border-gray-200 mb-4  rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label
                  htmlFor="show-inactive"
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Mostrar perguntas inativas
                </Label>
              </div>

              <div className="text-xs text-gray-500 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900 bg-gray-50 px-3 py-2 rounded border">
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {filteredQuestions.length}
                </span>{" "}
                pergunta{filteredQuestions.length !== 1 ? "s" : ""} encontrada
                {filteredQuestions.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Lista de Perguntas */}
          <div className="bg-white dark:bg-slate-800 dark:border-slate-700 border border-gray-200 rounded-lg overflow-hidden">
            {questionsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-slate-400" />
                <span className="ml-3 text-gray-600 dark:text-slate-400">
                  Carregando perguntas...
                </span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="h-8 w-8 text-gray-400 dark:text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-400 mb-2">
                  Nenhuma pergunta encontrada
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  {questions.length === 0
                    ? "Comece criando sua primeira pergunta do questionário."
                    : "Nenhuma pergunta corresponde aos filtros selecionados."}
                </p>
                {questions.length === 0 && (
                  <Button onClick={handleCreateQuestion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Pergunta
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Tabela Desktop */}
                <div className="hidden lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                            Pergunta
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                            Tipo
                          </th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-400uppercase tracking-wide">
                            Obrigatória
                          </th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                            Status
                          </th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {filteredQuestions.map((question, index) => (
                          <tr
                            key={question.id}
                            className={`hover:bg-gray-50/50 dark:text-slate-800/50 transition-colors ${
                              index % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-gray-50/30 dark:bg-slate-800/30"
                            }`}
                          >
                            <td className="py-4 px-4">
                              <div className="max-w-md">
                                <p className="font-medium text-gray-900 dark:text-slate-200 mb-1">
                                  {question.question}
                                </p>
                                {question.helpText && (
                                  <p className="text-xs text-gray-600 mb-2">
                                    {question.helpText}
                                  </p>
                                )}
                                {(question.questionType === "select" ||
                                  question.questionType === "multiselect") &&
                                  question.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {question.options
                                        .slice(0, 3)
                                        .map((option, index) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700"
                                          >
                                            {option}
                                          </span>
                                        ))}
                                      {question.options.length > 3 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700">
                                          +{question.options.length - 3} mais
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getQuestionTypeColor(
                                  question.questionType
                                )}`}
                              >
                                {getQuestionTypeLabel(question.questionType)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {question.isRequired ? (
                                <div className="inline-flex items-center justify-center w-6 h-6 bg-green-50 rounded">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(question)}
                                disabled={toggleStatusMutation.isPending}
                                className="w-8 h-8 p-0 hover:bg-gray-100"
                              >
                                {toggleStatusMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                                ) : question.isActive ? (
                                  <Eye className="h-4 w-4 text-green-600" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-gray-400" />
                                )}
                              </Button>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditQuestion(question)}
                                  className="w-8 h-8 p-0 hover:bg-gray-100"
                                >
                                  <Edit2 className="h-4 w-4 text-gray-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteQuestion(question)}
                                  disabled={deleteMutation.isPending}
                                  className="w-8 h-8 p-0 hover:bg-red-50"
                                >
                                  {deleteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cards Mobile */}
                <div className="lg:hidden divide-y divide-gray-200">
                  {filteredQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="p-4 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getQuestionTypeColor(
                                  question.questionType
                                )}`}
                              >
                                {getQuestionTypeLabel(question.questionType)}
                              </span>
                            </div>
                            <h4 className="font-medium text-gray-900 text-sm mb-1">
                              {question.question}
                            </h4>
                            {question.helpText && (
                              <p className="text-xs text-gray-600 mb-2">
                                {question.helpText}
                              </p>
                            )}
                            {question.isRequired && (
                              <p className="text-xs text-red-600 font-medium">
                                Obrigatória
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(question)}
                              disabled={toggleStatusMutation.isPending}
                              className="w-8 h-8 p-0 hover:bg-gray-100"
                            >
                              {toggleStatusMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : question.isActive ? (
                                <Eye className="h-4 w-4 text-green-600" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditQuestion(question)}
                              className="w-8 h-8 p-0 hover:bg-gray-100"
                            >
                              <Edit2 className="h-4 w-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question)}
                              disabled={deleteMutation.isPending}
                              className="w-8 h-8 p-0 hover:bg-red-50"
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-600" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {(question.questionType === "select" ||
                          question.questionType === "multiselect") &&
                          question.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
                              {question.options
                                .slice(0, 4)
                                .map((option, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700"
                                  >
                                    {option}
                                  </span>
                                ))}
                              {question.options.length > 4 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700">
                                  +{question.options.length - 4} mais
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statistics">
          {stats && stats.usageStats.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas do Questionário</CardTitle>
                <CardDescription>
                  Taxa de resposta das perguntas nos deals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pergunta</TableHead>
                      <TableHead className="text-center">Respostas</TableHead>
                      <TableHead className="text-center">Total Deals</TableHead>
                      <TableHead className="text-center">
                        Taxa de Conclusão
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.usageStats
                      .sort((a, b) => b.completionRate - a.completionRate)
                      .map((stat) => (
                        <TableRow key={stat.questionId}>
                          <TableCell className="font-medium">
                            {stat.question}
                          </TableCell>
                          <TableCell className="text-center">
                            {stat.answeredCount}
                          </TableCell>
                          <TableCell className="text-center">
                            {stat.totalDeals}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${stat.completionRate}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">
                                {Math.round(stat.completionRate)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Sem estatísticas
                  </h3>
                  <p className="text-gray-600">
                    As estatísticas aparecerão quando houver respostas nos
                    deals.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para criar/editar pergunta */}
      <QuestionFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedQuestion(null);
        }}
        question={selectedQuestion}
        onSubmit={(data) => {
          if (selectedQuestion) {
            updateMutation.mutate({ ...data, id: selectedQuestion.id });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

// Componente do Dialog de Formulário
interface QuestionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  question: DealQuestion | null;
  onSubmit: (data: QuestionFormData) => void;
  isLoading: boolean;
}

function QuestionFormDialog({
  isOpen,
  onClose,
  question,
  onSubmit,
  isLoading,
}: QuestionFormDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      question: "",
      questionType: "text",
      isRequired: false,
      helpText: "",
      placeholder: "",
      options: "",
    },
  });

  const questionType = watch("questionType");
  const showOptionsField =
    questionType === "select" || questionType === "multiselect";

  React.useEffect(() => {
    if (question) {
      reset({
        question: question.question,
        questionType: question.questionType,
        isRequired: question.isRequired,
        helpText: question.helpText || "",
        placeholder: question.placeholder || "",
        options: question.options.join(", "),
      });
    } else {
      reset({
        question: "",
        questionType: "text",
        isRequired: false,
        helpText: "",
        placeholder: "",
        options: "",
      });
    }
  }, [question, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {question ? "Editar Pergunta" : "Nova Pergunta"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {question
                  ? "Edite as informações da pergunta"
                  : "Adicione uma nova pergunta ao questionário dos deals"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="question"
              className="text-xs font-medium text-gray-500 uppercase tracking-wide"
            >
              Pergunta *
            </Label>
            <Controller
              name="question"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="question"
                  placeholder="Digite a pergunta que será exibida nos deals"
                  rows={3}
                  className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                />
              )}
            />
            {errors.question && (
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {errors.question.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="questionType"
                className="text-xs font-medium text-gray-500 uppercase tracking-wide"
              >
                Tipo de Resposta *
              </Label>
              <Controller
                name="questionType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boolean">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          Sim/Não
                        </div>
                      </SelectItem>
                      <SelectItem value="number">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          Número
                        </div>
                      </SelectItem>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                          Texto
                        </div>
                      </SelectItem>
                      <SelectItem value="select">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          Seleção
                        </div>
                      </SelectItem>
                      <SelectItem value="multiselect">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          Múltipla Escolha
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.questionType && (
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errors.questionType.message}
                </p>
              )}
            </div>
          </div>

          {showOptionsField && (
            <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="options"
                  className="text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  Opções *
                </Label>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {questionType === "multiselect"
                    ? "Múltipla seleção"
                    : "Seleção única"}
                </span>
              </div>
              <Controller
                name="options"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="options"
                    placeholder="Digite as opções separadas por vírgula. Ex: Opção 1, Opção 2, Opção 3"
                    rows={4}
                    className="border-gray-300 focus:border-gray-500 focus:ring-gray-500 bg-white"
                  />
                )}
              />
              <p className="text-xs text-gray-600 flex items-start gap-2">
                <HelpCircle className="h-3 w-3 mt-0.5 text-gray-400" />
                Separe cada opção com vírgula. As opções serão exibidas como
                seleção única ou múltipla no formulário do deal.
              </p>
              {errors.options && (
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errors.options.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="isRequired"
              className="text-xs font-medium text-gray-500 uppercase tracking-wide"
            >
              Configurações
            </Label>
            <div className="flex items-center gap-3 h-10 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
              <Controller
                name="isRequired"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="isRequired"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label
                htmlFor="isRequired"
                className="text-sm text-gray-700 cursor-pointer flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4 text-green-600" />
                Resposta obrigatória
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="helpText"
                className="text-xs font-medium text-gray-500 uppercase tracking-wide"
              >
                Texto de Ajuda
              </Label>
              <Controller
                name="helpText"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="helpText"
                    placeholder="Texto opcional para ajudar o usuário a entender a pergunta"
                    rows={3}
                    className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                  />
                )}
              />
              <p className="text-xs text-gray-500">
                Aparece como dica abaixo da pergunta
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="placeholder"
                className="text-xs font-medium text-gray-500 uppercase tracking-wide"
              >
                Placeholder
              </Label>
              <Controller
                name="placeholder"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="placeholder"
                    placeholder="Ex: Digite aqui..."
                    className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                  />
                )}
              />
              <p className="text-xs text-gray-500">
                Apenas para campos de texto e número
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {question ? "Atualizar Pergunta" : "Criar Pergunta"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
