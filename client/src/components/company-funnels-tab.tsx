import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, Calendar, DollarSign, Eye } from "lucide-react";
import { Company, SalesFunnel } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompanyFunnelsTabProps {
  company: Company;
}

export default function CompanyFunnelsTab({ company }: CompanyFunnelsTabProps) {
  const { data: funnels = [], isLoading } = useQuery({
    queryKey: ["/api/companies", company.id, "funnels"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${company.id}/funnels`);
      if (!response.ok) throw new Error("Erro ao buscar funis");
      return response.json();
    },
  });

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  if (isLoading) {
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

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 justify-between items-start sm:items-center mb-6">
        <div className="flex-1">
          <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-200 mb-1">
            Funis com Negócios
          </h3>
          <p className="text-sm lg:text-base text-muted-foreground dark:text-slate-400">
            Funis onde{" "}
            <span className="font-medium text-gray-700 dark:text-slate-300">
              {company.nomeFantasia}
            </span>{" "}
            possui negócios ativos
          </p>
        </div>
      </div>

      {funnels.length === 0 ? (
        <Card className="shadow-sm border-0 bg-gradient-to-br from-gray-50 dark:from-slate-800 to-gray-100 dark:to-slate-900">
          <CardContent className="flex flex-col items-center justify-center py-12 lg:py-16 px-6">
            <div className="bg-blue-100 dark:bg-slate-700 p-4 rounded-full mb-6">
              <Target className="h-8 w-8 lg:h-10 lg:w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-200 mb-2 text-center">
              Nenhum funil encontrado
            </h3>
            <p className="text-sm lg:text-base text-gray-500 dark:text-slate-400 text-center mb-6 max-w-md">
              Esta empresa ainda não possui negócios em nenhum funil. Os funis
              aparecem aqui quando há negócios ativos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:gap-4">
          {funnels.map((funnel: SalesFunnel) => (
            <Card
              key={funnel.id}
              className="hover:shadow-md hover:border-gray-300 dark:hover:border-slate-700 dark:hover:to-slate-800/50 dark:hover:from-slate-800/50 transition-all duration-200 hover:bg-gradient-to-r hover:from-white hover:to-gray-50 shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 lg:p-3 rounded-full bg-gradient-to-r from-wine-100 to-purple-100 shadow-sm flex-shrink-0">
                      <Target className="h-5 w-5 lg:h-6 lg:w-6 text-wine-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base lg:text-lg font-semibold text-gray-900 dark:text-slate-200 mb-1 truncate">
                        {funnel.name}
                      </CardTitle>
                      {funnel.description && (
                        <p className="text-sm lg:text-base text-muted-foreground dark:text-slate-400 leading-relaxed">
                          {funnel.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-3 flex-shrink-0">
                    <Badge
                      variant={funnel.isActive ? "default" : "secondary"}
                      className={`shadow-sm font-medium text-xs lg:text-sm ${
                        funnel.isActive
                          ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700"
                          : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                      }`}
                    >
                      {funnel.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navegar para o funil específico
                        window.open(`/funil?id=${funnel.id}`, "_blank");
                      }}
                      className="bg-gradient-to-r from-blue-600 to-blue-700  border-blue-600 hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all duration-200 w-full sm:w-auto"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Ver Funil</span>
                      <span className="sm:hidden">Ver</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 dark:from-slate-950 dark:to-slate-950 to-indigo-50 rounded-lg border border-blue-100">
                    <div className="bg-blue-100  dark:bg-slate-900 p-2 rounded-full">
                      <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600 dark:text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs lg:text-sm text-blue-700 dark:text-blue-500 font-medium">
                        Criado em
                      </p>
                      <p className="font-semibold text-sm lg:text-base text-blue-900 dark:text-blue-500">
                        {formatDate(funnel.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 dark:from-slate-950 dark:to-slate-950 to-emerald-50 rounded-lg border border-green-100">
                    <div className="bg-green-100 dark:bg-slate-900 p-2 rounded-full">
                      <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-green-600 dark:text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs lg:text-sm text-green-700 dark:text-green-500 font-medium">
                        Status
                      </p>
                      <p className="font-semibold text-sm lg:text-base text-green-900 dark:text-green-500">
                        {funnel.isActive ? "Em operação" : "Pausado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 dark:from-slate-950 dark:to-slate-950 to-violet-50 rounded-lg border border-purple-100 sm:col-span-2 lg:col-span-1">
                    <div className="bg-purple-100 dark:bg-slate-900  p-2 rounded-full">
                      <DollarSign className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600 dark:text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs lg:text-sm text-purple-700 dark:text-purple-500 font-medium">
                        Negócios
                      </p>
                      <p className="font-semibold text-sm lg:text-base text-purple-900 dark:text-purple-500 truncate">
                        Clique em "Ver Funil" para visualizar
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
