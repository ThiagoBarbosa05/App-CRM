import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface ClientFunnelsTabProps {
  clientId: string;
  clientName: string;
  isOpen: boolean; // Utilizado para habilitar a query apenas quando a aba/modal abrir
  onCreateDeal: (funnelId: string) => void;
}

export function ClientFunnelsTab({
  clientId,
  clientName,
  isOpen,
  onCreateDeal,
}: ClientFunnelsTabProps) {
  const { data: clientFunnels = [] } = useQuery({
    queryKey: [`/api/clients/${clientId}/funnels`],
    enabled: !!clientId && isOpen,
  });

  const { data: allFunnels = [] } = useQuery({
    queryKey: ["/api/funnels"],
    enabled: !!clientId && isOpen,
  });

  return (
    <div className="space-y-6">
      {Array.isArray(clientFunnels) && clientFunnels.length > 0 && (
        <Card className="border border-indigo-100 dark:border-indigo-900 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 dark:from-indigo-950/60 dark:to-blue-950/60 border-b border-indigo-100/50 dark:border-indigo-900/50">
            <CardTitle className="text-lg flex items-center gap-3 font-semibold text-indigo-900 dark:text-indigo-300">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg">
                <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Negócios Ativos
            </CardTitle>
            <p className="text-indigo-700/80 dark:text-indigo-400/80 text-sm mt-1 mb-0 pb-0">
              Funis onde este cliente já possui negócios em andamento
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientFunnels.map((funnel: any) => (
                <Button
                  key={`active-funnel-${funnel.id}`}
                  variant="default"
                  className="w-full justify-start h-auto p-4 bg-indigo-600 hover:bg-indigo-700 hover:shadow-md transition-all duration-300 rounded-xl"
                  onClick={() => onCreateDeal(funnel.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg shrink-0">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-semibold text-white text-base truncate">
                        {funnel.name}
                      </p>
                      {funnel.description && (
                         <p className="text-sm text-indigo-100 mt-0.5 truncate max-w-full">
                           {funnel.description}
                         </p>
                      )}
                      <p className="text-xs text-indigo-200 mt-1.5 font-medium uppercase tracking-wider">
                        Adicionar ao Funil →
                      </p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-lg flex items-center gap-3 font-semibold text-slate-800 dark:text-slate-200">
            <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg">
              <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            Novo Negócio
          </CardTitle>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Selecione um funil abaixo para iniciar uma nova negociação com{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {clientName}
            </span>
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(allFunnels) && allFunnels.length > 0 ? (
              allFunnels.map((funnel: any) => (
                <Button
                  key={`all-funnel-${funnel.id}`}
                  variant="outline"
                  className="w-full justify-start h-auto p-4 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 rounded-xl group"
                  onClick={() => onCreateDeal(funnel.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors shrink-0">
                      <User className="h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-base truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                        {funnel.name}
                      </p>
                      {funnel.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full">
                          {funnel.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Button>
              ))
            ) : (
              <div className="col-span-1 md:col-span-2 py-10 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                  <User className="h-6 w-6 text-slate-400" />
                </div>
                <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                  Nenhum funil disponível
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  Configure funis de vendas no sistema para poder abrir negócios para este cliente.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
