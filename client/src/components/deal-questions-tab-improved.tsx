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
  Eye,
  EyeOff,
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
  const [showAnswers, setShowAnswers] = useState(false);
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
        color: "text-green-600 bg-green-100",
        text: "Completo",
        description: "Todas as perguntas foram respondidas",
      };
    }
    if (completionPercentage >= 50) {
      return {
        icon: Clock,
        color: "text-yellow-600 bg-yellow-100",
        text: "Em andamento",
        description: "Algumas perguntas ainda precisam ser respondidas",
      };
    }
    return {
      icon: AlertCircle,
      color: "text-red-600 bg-red-100",
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

  const toggleAnswersView = useCallback(() => {
    setShowAnswers((prev) => !prev);
  }, []);

  // Helper function para renderizar o valor da resposta
  const renderAnswerValue = useCallback((answer: DealAnswer) => {
    const { question } = answer;

    if (typeof answer.answerBoolean === "boolean") {
      return (
        <div className="flex items-center gap-2">
          <Check
            className={`h-4 w-4 ${
              answer.answerBoolean ? "text-green-600" : "text-red-600"
            }`}
          />
          <span
            className={answer.answerBoolean ? "text-green-700" : "text-red-700"}
          >
            {answer.answerBoolean ? "Sim" : "Não"}
          </span>
        </div>
      );
    }

    if (answer.answerNumber) {
      return (
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-blue-600" />
          <span className="text-blue-700 font-medium">
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
          <div className="flex items-start gap-2">
            <CheckSquare className="h-4 w-4 text-purple-600 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {options.map((option, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
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
            <List className="h-4 w-4 text-indigo-600" />
            <Badge variant="outline" className="text-indigo-700">
              {answer.answerText}
            </Badge>
          </div>
        );
      }

      // Text answer
      return (
        <div className="flex items-start gap-2">
          <Type className="h-4 w-4 text-gray-600 mt-0.5" />
          <p className="text-gray-700 text-sm leading-relaxed">
            {answer.answerText}
          </p>
        </div>
      );
    }

    return <span className="text-gray-500 italic">Sem resposta</span>;
  }, []);

  // Agrupar perguntas por categoria com suas respostas
  const questionsWithAnswers = useMemo(() => {
    const answersByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer])
    );

    return questions.reduce(
      (acc, question) => {
        if (!acc[question.category]) {
          acc[question.category] = [];
        }

        const answer = answersByQuestionId.get(question.id);
        acc[question.category].push({
          question,
          answer: answer || null,
          isAnswered: !!answer,
        });

        return acc;
      },
      {} as Record<
        string,
        Array<{
          question: DealQuestion;
          answer: DealAnswer | null;
          isAnswered: boolean;
        }>
      >
    );
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
            <AlertCircle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Erro ao carregar dados
              </h3>
              <p className="text-gray-600 text-sm mb-4">
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
        <div className="h-40 bg-gray-200 rounded-lg"></div>
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header com estatísticas otimizado */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${statusInfo.color}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Informações Adicionais
                </h3>
                <p className="text-gray-600 text-sm">
                  {statusInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                className="p-2"
                disabled={isLoading}
                title="Atualizar dados"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>

              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={statusInfo.color}>
                    {statusInfo.text}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {stats.questionsAnswered}/{stats.totalQuestions}
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.completionPercentage}%
                </div>
              </div>
            </div>
          </div>

          {/* Barra de progresso otimizada */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">
                Progresso das respostas
              </span>
              <span className="text-sm font-medium">
                {stats.completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção de ações otimizada */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {showQuestionsForm
                ? "Respondendo Perguntas"
                : showAnswers
                ? "Visualizando Respostas"
                : "Perguntas do Deal"}
            </CardTitle>

            <div className="flex items-center gap-2">
              {!showQuestionsForm && stats.questionsAnswered > 0 && (
                <Button
                  onClick={toggleAnswersView}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  {showAnswers ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Ocultar Respostas
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Ver Respostas
                    </>
                  )}
                </Button>
              )}

              {!showQuestionsForm && (
                <Button
                  onClick={toggleQuestionsForm}
                  variant={stats.questionsAnswered > 0 ? "outline" : "default"}
                  className="flex items-center gap-2"
                  disabled={stats.totalQuestions === 0}
                >
                  {stats.questionsAnswered > 0 ? (
                    <>
                      <Edit2 className="h-4 w-4" />
                      Editar Respostas
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Responder Perguntas
                    </>
                  )}
                </Button>
              )}

              {showQuestionsForm && (
                <Button
                  onClick={toggleQuestionsForm}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {showQuestionsForm ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <DealQuestionsForm
                dealId={dealId}
                onSave={handleQuestionsUpdated}
              />
            </div>
          ) : showAnswers && stats.questionsAnswered > 0 ? (
            // Seção de visualização das respostas
            <div className="space-y-6">
              {Object.keys(questionsWithAnswers).map((category) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <Badge variant="outline" className="text-sm font-medium">
                      {category}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      (
                      {
                        questionsWithAnswers[category].filter(
                          (item) => item.isAnswered
                        ).length
                      }
                      /{questionsWithAnswers[category].length} respondidas)
                    </span>
                  </div>

                  <div className="space-y-4">
                    {questionsWithAnswers[category].map((item, index) => (
                      <div
                        key={item.question.id}
                        className={`p-4 rounded-lg border transition-all ${
                          item.isAnswered
                            ? "bg-green-50 border-green-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              item.isAnswered
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {item.isAnswered ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>

                          <div className="flex-1 space-y-2">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-1">
                                {item.question.question}
                                {item.question.isRequired && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </h4>

                              {item.question.helpText && (
                                <p className="text-xs text-gray-500 mb-2">
                                  {item.question.helpText}
                                </p>
                              )}
                            </div>

                            <div className="mt-2">
                              {item.isAnswered && item.answer ? (
                                <div className="bg-white p-3 rounded border border-gray-100">
                                  {renderAnswerValue(item.answer)}
                                </div>
                              ) : (
                                <div className="bg-gray-100 p-3 rounded border border-gray-200 text-center">
                                  <span className="text-gray-500 text-sm italic">
                                    Pergunta não respondida
                                  </span>
                                </div>
                              )}
                            </div>

                            {item.isAnswered && item.answer && (
                              <div className="text-xs text-gray-500 mt-2">
                                Respondida em:{" "}
                                {new Date(
                                  item.answer.createdAt
                                ).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(questionsWithAnswers).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="font-medium mb-1">
                    Nenhuma pergunta configurada
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Seção de resumo (exibição padrão)
            <div className="space-y-4">
              {stats.totalQuestions === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="font-medium mb-1">
                    Nenhuma pergunta configurada
                  </p>
                  <p className="text-sm">
                    Um administrador precisa configurar as perguntas primeiro
                    nas configurações do sistema.
                  </p>
                </div>
              ) : stats.questionsAnswered === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🤔</div>
                  <p className="font-medium mb-1">
                    Nenhuma pergunta respondida ainda
                  </p>
                  <p className="text-sm">
                    Responda às perguntas para adicionar informações importantes
                    sobre este deal
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {stats.questionsAnswered} pergunta(s) respondida(s)
                  </div>

                  {stats.pendingQuestions > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      {stats.pendingQuestions} pergunta(s) pendente(s)
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Dica:</strong> Informações completas ajudam na
                      análise e comparação entre deals.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações adicionais otimizadas */}
      {stats.questionsAnswered > 0 && !showQuestionsForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>
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

              <div className="text-xs text-gray-500">
                {stats.completionPercentage === 100
                  ? "✅ Completo"
                  : "⏳ Em andamento"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
