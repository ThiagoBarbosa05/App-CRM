import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Target,
  Calendar,
  AlertTriangle,
  Phone,
  Mail,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  User,
} from "lucide-react";
import ClientDetailsCard from "@/components/client-details-card";
import EventsDashboard from "@/components/events-dashboard";

interface ClientDebt {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    responsibleName?: string;
  };
  amount: string;
  description: string;
  dueDate: string;
  status: "pending" | "overdue" | "paid";
  createdAt: string;
}

interface DashboardStats {
  totalClients: number;
  activeDeals: number;
  monthlyGoal: number;
  monthlyProgress: number;
  upcomingBirthdays: number;
  pendingDebts: number;
  overdueDebts: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<any>(null);

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
    queryKey: [`/api/upcoming-birthdays`, user?.id, user?.role],
    queryFn: async () => {
      // Admin vê todos, outros usuários só veem os seus
      const url =
        user?.role === "admin" || user?.role === "administrador"
          ? `/api/upcoming-birthdays`
          : `/api/upcoming-birthdays?responsibleId=${user?.id}`;

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
          Math.ceil(diffTime / (1000 * 60 * 60 * 24))
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
    if (status === "paid") return "bg-green-100 text-green-800";
    if (status === "overdue" || new Date(dueDate) < new Date())
      return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
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
    (debt) => debt.status === "pending" && new Date(debt.dueDate) < new Date()
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b mb-6 border-gray-200 px-6 py-4 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <TrendingUp className="size-6 shrink-0 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-600 mt-1">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Meus Clientes
                </CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {stats?.totalClients || 0}
                </div>
                <p className="text-sm text-gray-600 font-medium">
                  Clientes sob sua responsabilidade
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Negócios Ativos
                </CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {stats?.activeDeals || 0}
                </div>
                <p className="text-sm text-gray-600 font-medium">
                  Oportunidades em andamento
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-yellow-50 to-amber-50 border-l-4 border-l-yellow-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Dívidas Pendentes
                </CardTitle>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-yellow-600" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl font-bold text-yellow-700">
                    {pendingDebts.length}
                  </div>
                  {pendingDebts.length > 0 && (
                    <div className="flex items-center gap-1 bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      <Clock className="h-3 w-3" />
                      Ativa
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 font-medium">
                  Cobranças a realizar
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-red-50 to-rose-50 border-l-4 border-l-red-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Dívidas Vencidas
                </CardTitle>
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl font-bold text-red-700">
                    {overdueDebts.length}
                  </div>
                  {overdueDebts.length > 0 && (
                    <div className="flex items-center gap-1 bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
                      <AlertTriangle className="h-3 w-3" />
                      Urgente
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 font-medium">
                  Requer atenção urgente
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs com conteúdo */}
          <Tabs defaultValue="debts" className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow-md">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-1 rounded-lg">
                <TabsTrigger
                  value="debts"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200 
                           data-[state=active]:bg-white data-[state=active]:text-red-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-red-200
                           hover:bg-gray-100 hover:text-gray-800 text-gray-600 border border-transparent"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className="truncate">Dívidas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="birthdays"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                           data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200
                           hover:bg-gray-100 hover:text-gray-800 text-gray-600 border border-transparent"
                >
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="truncate">Aniversários</span>
                </TabsTrigger>
                <TabsTrigger
                  value="events"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                           data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200
                           hover:bg-gray-100 hover:text-gray-800 text-gray-600 border border-transparent"
                >
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="truncate">Eventos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="summary"
                  className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                           data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-green-200
                           hover:bg-gray-100 hover:text-gray-800 text-gray-600 border border-transparent"
                >
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  <span className="truncate">Resumo</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="debts"
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <Card className="shadow-none border-0 bg-transparent">
                <CardHeader className="pb-6 px-6 pt-6">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <CreditCard className="h-5 w-5 text-red-600 shrink-0" />
                    </div>
                    <span className="truncate">
                      Dívidas Pendentes dos Clientes
                    </span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 mt-2">
                    Dívidas que ainda não foram quitadas e requerem
                    acompanhamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  {pendingDebts.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <div className="bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Nenhuma dívida pendente
                      </h3>
                      <p className="text-gray-500">
                        Todas as cobranças estão em dia!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingDebts.map((debt) => (
                        <div
                          key={debt.id}
                          className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white border border-gray-200 rounded-md hover:border-gray-300 hover:shadow-md transition-all duration-200 ease-in-out"
                        >
                          {/* Indicador de status lateral */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                              new Date(debt.dueDate) < new Date()
                                ? "bg-red-500"
                                : "bg-yellow-400"
                            }`}
                          />

                          <div className="flex-1 min-w-0 w-full sm:w-auto pl-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                              <h3 className="font-semibold text-lg text-gray-900 truncate">
                                {debt.client.name}
                              </h3>
                              <Badge
                                className={`${getDebtStatusColor(
                                  debt.status,
                                  debt.dueDate
                                )} w-fit shrink-0 font-medium px-3 py-1 text-xs border-0`}
                              >
                                {getDebtStatusText(debt.status, debt.dueDate)}
                              </Badge>
                            </div>

                            <p className="text-sm text-gray-700 mb-3 overflow-hidden text-ellipsis leading-relaxed">
                              {debt.description}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
                                  <span className="font-medium text-gray-900">
                                    {formatCurrency(parseFloat(debt.amount))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                                  <span className="text-gray-600">
                                    {formatDate(debt.dueDate)}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {debt.client.responsibleName && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-purple-600 shrink-0" />
                                    <span className="text-gray-600 truncate">
                                      {debt.client.responsibleName}
                                    </span>
                                  </div>
                                )}
                                {new Date(debt.dueDate) < new Date() && (
                                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-2 py-1 rounded-md">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-medium">
                                      {getOverdueDays(debt.dueDate)} dias em
                                      atraso
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 xs:flex-none hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
                              onClick={() =>
                                window.open(`tel:${debt.client.phone}`, "_self")
                              }
                              title="Ligar para cliente"
                            >
                              <Phone className="h-4 w-4" />
                              <span className="ml-2 xs:hidden">Ligar</span>
                            </Button>
                            {debt.client.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 xs:flex-none hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                                onClick={() =>
                                  window.open(
                                    `mailto:${debt.client.email}`,
                                    "_blank"
                                  )
                                }
                                title="Enviar email"
                              >
                                <Mail className="h-4 w-4" />
                                <span className="ml-2 xs:hidden">Email</span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 xs:flex-none hover:bg-gray-50 hover:border-gray-300 transition-colors"
                              onClick={() => setSelectedClient(debt.client)}
                            >
                              <User className="h-4 w-4 xs:mr-2" />
                              <span className="ml-2 xs:ml-0 truncate">
                                Ver Cliente
                              </span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="birthdays"
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <Card className="shadow-none border-0 bg-transparent">
                <CardHeader className="pb-6 px-6 pt-6">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
                    </div>
                    <span className="truncate">Próximos Aniversários</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 mt-2">
                    Os próximos 15 aniversariantes para manter relacionamento
                    próximo
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  {upcomingBirthdays.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <div className="bg-blue-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Calendar className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Nenhum aniversário próximo
                      </h3>
                      <p className="text-gray-500">
                        Nenhum cliente fará aniversário nos próximos dias
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingBirthdays.map((client: any) => (
                        <div
                          key={client.id}
                          className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white border border-gray-200 rounded-md hover:border-gray-300 hover:shadow-md transition-all duration-200 ease-in-out"
                        >
                          {/* Indicador de urgência lateral */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                              client.daysUntil === 0
                                ? "bg-green-500"
                                : client.daysUntil <= 3
                                ? "bg-yellow-400"
                                : "bg-blue-400"
                            }`}
                          />

                          <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto pl-2">
                            <div
                              className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                                client.daysUntil === 0
                                  ? "bg-green-100"
                                  : client.daysUntil <= 3
                                  ? "bg-yellow-100"
                                  : "bg-blue-100"
                              }`}
                            >
                              <Calendar
                                className={`h-6 w-6 ${
                                  client.daysUntil === 0
                                    ? "text-green-600"
                                    : client.daysUntil <= 3
                                    ? "text-yellow-600"
                                    : "text-blue-600"
                                }`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-lg text-gray-900 truncate mb-2">
                                {client.name}
                              </h3>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                                  <span className="text-sm text-gray-700 font-medium">
                                    {client.daysUntil === 0
                                      ? "🎉 Aniversário hoje!"
                                      : client.daysUntil === 1
                                      ? "🎂 Aniversário amanhã"
                                      : `🗓️ Em ${client.daysUntil} dias`}
                                  </span>
                                </div>
                                <Badge
                                  className={`w-fit shrink-0 font-medium px-3 py-1 text-xs border-0 ${
                                    client.daysUntil === 0
                                      ? "bg-green-100 text-green-800"
                                      : client.daysUntil <= 3
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {client.daysUntil === 0
                                    ? "Hoje"
                                    : client.daysUntil === 1
                                    ? "1 dia"
                                    : `${client.daysUntil} dias`}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 xs:flex-none hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
                              onClick={() =>
                                window.open(`tel:${client.phone}`, "_self")
                              }
                              title="Ligar para cliente"
                            >
                              <Phone className="h-4 w-4" />
                              <span className="ml-2 xs:hidden">Ligar</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 xs:flex-none hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                              onClick={() => setSelectedClient(client)}
                            >
                              <User className="h-4 w-4 xs:mr-2" />
                              <span className="ml-2 xs:ml-0 truncate">
                                Ver Cliente
                              </span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <EventsDashboard />
            </TabsContent>

            <TabsContent
              value="summary"
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <Card className="shadow-none border-0 bg-transparent">
                <CardHeader className="pb-6 px-6 pt-6">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600 shrink-0" />
                    </div>
                    <span className="truncate">Resumo Executivo</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 mt-2">
                    Visão geral financeira e ações prioritárias para o negócio
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card de Resumo Financeiro */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <DollarSign className="h-5 w-5 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Resumo Financeiro
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              Total em dívidas:
                            </span>
                          </div>
                          <span className="font-bold text-lg text-gray-900">
                            {formatCurrency(
                              clientDebts.reduce(
                                (sum, debt) => sum + parseFloat(debt.amount),
                                0
                              )
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            </div>
                            <span className="text-sm font-medium text-red-700">
                              Dívidas vencidas:
                            </span>
                          </div>
                          <span className="font-bold text-lg text-red-700">
                            {formatCurrency(
                              overdueDebts.reduce(
                                (sum, debt) => sum + parseFloat(debt.amount),
                                0
                              )
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                              <Clock className="h-4 w-4 text-yellow-600" />
                            </div>
                            <span className="text-sm font-medium text-yellow-700">
                              Dívidas pendentes:
                            </span>
                          </div>
                          <span className="font-bold text-lg text-yellow-700">
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
                    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-orange-50 rounded-lg">
                          <Target className="h-5 w-5 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Ações Prioritárias
                        </h3>
                      </div>

                      <div className="space-y-4">
                        {overdueDebts.length > 0 && (
                          <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                            <div className="p-2 bg-red-100 rounded-lg shrink-0">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-red-800 mb-1">
                                Atenção Urgente
                              </div>
                              <p className="text-sm text-red-700">
                                {overdueDebts.length} dívida(s) vencida(s)
                                requer(em) cobrança imediata
                              </p>
                            </div>
                            <Badge className="bg-red-100 text-red-800 border-0 shrink-0">
                              {overdueDebts.length}
                            </Badge>
                          </div>
                        )}

                        {upcomingBirthdays.length > 0 && (
                          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                              <Calendar className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-blue-800 mb-1">
                                Oportunidade de Relacionamento
                              </div>
                              <p className="text-sm text-blue-700">
                                {upcomingBirthdays.length} aniversário(s) se
                                aproximando para fortalecer vínculos
                              </p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800 border-0 shrink-0">
                              {upcomingBirthdays.length}
                            </Badge>
                          </div>
                        )}

                        {pendingDebts.length > 0 && (
                          <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="p-2 bg-yellow-100 rounded-lg shrink-0">
                              <Clock className="h-4 w-4 text-yellow-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-yellow-800 mb-1">
                                Acompanhamento Necessário
                              </div>
                              <p className="text-sm text-yellow-700">
                                {pendingDebts.length} dívida(s) pendente(s) para
                                monitoramento
                              </p>
                            </div>
                            <Badge className="bg-yellow-100 text-yellow-800 border-0 shrink-0">
                              {pendingDebts.length}
                            </Badge>
                          </div>
                        )}

                        {overdueDebts.length === 0 &&
                          upcomingBirthdays.length === 0 &&
                          pendingDebts.length === 0 && (
                            <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="p-2 bg-green-100 rounded-lg shrink-0">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-green-800 mb-1">
                                  Excelente Trabalho!
                                </div>
                                <p className="text-sm text-green-700">
                                  Todas as atividades estão em dia. Continue o
                                  ótimo trabalho!
                                </p>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ClientDetailsCard
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      />
    </div>
  );
}
