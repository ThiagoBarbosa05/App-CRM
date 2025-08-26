import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  TrendingUp,
  Calendar,
  DollarSign,
  Eye,
} from "lucide-react";
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

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium">Funis com Negócios</h3>
          <p className="text-sm text-muted-foreground">
            Funis onde {company.nomeFantasia} possui negócios ativos
          </p>
        </div>
      </div>

      {funnels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum funil encontrado
            </h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Esta empresa ainda não possui negócios em nenhum funil.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {funnels.map((funnel: SalesFunnel) => (
            <Card key={funnel.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-wine-100">
                      <Target className="h-5 w-5 text-wine-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{funnel.name}</CardTitle>
                      {funnel.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {funnel.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={funnel.isActive ? "default" : "secondary"}>
                      {funnel.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navegar para o funil específico
                        window.open(`/funil?id=${funnel.id}`, '_blank');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Funil
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Criado em</p>
                      <p className="font-medium">{formatDate(funnel.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="font-medium">
                        {funnel.isActive ? "Em operação" : "Pausado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Negócios</p>
                      <p className="font-medium">Clique em "Ver Funil" para visualizar</p>
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