import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Hash,
  Type,
  List,
  ListChecks,
  Eye,
  FileText,
  GitBranch,
} from "lucide-react";
import { Company } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompanyAnsweredQuestionsTabProps {
  company: Company;
}

interface DealAnsweredQuestion {
  id: string;
  question: string;
  questionType: "boolean" | "number" | "text" | "select" | "multiselect";
  category: string;
  answer: boolean | number | string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DealInfo {
  dealId: string;
  companyId: string;
  dealTitle?: string;
  companyName?: string;
  totalAnsweredQuestions: number;
  answeredQuestions: DealAnsweredQuestion[];
}

export default function CompanyAnsweredQuestionsTab({
  company,
}: CompanyAnsweredQuestionsTabProps) {
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());

  // Buscar todos os deals e filtrar pelo companyId no frontend (temporário)
  const { data: allDeals = [], isLoading: isLoadingDeals } = useQuery({
    queryKey: ["/api/deals"],
    queryFn: async () => {
      const response = await fetch(`/api/deals`);
      if (!response.ok) throw new Error("Erro ao buscar deals");
      return response.json();
    },
  });

  // Filtrar deals da empresa
  const deals = allDeals.filter((deal: any) => deal.companyId === company.id);

  // Para cada deal, buscar as perguntas respondidas
  const dealQuestionsQueries = useQuery({
    queryKey: [
      "/api/companies",
      company.id,
      "deals",
      "answered-questions",
      deals.map((d: any) => d.id),
    ],
    queryFn: async (): Promise<DealInfo[]> => {
      if (!deals || deals.length === 0) return [];

      const promises = deals.map(async (deal: any) => {
        try {
          const response = await fetch(
            `/api/companies/${company.id}/deals/${deal.id}/answered-questions`,
          );
          if (!response.ok) {
            // Se o deal não tem perguntas, não é um erro real
            if (response.status === 404) return null;
            console.warn(
              `Erro ao buscar perguntas do deal ${deal.id}:`,
              response.status,
            );
            return null;
          }
          const data = await response.json();
          return data.success
            ? { ...data.data, dealTitle: deal.title || deal.id }
            : null;
        } catch (error) {
          console.warn(`Erro ao buscar perguntas do deal ${deal.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      return results.filter((result): result is DealInfo => result !== null);
    },
    enabled: !!deals && deals.length > 0,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Manter em cache por 10 minutos (nova propriedade no React Query v5)
  });

  const toggleDealExpansion = (dealId: string) => {
    const newExpanded = new Set(expandedDeals);
    if (newExpanded.has(dealId)) {
      newExpanded.delete(dealId);
    } else {
      newExpanded.add(dealId);
    }
    setExpandedDeals(newExpanded);
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "boolean":
        return CheckCircle;
      case "number":
        return Hash;
      case "text":
        return Type;
      case "select":
        return List;
      case "multiselect":
        return ListChecks;
      default:
        return HelpCircle;
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case "boolean":
        return "bg-green-100 text-green-700 border-green-200";
      case "number":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "text":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "select":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "multiselect":
        return "bg-pink-100 text-pink-700 border-pink-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatAnswer = (answer: any, type: string) => {
    if (answer === null || answer === undefined) return "Não respondido";

    switch (type) {
      case "boolean":
        return answer ? "Sim" : "Não";
      case "number":
        return answer.toString();
      case "text":
      case "select":
      case "multiselect":
        return answer.toString();
      default:
        return answer.toString();
    }
  };

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (isLoadingDeals || dealQuestionsQueries.isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded"></div>
            <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded"></div>
            <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const dealsWithQuestions = dealQuestionsQueries.data || [];
  const totalQuestions = dealsWithQuestions.reduce(
    (sum: number, deal: DealInfo) => sum + deal.totalAnsweredQuestions,
    0,
  );

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 justify-between items-start sm:items-center mb-6">
        <div className="flex-1">
          <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100 mb-1">
            Perguntas Respondidas
          </h3>
          <p className="text-sm lg:text-base text-muted-foreground dark:text-slate-400">
            Respostas dos questionários dos deals de{" "}
            <span className="font-medium text-gray-700 dark:text-slate-300">
              {company.nomeFantasia}
            </span>
          </p>
        </div>
        {totalQuestions > 0 && (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            {totalQuestions} pergunta{totalQuestions !== 1 ? "s" : ""}{" "}
            respondida{totalQuestions !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {dealsWithQuestions.length === 0 ? (
        <Card className="shadow-sm border-0 bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 from-gray-50 to-gray-100">
          <CardContent className="flex flex-col items-center justify-center py-12 lg:py-16 px-6">
            <div className="bg-blue-100 dark:bg-slate-800 p-4 rounded-full mb-6">
              <HelpCircle className="h-8 w-8 lg:h-10 lg:w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-300 mb-2 text-center">
              Nenhuma pergunta respondida
            </h3>
            <p className="text-sm lg:text-base text-gray-500 dark:text-slate-400 text-center mb-6 max-w-md">
              Esta empresa ainda não possui perguntas respondidas em seus deals.
              As perguntas aparecem aqui quando são preenchidas nos formulários
              dos deals.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dealsWithQuestions.map((dealInfo: DealInfo) => {
            const isExpanded = expandedDeals.has(dealInfo.dealId);
            const hasQuestions = dealInfo.totalAnsweredQuestions > 0;

            return (
              <Card
                key={dealInfo.dealId}
                className="hover:shadow-md transition-shadow duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base lg:text-lg font-semibold text-gray-900 dark:text-slate-300 mb-1 truncate flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        {dealInfo.dealTitle ||
                          `Deal ${dealInfo.dealId.slice(0, 8)}...`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground dark:text-slate-400">
                        {dealInfo.totalAnsweredQuestions} pergunta
                        {dealInfo.totalAnsweredQuestions !== 1 ? "s" : ""}{" "}
                        respondida
                        {dealInfo.totalAnsweredQuestions !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {hasQuestions && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleDealExpansion(dealInfo.dealId)}
                        className="ml-2 flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {isExpanded && hasQuestions && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {dealInfo.answeredQuestions.map((question) => {
                        const TypeIcon = getQuestionTypeIcon(
                          question.questionType,
                        );

                        return (
                          <div
                            key={question.id}
                            className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-2 rounded-full flex-shrink-0 ${
                                  getQuestionTypeColor(
                                    question.questionType,
                                  ).split(" ")[0]
                                } ${
                                  getQuestionTypeColor(
                                    question.questionType,
                                  ).split(" ")[1]
                                }`}
                              >
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="mb-2">
                                  <p className="font-semibold text-gray-900 text-sm mb-1">
                                    {question.question}
                                  </p>
                                </div>

                                <div className="bg-white rounded-md p-3 border border-gray-200 mb-2">
                                  <p className="text-gray-700 font-medium text-sm">
                                    {formatAnswer(
                                      question.answer,
                                      question.questionType,
                                    )}
                                  </p>
                                </div>

                                <p className="text-xs text-gray-500">
                                  Respondido em {formatDate(question.updatedAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
