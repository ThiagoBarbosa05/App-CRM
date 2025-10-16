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
  displayOrder: number;
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
  const data = await response.json();
  // Ordenar por displayOrder
  return data.sort(
    (a: DealQuestion, b: DealQuestion) => a.displayOrder - b.displayOrder
  );
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

    console.log("Respostas preparadas para envio:");
    answersArray.forEach((answer, index) => {
      console.log(`Resposta ${index}:`, {
        questionId: answer.questionId,
        answerBoolean: answer.answerBoolean,
        answerNumber: answer.answerNumber,
        answerText: answer.answerText,
        fieldsPresent: Object.keys(answer).filter(
          (key) =>
            !["dealId", "questionId"].includes(key) &&
            answer[key as keyof DealAnswer] !== undefined
        ),
      });
    });
    saveMutation.mutate(answersArray);
  }, [validateAnswers, answers, saveMutation]);

  // Agrupar perguntas por categoria com useMemo
  const questionsByCategory = useMemo(() => {
    return questions.reduce((acc, question) => {
      if (!acc[question.category]) {
        acc[question.category] = [];
      }
      acc[question.category].push(question);
      return acc;
    }, {} as Record<string, DealQuestion[]>);
  }, [questions]);

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
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">
            Erro ao carregar dados
          </h3>
          <p className="text-gray-600 text-sm">
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2">Carregando perguntas...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Informações Adicionais do Deal
        </h3>
        {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="min-w-[120px]"
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

      {Object.keys(questionsByCategory).map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">{category}</Badge>
              <span className="text-sm text-gray-500">
                ({questionsByCategory[category].length} pergunta
                {questionsByCategory[category].length !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionsByCategory[category].map((question, index) => {
              const hasError = errors.has(question.id);
              const isAnswered =
                answers.has(question.id) &&
                (typeof answers.get(question.id)?.answerBoolean === "boolean" ||
                  answers.get(question.id)?.answerNumber ||
                  answers.get(question.id)?.answerText);

              return (
                <div key={question.id} className="space-y-2">
                  {index > 0 && <Separator />}

                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label
                        className={`text-sm font-medium flex items-center gap-2 ${
                          hasError ? "text-red-600" : ""
                        }`}
                      >
                        {question.question}
                        {question.isRequired && (
                          <span className="text-red-500">*</span>
                        )}
                        {isAnswered && !hasError && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </Label>

                      {question.helpText && (
                        <p className="text-xs text-gray-500 mt-1">
                          {question.helpText}
                        </p>
                      )}

                      <div className="mt-2">
                        {renderQuestionInput(question)}
                      </div>

                      {hasError && (
                        <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          {errors.get(question.id)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {questions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📝</div>
            <p className="font-medium mb-1">Nenhuma pergunta configurada</p>
            <p className="text-sm">
              Configure perguntas no sistema para começar a usar este recurso.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
