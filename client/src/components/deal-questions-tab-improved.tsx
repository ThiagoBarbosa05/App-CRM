import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Edit2,
  Plus,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Check,
  Hash,
  Type,
  List,
  CheckSquare,
} from "lucide-react";
import { DealQuestionsForm } from "./deal-questions-form-improved";
// import { toast } from "sonner"; // Comentado - usar console.log por enquanto

interface DealQuestion {
  id: string;
  question: string;
  questionType: "boolean" | "number" | "text" | "select" | "multiselect";
  options: string[];
  category: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  helpText?: string;
  placeholder?: string;
}

interface DealAnswer {
  id: string;
  dealId: string;
  questionId: string;
  answerBoolean?: boolean;
  answerNumber?: string;
  answerText?: string;
  createdAt: string;
  updatedAt: string;
  question: DealQuestion;
}

interface DealQuestionsTabProps {
  dealId: string;
}

// Cache keys para hierarquia de invalidação
const CACHE_KEYS = {
  questions: ["deal-questions"] as const,
  dealAnswers: (dealId: string) => ["deal-answers", dealId] as const,
  dealAnswersStats: (dealId: string) => ["deal-answers-stats", dealId] as const,
} as const;

// API functions
const fetchActiveQuestions = async (): Promise<DealQuestion[]> => {
  const response = await fetch("/api/deal-questions?isActive=true");
  if (!response.ok) {
    throw new Error(`Erro ao buscar perguntas: ${response.status}`);
  }
  return response.json();
};

