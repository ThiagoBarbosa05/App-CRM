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
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-l-4 border-l-blue-500 dark:border-l-blue-400">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Meus Clientes
          </CardTitle>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {stats?.totalClients || 0}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
            Clientes sob sua responsabilidade
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-l-4 border-l-green-500 dark:border-l-green-400">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Negócios Ativos
          </CardTitle>
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {stats?.activeDeals || 0}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
            Oportunidades em andamento
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-2 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-l-4 border-l-yellow-500 dark:border-l-yellow-400">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Dívidas Pendentes
          </CardTitle>
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <CreditCard className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
              {pendingDebts.length}
            </div>
            {pendingDebts.length > 0 && (
              <div className="flex items-center gap-1 bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-full text-xs font-medium">
                <Clock className="h-3 w-3" />
                Ativa
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
            Cobranças a realizar
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-2 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-l-4 border-l-red-500 dark:border-l-red-400">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Dívidas Vencidas
          </CardTitle>
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl font-bold text-red-700 dark:text-red-400">
              {overdueDebts.length}
            </div>
            {overdueDebts.length > 0 && (
              <div className="flex items-center gap-1 bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                Urgente
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
            Requer atenção urgente
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
