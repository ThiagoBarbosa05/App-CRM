import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, CreditCard, AlertTriangle, Clock, Target, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ClientDebt } from "@/types/dashboard";

interface DashboardSummaryTabProps {
  clientDebts: ClientDebt[];
  pendingDebts: ClientDebt[];
  overdueDebts: ClientDebt[];
}

export function DashboardSummaryTab({
  clientDebts,
  pendingDebts,
  overdueDebts,
}: DashboardSummaryTabProps) {
  return (
    <Card className="shadow-none border-0 bg-transparent">
      <CardHeader className="pb-6 px-6 pt-6">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-slate-100">
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          </div>
          <span>Resumo Executivo</span>
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 dark:text-slate-400 mt-2">
          Visão geral financeira e ações prioritárias para o negócio
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card de Resumo Financeiro */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 hover:border-gray-300 dark:hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Resumo Financeiro
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Total em dívidas:
                  </span>
                </div>
                <span className="font-bold text-lg text-gray-900 dark:text-slate-100">
                  {formatCurrency(
                    clientDebts.reduce(
                      (sum, debt) => sum + parseFloat(debt.amount),
                      0
                    )
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-400 dark:border-red-500">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    Dívidas vencidas:
                  </span>
                </div>
                <span className="font-bold text-lg text-red-700 dark:text-red-300">
                  {formatCurrency(
                    overdueDebts.reduce(
                      (sum, debt) => sum + parseFloat(debt.amount),
                      0
                    )
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-400 dark:border-yellow-500">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    Dívidas pendentes:
                  </span>
                </div>
                <span className="font-bold text-lg text-yellow-700 dark:text-yellow-300">
                  {formatCurrency(
                    pendingDebts.reduce(
                      (sum, debt) => sum + parseFloat(debt.amount),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card de Ações Recomendadas */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 hover:border-gray-300 dark:hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Ações Prioritárias
              </h3>
            </div>

            <div className="space-y-4">
              {overdueDebts.length > 0 && (
                <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 hover:shadow-sm transition-shadow">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-red-800 dark:text-red-300 mb-1">
                      Atenção Urgente
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {overdueDebts.length} dívida(s) vencida(s) requer(em)
                      cobrança imediata
                    </p>
                  </div>
                  <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-0 shrink-0">
                    {overdueDebts.length}
                  </Badge>
                </div>
              )}

              {pendingDebts.length > 0 && (
                <div className="flex items-start gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 hover:shadow-sm transition-shadow">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg shrink-0">
                    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                      Acompanhamento Necessário
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {pendingDebts.length} dívida(s) pendente(s) para
                      monitoramento
                    </p>
                  </div>
                  <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-0 shrink-0">
                    {pendingDebts.length}
                  </Badge>
                </div>
              )}

              {overdueDebts.length === 0 && pendingDebts.length === 0 && (
                <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-green-800 dark:text-green-300 mb-1">
                      Excelente Trabalho!
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Todas as atividades estão em dia. Continue o ótimo
                      trabalho!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
