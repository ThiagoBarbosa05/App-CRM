import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Save, Loader2 } from "lucide-react";

interface DealQuestion {
  id: string;
  question: string;
  questionType: "boolean" | "number" | "text" | "select" | "multiselect";
  options: string[];
  category: string;
  isRequired: boolean;
  isActive: boolean;
  helpText?: string;
  placeholder?: string;
}

interface DealAnswer {
  id?: string;
  dealId: string;
  questionId: string;
  answerBoolean?: boolean;
  answerNumber?: string;
  answerText?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DealAnswerWithQuestion extends DealAnswer {
  question: DealQuestion;
}

interface DealQuestionsFormProps {
  dealId: string;
  onSave?: (answers: DealAnswer[]) => void;
  readOnly?: boolean;
}

// Cache keys
const CACHE_KEYS = {
  questions: ["deal-questions"] as const,
  dealAnswers: (dealId: string) => ["deal-answers", dealId] as const,
} as const;

// API functions
const fetchActiveQuestions = async (): Promise<DealQuestion[]> => {
  const response = await fetch("/api/deal-questions?isActive=true");
  if (!response.ok) {
    throw new Error(`Erro ao buscar perguntas: ${response.status}`);
  }
  return response.json();
};

const fetchDealAnswers = async (
  dealId: string
): Promise<DealAnswerWithQuestion[]> => {
  const response = await fetch(`/api/deals/${dealId}/answers`);
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Erro ao buscar respostas: ${response.status}`);
  }
  return response.json();
};

const saveDealAnswers = async (
  dealId: string,
  answers: DealAnswer[]
): Promise<DealAnswer[]> => {
  const response = await fetch(`/api/deals/${dealId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao salvar respostas: ${response.status}`);
  }

  return response.json();
};

export function DealQuestionsForm({
  dealId,
  onSave,
  readOnly = false,
}: DealQuestionsFormProps) {
  const [answers, setAnswers] = useState<Map<string, DealAnswer>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const queryClient = useQueryClient();

  // Queries com cache otimizado
  const {
    data: questions = [],
    isLoading: questionsLoading,
    error: questionsError,
  } = useQuery({
    queryKey: CACHE_KEYS.questions,
    queryFn: fetchActiveQuestions,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: 2,
  });

  const {
    data: existingAnswers = [],
    isLoading: answersLoading,
    error: answersError,
  } = useQuery({
    queryKey: CACHE_KEYS.dealAnswers(dealId),
    queryFn: () => fetchDealAnswers(dealId),
    enabled: !!dealId,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
  });

  // Inicializar answers quando dados são carregados
  React.useEffect(() => {
    if (existingAnswers.length > 0) {
      const answersMap = new Map<string, DealAnswer>();
      existingAnswers.forEach((answer: DealAnswerWithQuestion) => {
        answersMap.set(answer.questionId, {
          dealId: answer.dealId,
          questionId: answer.questionId,
          answerBoolean: answer.answerBoolean,
          answerNumber: answer.answerNumber,
          answerText: answer.answerText,
        });
      });
      setAnswers(answersMap);
    }
  }, [existingAnswers]);

  // Mutation para salvar respostas
  const saveMutation = useMutation({
    mutationFn: (answersArray: DealAnswer[]) =>
      saveDealAnswers(dealId, answersArray),
    onSuccess: (data) => {
      // Atualizar cache
      queryClient.invalidateQueries({
        queryKey: CACHE_KEYS.dealAnswers(dealId),
      });
      onSave?.(data);
      console.log("Respostas salvas com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao salvar respostas:", error);
    },
  });

  // Handler otimizado para mudanças de resposta
  const handleAnswerChange = useCallback(
    (questionId: string, value: any, type: DealQuestion["questionType"]) => {
      setAnswers((prev) => {
        const newMap = new Map(prev);

        // Criar objeto base limpo
        let updatedAnswer: DealAnswer = {
          dealId,
          questionId,
        };

        switch (type) {
          case "boolean":
            updatedAnswer.answerBoolean = Boolean(value);
            break;
          case "number":
            const numValue = value === "" ? "" : String(Number(value) || 0);
            if (numValue !== "") {
              updatedAnswer.answerNumber = numValue;
            }
            break;
          case "text":
          case "select":
          case "multiselect":
            const textValue = String(value || "");
            if (textValue !== "") {
              updatedAnswer.answerText = textValue;
            }
            break;
          default:
            // Manter resposta existente se tipo não reconhecido
            updatedAnswer = newMap.get(questionId) || { dealId, questionId };
        }

        newMap.set(questionId, updatedAnswer);
        return newMap;
      });

      // Limpar erro se existir
      setErrors((prev) => {
        if (prev.has(questionId)) {
          const newErrors = new Map(prev);
          newErrors.delete(questionId);
          return newErrors;
        }
        return prev;
      });
    },
    [dealId]
  );

  // Validação otimizada
  const validateAnswers = useCallback((): boolean => {
    const newErrors = new Map<string, string>();

    questions.forEach((question) => {
      if (question.isRequired) {
        const answer = answers.get(question.id);

        if (!answer) {
          newErrors.set(question.id, "Esta pergunta é obrigatória");
          return;
        }

        switch (question.questionType) {
          case "boolean":
            if (typeof answer.answerBoolean !== "boolean") {
              newErrors.set(question.id, "Esta pergunta é obrigatória");
            }
            break;
          case "number":
            if (!answer.answerNumber || answer.answerNumber === "") {
              newErrors.set(question.id, "Esta pergunta é obrigatória");
            }
            break;
          case "text":
          case "select":
          case "multiselect":
            if (!answer.answerText || answer.answerText.trim() === "") {
              newErrors.set(question.id, "Esta pergunta é obrigatória");
            }
            break;
        }
      }
    });

    setErrors(newErrors);
    return newErrors.size === 0;
  }, [questions, answers]);

  // Handler de salvamento
  const handleSave = useCallback(async () => {
    if (!validateAnswers()) {
      return;
    }

    const answersArray = Array.from(answers.values())
      .filter((answer) => {
        // Incluir apenas respostas que tenham valores válidos
        // Usar typeof para distinguir boolean false de undefined
        return (
          typeof answer.answerBoolean === "boolean" ||
          (answer.answerNumber && answer.answerNumber !== "") ||
          (answer.answerText && answer.answerText.trim() !== "")
        );
      })
      .map((answer) => {
        // Criar resposta limpa com apenas o campo necessário
        const cleanAnswer: DealAnswer = {
          dealId: answer.dealId,
          questionId: answer.questionId,
        };

        // Adicionar APENAS o campo que tem valor (não mais de um)
        if (typeof answer.answerBoolean === "boolean") {
          cleanAnswer.answerBoolean = answer.answerBoolean;
        } else if (answer.answerNumber && answer.answerNumber !== "") {
          cleanAnswer.answerNumber = answer.answerNumber;
        } else if (answer.answerText && answer.answerText.trim() !== "") {
          cleanAnswer.answerText = answer.answerText;
        }

        return cleanAnswer;
      });

    // console.log("Respostas preparadas para envio:");
    // answersArray.forEach((answer, index) => {
    //   console.log(`Resposta ${index}:`, {
    //     questionId: answer.questionId,
    //     answerBoolean: answer.answerBoolean,
    //     answerNumber: answer.answerNumber,
    //     answerText: answer.answerText,
    //     fieldsPresent: Object.keys(answer).filter(
    //       (key) =>
    //         !["dealId", "questionId"].includes(key) &&
    //         answer[key as keyof DealAnswer] !== undefined
    //     ),
    //   });
    // });
    saveMutation.mutate(answersArray);
  }, [validateAnswers, answers, saveMutation]);

  // Render otimizado do input por tipo
  const renderQuestionInput = useCallback(
    (question: DealQuestion) => {
      const answer = answers.get(question.id);
      const hasError = errors.has(question.id);

      switch (question.questionType) {
        case "boolean":
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={question.id}
                checked={answer?.answerBoolean || false}
                onCheckedChange={(checked) =>
                  handleAnswerChange(question.id, checked, "boolean")
                }
                disabled={readOnly}
              />
              <Label
                htmlFor={question.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Sim
              </Label>
            </div>
          );

        case "number":
          return (
            <Input
              type="number"
              value={answer?.answerNumber || ""}
              onChange={(e) =>
                handleAnswerChange(question.id, e.target.value, "number")
              }
              placeholder={question.placeholder || "Digite um número"}
              disabled={readOnly}
              className={hasError ? "border-red-500" : ""}
            />
          );

        case "text":
          return (
            <Textarea
              value={answer?.answerText || ""}
              onChange={(e) =>
                handleAnswerChange(question.id, e.target.value, "text")
              }
              placeholder={question.placeholder || "Digite sua resposta"}
              disabled={readOnly}
              className={hasError ? "border-red-500" : ""}
              rows={3}
            />
          );

        case "select":
          return (
            <Select
              value={answer?.answerText || ""}
              onValueChange={(value) =>
                handleAnswerChange(question.id, value, "select")
              }
              disabled={readOnly}
            >
              <SelectTrigger className={hasError ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {question.options.map((option, index) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );

        case "multiselect":
          const selectedOptions = answer?.answerText
            ? answer.answerText.split(",")
            : [];
          return (
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${index}`}
                    checked={selectedOptions.includes(option)}
                    onCheckedChange={(checked) => {
                      let newSelected = [...selectedOptions];
                      if (checked) {
                        newSelected.push(option);
                      } else {
                        newSelected = newSelected.filter(
                          (item) => item !== option
                        );
                      }
                      handleAnswerChange(
                        question.id,
                        newSelected.join(","),
                        "multiselect"
                      );
                    }}
                    disabled={readOnly}
                  />
                  <Label
                    htmlFor={`${question.id}-${index}`}
                    className="text-sm"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          );

