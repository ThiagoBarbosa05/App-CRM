import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { CreditCard, Calendar, TrendingUp } from "lucide-react";
import EventsDashboard from "@/components/events-dashboard";

import { ClientDebt, DashboardStats } from "@/types/dashboard";
import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats-cards";
import { DashboardDebtsTab } from "@/components/dashboard/dashboard-debts-tab";
import { DashboardBirthdaysTab } from "@/components/dashboard/dashboard-birthdays-tab";
import { DashboardSummaryTab } from "@/components/dashboard/dashboard-summary-tab";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Buscar estatísticas do dashboard
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: [`/api/dashboard/stats/${user?.id}`],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats/${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!user,
  });

  // Buscar dívidas dos clientes (admin vê todas, vendedor vê suas)
  const { data: clientDebts = [] } = useQuery<ClientDebt[]>({
    queryKey: [`/api/client-debts`, user?.id, user?.role],
    queryFn: async () => {
      const url =
        user?.role === "admin" || user?.role === "administrador"
          ? `/api/client-debts`
          : `/api/client-debts?responsibleId=${user?.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch client debts");
      return response.json();
    },
    enabled: !!user,
  });

  // Buscar próximos aniversários
  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: [`/api/birthdays/upcoming`, user?.id, user?.role],
    queryFn: async () => {
      // Admin vê todos, outros usuários só veem os seus
      const url =
        user?.role === "admin" || user?.role === "administrador"
          ? `/api/birthdays/upcoming`
          : `/api/birthdays/upcoming?responsibleId=${user?.id}`;

      const response = await fetch(url, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch birthdays");
      const data = await response.json();

      // Calcular dias até o aniversário para cada cliente
      const clientsWithDays = data.map((client: any) => {
        if (!client.nextBirthday) return { ...client, daysUntil: 365 };

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalizar para início do dia

        const nextBirthday = new Date(client.nextBirthday);
        nextBirthday.setHours(0, 0, 0, 0); // Normalizar para início do dia

        const diffTime = nextBirthday.getTime() - today.getTime();
        const daysUntil = Math.max(
          0,
          Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
        );

        return { ...client, daysUntil };
      });

      // Ordenar por dias até aniversário e limitar a 15 resultados
      return clientsWithDays
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
        .slice(0, 15);
    },
    enabled: !!user,
  });

  const getDebtStatusColor = (status: string, dueDate: string) => {
    if (status === "paid")
      return "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200";
    if (status === "overdue" || new Date(dueDate) < new Date())
      return "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200";
  };

  const getDebtStatusText = (status: string, dueDate: string) => {
    if (status === "paid") return "Pago";
    if (status === "overdue" || new Date(dueDate) < new Date())
      return "Vencida";
    return "Pendente";
  };

  const getOverdueDays = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const pendingDebts = clientDebts.filter((debt) => debt.status === "pending");
  const overdueDebts = clientDebts.filter(
    (debt) => debt.status === "pending" && new Date(debt.dueDate) < new Date(),
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex flex-col">
          <div className="bg-white dark:bg-slate-950 border-b mb-6 border-gray-200 dark:border-slate-800 px-6 py-4 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <TrendingUp className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  Dashboard
                </h2>
                <p className="text-gray-600 dark:text-slate-400 mt-1">
                  Visão geral das suas atividades
                </p>
              </div>
            </div>
          </div>
          {/* <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Visão geral das suas atividades</p>
            </div>
          </div> */}

          {/* Cards de Estatísticas */}
          <DashboardStatsCards
            stats={stats}
            pendingDebts={pendingDebts}
            overdueDebts={overdueDebts}
          />

          {/* Tabs com conteúdo */}
          <Tabs defaultValue="debts" className="space-y-6">
            <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-1 rounded-lg bg-slate-50 dark:bg-slate-900">
                <TabsTrigger
                  value="debts"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200 
                           data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-red-200 dark:data-[state=active]:border-red-800
                           hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200 text-gray-600 dark:text-slate-400 border border-transparent"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className="truncate">Dívidas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="birthdays"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                           data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800
                           hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200 text-gray-600 dark:text-slate-400 border border-transparent"
                >
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="truncate">Aniversários</span>
                </TabsTrigger>
                <TabsTrigger
                  value="events"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                           data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800
                           hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200 text-gray-600 dark:text-slate-400 border border-transparent"
                >
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="truncate">Eventos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="summary"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                           data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-green-200 dark:data-[state=active]:border-green-800
                           hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200 text-gray-600 dark:text-slate-400 border border-transparent"
                >
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  <span className="truncate">Resumo</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="debts"
              className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm"
            >
              <DashboardDebtsTab
                pendingDebts={pendingDebts}
                setSelectedClient={(client) =>
                  navigate(`/clientes/${client.id}`)
                }
              />
            </TabsContent>

            <TabsContent
              value="birthdays"
              className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm"
            >
              <DashboardBirthdaysTab
                upcomingBirthdays={upcomingBirthdays}
                setSelectedClient={(client) =>
                  navigate(`/clientes/${client.id}`)
                }
              />
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <EventsDashboard />
            </TabsContent>

            <TabsContent
              value="summary"
              className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm"
            >
              <DashboardSummaryTab
                clientDebts={clientDebts}
                pendingDebts={pendingDebts}
                overdueDebts={overdueDebts}
                upcomingBirthdays={upcomingBirthdays}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