const fetchDealAnswers = async (dealId: string): Promise<DealAnswer[]> => {
  const response = await fetch(`/api/deals/${dealId}/answers`);
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Erro ao buscar respostas: ${response.status}`);
  }
  return response.json();
};

export function DealQuestionsTab({ dealId }: DealQuestionsTabProps) {
  const [showQuestionsForm, setShowQuestionsForm] = useState(false);
  const queryClient = useQueryClient();

  // Queries com cache otimizado
  const {
    data: questions = [],
    isLoading: questionsLoading,
    error: questionsError,
    refetch: refetchQuestions,
  } = useQuery({
    queryKey: CACHE_KEYS.questions,
    queryFn: fetchActiveQuestions,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (antes era cacheTime)
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const {
    data: answers = [],
    isLoading: answersLoading,
    error: answersError,
    refetch: refetchAnswers,
  } = useQuery({
    queryKey: CACHE_KEYS.dealAnswers(dealId),
    queryFn: () => fetchDealAnswers(dealId),
    enabled: !!dealId,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Dados computados com useMemo para performance
  const stats = useMemo(() => {
    const totalQuestions = questions.length;
    const questionsAnswered = answers.length;
    const completionPercentage =
      totalQuestions > 0
        ? Math.round((questionsAnswered / totalQuestions) * 100)
        : 0;

    return {
      totalQuestions,
      questionsAnswered,
      completionPercentage,
      pendingQuestions: totalQuestions - questionsAnswered,
    };
  }, [questions.length, answers.length]);

  // Status info computado
  const statusInfo = useMemo(() => {
    const { completionPercentage } = stats;

    if (completionPercentage === 100) {
      return {
        icon: CheckCircle,
        color: "text-green-600 bg-green-100 dark:bg-green-700 dark:text-green-200",
        text: "Completo",
        description: "Todas as perguntas foram respondidas",
      };
    }
    if (completionPercentage >= 50) {
      return {
        icon: Clock,
        color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-700 dark:text-yellow-200",
        text: "Em andamento",
        description: "Algumas perguntas ainda precisam ser respondidas",
      };
    }
    return {
      icon: AlertCircle,
      color: "text-red-600 bg-red-100 dark:bg-red-700 dark:text-red-200",
      text: "Pendente",
      description: "A maioria das perguntas ainda não foi respondida",
    };
  }, [stats.completionPercentage]);

  // Mutation para otimistic updates
  const updateAnswersMutation = useMutation({
    mutationFn: async (answersData: any[]) => {
      const response = await fetch(`/api/deals/${dealId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersData }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao salvar respostas: ${response.status}`);
      }

      return response.json();
    },
    onMutate: async (newAnswers) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({
        queryKey: CACHE_KEYS.dealAnswers(dealId),
      });

      // Snapshot do estado anterior
      const previousAnswers = queryClient.getQueryData(
        CACHE_KEYS.dealAnswers(dealId)
      );

      // Optimistic update
      queryClient.setQueryData(
        CACHE_KEYS.dealAnswers(dealId),
        (oldData: DealAnswer[] = []) => {
          // Merge dos dados antigos com os novos
          const updatedAnswers = [...oldData];
          newAnswers.forEach((newAnswer: any) => {
            const index = updatedAnswers.findIndex(
              (a) => a.questionId === newAnswer.questionId
            );
            if (index >= 0) {
              updatedAnswers[index] = {
                ...updatedAnswers[index],
                ...newAnswer,
              };
            } else {
              updatedAnswers.push({
                ...newAnswer,
                id: `temp-${Date.now()}`,
                dealId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as DealAnswer);
            }
          });
          return updatedAnswers;
        }
      );

      return { previousAnswers };
    },
    onError: (err, newAnswers, context) => {
      // Rollback em caso de erro
      if (context?.previousAnswers) {
        queryClient.setQueryData(
          CACHE_KEYS.dealAnswers(dealId),
          context.previousAnswers
        );
      }
      console.error("Erro ao salvar respostas. Tente novamente.");
      console.error("Mutation error:", err);
    },
    onSuccess: (data) => {
      // Invalidar cache relacionado
      queryClient.invalidateQueries({
        queryKey: CACHE_KEYS.dealAnswers(dealId),
      });
      console.log("Respostas salvas com sucesso!");
    },
  });

  // Callbacks otimizados
  const handleQuestionsUpdated = useCallback(() => {
    setShowQuestionsForm(false);
    // Invalidar cache para refresh
    queryClient.invalidateQueries({
      queryKey: CACHE_KEYS.dealAnswers(dealId),
    });
  }, [dealId, queryClient]);

  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([refetchQuestions(), refetchAnswers()]);
      console.log("Dados atualizados!");
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      console.error("Erro ao atualizar dados");
    }
  }, [refetchQuestions, refetchAnswers]);

  const toggleQuestionsForm = useCallback(() => {
    setShowQuestionsForm((prev) => !prev);
  }, []);

  // Helper function para renderizar o valor da resposta com responsividade
  const renderAnswerValue = useCallback(
    (answer: DealAnswer, question: DealQuestion) => {
      // Verificar se question existe
      if (!question) {
        return (
          <span className="text-gray-500 dark:text-slate-400 italic text-sm lg:text-base">
            Sem resposta
          </span>
        );
      }

      if (typeof answer.answerBoolean === "boolean") {
        return (
          <div className="flex items-center gap-2">
            <Check
              className={`h-4 w-4 ${
                answer.answerBoolean ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
            />
            <span
              className={`text-sm lg:text-base font-medium ${
                answer.answerBoolean ? "text-green-700 dark:text-green-500" : "text-red-700 dark:text-red-500"
              }`}
            >
              {answer.answerBoolean ? "Sim" : "Não"}
            </span>
          </div>
        );
      }

      if (answer.answerNumber) {
        return (
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-700 dar:text-blue-500 font-medium text-sm lg:text-base">
              {answer.answerNumber}
            </span>
          </div>
        );
      }

      if (answer.answerText) {
        const isMultiSelect = question.questionType === "multiselect";
        const isSelect = question.questionType === "select";

        if (isMultiSelect) {
          const options = answer.answerText.split(",");
          return (
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
              <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {options.map((option, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs lg:text-sm"
                  >
                    {option.trim()}
                  </Badge>
                ))}
              </div>
            </div>
          );
        }

        if (isSelect) {
          return (
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <Badge
                variant="outline"
                className="text-indigo-700 text-sm lg:text-base text:indigo-500"
              >
                {answer.answerText}
              </Badge>
            </div>
          );
        }

        // Text answer
        return (
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <Type className="h-4 w-4 text-gray-600 dark:text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-gray-700 dark:text-slate-400 text-sm lg:text-base leading-relaxed break-words">
              {answer.answerText}
            </p>
          </div>
        );
      }

      return (
        <span className="text-gray-500 dark:text-slate-400 italic text-sm lg:text-base">
          Sem resposta
        </span>
      );
    },
    []
  );

  // Criar lista de perguntas com suas respostas (sem agrupamento)
  const questionsWithAnswers = useMemo(() => {
    const answersByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer])
    );

    return questions.map((question) => {
      const answer = answersByQuestionId.get(question.id);
      return {
        question,
        answer: answer || null,
        isAnswered: !!answer,
      };
    });
  }, [questions, answers]);

  // Loading state
  const isLoading = questionsLoading || answersLoading;

  // Error handling
  if (questionsError || answersError) {
    const error = questionsError || answersError;
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-400 mb-2">
                Erro ao carregar dados
              </h3>
              <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">
                {error instanceof Error ? error.message : "Erro desconhecido"}
              </p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-40 bg-gray-200 dark:text-slate-200 rounded-lg"></div>
        <div className="h-24 bg-gray-200 dark:text-slate-200 rounded-lg"></div>
      </div>
    );
  }

  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header com estatísticas otimizado e responsivo */}
      <Card className="shadow-sm border-0 bg-gradient-to-r dark:border dark:border-slate-700 from-blue-50 dark:from-slate-900 dark:to-slate-950 to-indigo-50">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 lg:gap-4">
              <div
                className={`p-2 lg:p-3 rounded-full ${statusInfo.color} shadow-sm`}
              >
                <StatusIcon className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
              <div>
                <h3 className="text-base lg:text-lg dark:text-slate-200 font-semibold text-gray-900">
                  Informações Adicionais
                </h3>
                <p className="text-gray-600 dark:text-slate-400 text-xs lg:text-sm">
                  {statusInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-4">
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                className="p-2 hover:bg-white/50"
                disabled={isLoading}
                title="Atualizar dados"
              >
                <RefreshCw
                  className={`h-4 w-4 dark:text-slate-200 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>

              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={`${statusInfo.color} bg-white border-current shadow-sm`}
                  >
                    {statusInfo.text}
                  </Badge>
                  <span className="text-xs lg:text-sm text-gray-600 dark:text-slate-400 font-medium">
                    {stats.questionsAnswered}/{stats.totalQuestions}
                  </span>
                </div>
                <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.completionPercentage}%
                </div>
              </div>
            </div>
          </div>

          {/* Barra de progresso otimizada */}
          <div className="mt-4 lg:mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs lg:text-sm text-gray-600 dark:text-slate-400 font-medium">
                Progresso das respostas
              </span>
              <span className="text-xs lg:text-sm font-semibold text-gray-700">
                {stats.completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 lg:h-3 shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 lg:h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção de ações otimizada e responsiva */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <CardTitle className="text-base lg:text-lg">
              Questionário do Deal
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {!showQuestionsForm && stats.totalQuestions > 0 && (
                <Button
                  onClick={toggleQuestionsForm}
                  size="sm"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Responder</span>
                </Button>
              )}

              {showQuestionsForm && (
                <Button
                  onClick={toggleQuestionsForm}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  <span>Cancelar Edição</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 lg:p-6">
          {stats.totalQuestions === 0 ? (
            <div className="text-center py-12 lg:py-16 text-gray-500 dark:text-slate-400">
              <div className="text-4xl lg:text-5xl mb-4">📝</div>
              <p className="font-medium mb-2">Nenhuma pergunta configurada</p>
              <p className="text-sm max-w-md mx-auto">
                Um administrador precisa configurar as perguntas primeiro nas
                configurações do sistema.
              </p>
            </div>
          ) : showQuestionsForm ? (
            <div className="rounded-lg">
              <DealQuestionsForm
                dealId={dealId}
                onSave={handleQuestionsUpdated}
              />
            </div>
          ) : (
            // Seção de visualização das respostas - simplificada
            <div className="space-y-3">
              {questionsWithAnswers.map((item, index) => (
                <div
                  key={item.question.id}
                  className={`p-4 rounded-lg border transition-all ${
                    item.isAnswered
                      ? "bg-gradient-to-r from-green-50 dark:from-green-700 dark:to-green-800 dark:border-green-900 to-emerald-50 border-green-200"
                      : "bg-gray-50 border-gray-200 dark:bg-slate-900 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-full flex-shrink-0 mt-1 ${
                        item.isAnswered ? "bg-green-100 dark:bg-green-700" : "bg-gray-100 dark:bg-slate-700"
                      }`}
                    >
                      {item.isAnswered ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-200" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400 dark:text-slate-200" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-200">
                            {item.question.question}
                          </h4>
                          {item.question.helpText && (
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                              {item.question.helpText}
                            </p>
                          )}
                        </div>
                        {item.question.isRequired && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-red-50 dark:bg-red-700 dark:border-red-800 dark:text-red-200 border-red-200 text-red-700 flex-shrink-0"
                          >
                            Obrigatória
                          </Badge>
                        )}
                      </div>

                      <div className="pt-2">
                        {item.isAnswered && item.answer ? (
                          <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-md p-3 border border-gray-200">
                            {renderAnswerValue(item.answer, item.question)}
                          </div>
                        ) : (
                          <div className="bg-white rounded-md p-3 border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                            <span className="text-gray-400 dark:text-slate-400 italic text-sm">
                              Não respondida
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {questionsWithAnswers.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="font-medium mb-2">
                    Nenhuma pergunta configurada
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações adicionais otimizadas e responsivas */}
      {stats.questionsAnswered > 0 && !showQuestionsForm && (
        <Card className="shadow-sm">
          <CardContent className="p-3 lg:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                <div className="w-2 h-2 bg-green-500 dark:bg-green-700 rounded-full animate-pulse"></div>
                <span className="text-xs lg:text-sm">
                  Última atualização:{" "}
                  {answers.length > 0
                    ? new Date(
                        Math.max(
                          ...answers.map((a) => new Date(a.updatedAt).getTime())
                        )
                      ).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Nunca"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    stats.completionPercentage === 100 ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {stats.completionPercentage === 100
                    ? "✅ Completo"
                    : "⏳ Em andamento"}
                </Badge>
                <span className="text-xs text-gray-500 dark:bg-slate-800 dark:text-slate-300 bg-gray-100 px-2 py-1 rounded">
                  {questionsWithAnswers.length} perguntas
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
