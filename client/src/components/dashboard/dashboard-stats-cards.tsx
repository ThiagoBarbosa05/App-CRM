import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, CreditCard, AlertTriangle, Clock } from "lucide-react";
import { DashboardStats, ClientDebt } from "@/types/dashboard"; // we will create this type later

interface DashboardStatsCardsProps {
  stats?: DashboardStats;
  pendingDebts: ClientDebt[];
  overdueDebts: ClientDebt[];
}

export function DashboardStatsCards({
  stats,
  pendingDebts,
  overdueDebts,
}: DashboardStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 h-full">
        <CardContent className="p-6 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                Meus Clientes
              </span>
              <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                {stats?.totalClients || 0}
              </span>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Clientes sob sua responsabilidade
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 h-full">
        <CardContent className="p-6 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                Negócios Ativos
              </span>
              <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                {stats?.activeDeals || 0}
              </span>
            </div>
            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-400">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Oportunidades em andamento
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 h-full">
        <CardContent className="p-6 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                Dívidas Pendentes
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black tabular-nums text-yellow-600 dark:text-yellow-400">
                  {pendingDebts.length}
                </span>
                {pendingDebts.length > 0 && (
                  <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                    <Clock className="h-3 w-3" />
                    Ativa
                  </div>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-600 dark:text-yellow-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cobranças a realizar
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 dark:border-slate-800 shadow-md rounded-xl bg-white dark:bg-slate-950 h-full">
        <CardContent className="p-6 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                Dívidas Vencidas
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black tabular-nums text-red-600 dark:text-red-400">
                  {overdueDebts.length}
                </span>
                {overdueDebts.length > 0 && (
                  <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide animate-pulse">
                    <AlertTriangle className="h-3 w-3" />
                    Urgente
                  </div>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Requer atenção urgente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