        default:
          return null;
      }
    },
    [answers, errors, handleAnswerChange, readOnly]
  );

  const isLoading = questionsLoading || answersLoading;
  const hasError = questionsError || answersError;

  if (hasError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-200 mb-2">
            Erro ao carregar dados
          </h3>
          <p className="text-gray-600 dark:text-slate-400 text-sm">
            {hasError instanceof Error ? hasError.message : "Erro desconhecido"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="ml-2 dark:text-slate-400">Carregando perguntas...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com progresso */}
      <div className="flex items-center justify-between pb-4 border-b dark:border-slate-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Questionário do Deal
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Preencha as informações adicionais sobre este deal
          </p>
        </div>
        {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="min-w-[140px] bg-blue-600 text-white hover:bg-blue-700"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Respostas
              </>
            )}
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-400">
            Progresso do questionário
          </span>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {
              Array.from(answers.values()).filter(
                (a) =>
                  typeof a.answerBoolean === "boolean" ||
                  (a.answerNumber && a.answerNumber !== "") ||
                  (a.answerText && a.answerText.trim() !== "")
              ).length
            }
            /{questions.length} respondidas
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${
                questions.length > 0
                  ? (Array.from(answers.values()).filter(
                      (a) =>
                        typeof a.answerBoolean === "boolean" ||
                        (a.answerNumber && a.answerNumber !== "") ||
                        (a.answerText && a.answerText.trim() !== "")
                    ).length /
                      questions.length) *
                    100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const hasError = errors.has(question.id);
          const isAnswered =
            answers.has(question.id) &&
            (typeof answers.get(question.id)?.answerBoolean === "boolean" ||
              answers.get(question.id)?.answerNumber ||
              answers.get(question.id)?.answerText);

          return (
            <div
              key={question.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                hasError
                  ? "border-red-300 dark:bg-red-700 dark:border-red-800 bg-red-50"
                  : isAnswered
                  ? "border-green-300 dark:border-green-700 dark:bg-green-800 bg-green-50"
                  : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:hover:border-slate-600 hover:border-gray-300"
              }`}
            >
              <div className="space-y-3">
                {index > 0 && <Separator className="my-4" />}

                {/* Question header */}
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      hasError
                        ? "bg-red-200 text-red-700 dark:bg-red-700 dark:text-red-200"
                        : isAnswered
                        ? "bg-green-200 text-green-700 dark:bg-green-700 dark:text-green-200"
                        : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <Label
                      className={`text-base font-medium flex items-center gap-2 ${
                        hasError ? "text-red-700 dark:text-red-200" : "text-gray-900 dark:text-slate-200"
                      }`}
                    >
                      {question.question}
                      {question.isRequired && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-50 dark:border-red-800 dark:bg-red-700 dark:text-red-200 border-red-200 text-red-700"
                        >
                          Obrigatória
                        </Badge>
                      )}
                      {isAnswered && !hasError && (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </Label>

                    {question.helpText && (
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                        {question.helpText}
                      </p>
                    )}
                  </div>
                </div>

                {/* Question input */}
                <div className="ml-11">
                  {renderQuestionInput(question)}

                  {hasError && (
                    <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-slate-400 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {errors.get(question.id)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {questions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-gray-500 dark:text-slate-400">
            <div className="text-4xl mb-2">📝</div>
            <p className="font-medium mb-1">Nenhuma pergunta configurada</p>
            <p className="text-sm">
              Configure perguntas no sistema para começar a usar este recurso.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Footer actions */}
      {!readOnly && questions.length > 0 && (
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            size="lg"
            className="min-w-[160px] bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Respostas
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
