import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Target,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  Trophy,
  Medal,
  Award,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Sidebar from "@/components/sidebar";
import { useAuth } from "@/hooks/useAuth";

interface WeeklyResult {
  id: string;
  goalId: string;
  week: number;
  salesAchieved: string;
  ticketAchieved: string;
  itemsAchieved: number;
  createdAt: string;
  updatedAt: string;
}

interface UserGoal {
  id: string;
  userId: string;
  salesGoal: string;
  averageTicket: string;
  itemsPerSale: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  weeklyResults: WeeklyResult[];
}

interface UserRegistrationStats {
  userId: string;
  userName: string;
  userEmail: string;
  registrationCount: number;
}

interface TelemarketingGoal {
  id: string;
  userId: string;
  targetResult: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface TelemarketingStats {
  userId: string;
  userName: string;
  userEmail: string;
  "COM SUCESSO": number;
  "NÃO ATENDIDA": number;
  "SEM INTERESSE": number;
  "NÃO LIGAR MAIS": number;
  "EM OCUPADO": number;
  OUTROS: number;
  total: number;
}

interface ClientRegistrationGoal {
  id: string;
  userId: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientRegistrationStats {
  userId: string;
  userName: string;
  userEmail: string;
  totalRegistrations: number;
}

interface MarkerGoal {
  id: string;
  userId: string;
  markerName: string;
  targetQuantity: number;
  month: number;
  year: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface MarkerStats {
  markerName: string;
  totalClients: number;
  userId: string;
  userName: string;
  userEmail: string;
}

export default function Metas() {
  const { user } = useAuth();

  // Estado para controlar mês/ano - iniciando com a data atual
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Buscar metas do mês/ano selecionado
  const { data: userGoals = [], isLoading } = useQuery<UserGoal[]>({
    queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
  });

  // Buscar estatísticas de cadastros dos usuários
  const { data: registrationStats = [] } = useQuery<UserRegistrationStats[]>({
    queryKey: ["/api/user-registration-stats"],
  });

  // Buscar metas de telemarketing
  const { data: telemarketingGoals = [] } = useQuery<TelemarketingGoal[]>({
    queryKey: [`/api/telemarketing-goals/${selectedMonth}/${selectedYear}`],
  });

  // Buscar estatísticas de telemarketing
  const { data: telemarketingStats = [] } = useQuery<TelemarketingStats[]>({
    queryKey: [`/api/telemarketing-stats/${selectedMonth}/${selectedYear}`],
  });

  // Buscar metas de cadastros
  const { data: clientRegistrationGoals = [] } = useQuery<
    ClientRegistrationGoal[]
  >({
    queryKey: [
      `/api/client-registration-goals/${selectedMonth}/${selectedYear}`,
    ],
  });

  // Buscar estatísticas de cadastros
  const { data: clientRegistrationStats = [] } = useQuery<
    ClientRegistrationStats[]
  >({
    queryKey: [
      `/api/client-registration-stats/${selectedMonth}/${selectedYear}`,
    ],
  });

  // Buscar metas de marcadores
  const { data: markerGoals = [] } = useQuery<MarkerGoal[]>({
    queryKey: [`/api/marker-goals/${selectedMonth}/${selectedYear}`],
  });

  // Buscar estatísticas de marcadores
  const { data: markerStats = [] } = useQuery<MarkerStats[]>({
    queryKey: [`/api/marker-stats/${selectedMonth}/${selectedYear}`],
  });

  // Função para calcular percentual atingido
  const calculatePercentage = (achieved: number, goal: number) => {
    if (goal === 0) return 0;
    return Math.min((achieved / goal) * 100, 100);
  };

  // Função para somar resultados semanais
  const getTotalAchieved = (
    weeklyResults: WeeklyResult[],
    field: "salesAchieved" | "ticketAchieved" | "itemsAchieved",
  ) => {
    if (!weeklyResults || !Array.isArray(weeklyResults)) {
      return 0;
    }
    return weeklyResults.reduce((sum, result) => {
      if (field === "itemsAchieved") {
        return sum + result[field];
      }
      return sum + Number(result[field]);
    }, 0);
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));
  };

  // Filtrar metas do usuário logado ou mostrar todas se for admin/gerente
  const filteredGoals =
    user?.role === "admin" || user?.role === "gerente"
      ? userGoals
      : userGoals.filter((goal) => goal.userId === user?.id);

  // Filtrar metas de telemarketing do usuário logado ou mostrar todas se for admin/gerente
  const filteredTelemarketingGoals =
    user?.role === "admin" || user?.role === "gerente"
      ? telemarketingGoals
      : telemarketingGoals.filter((goal) => goal.userId === user?.id);

  // Filtrar metas de cadastros do usuário logado ou mostrar todas se for admin/gerente
  const filteredClientRegistrationGoals =
    user?.role === "admin" || user?.role === "gerente"
      ? clientRegistrationGoals
      : clientRegistrationGoals.filter((goal) => goal.userId === user?.id);

  // Filtrar metas de marcadores do usuário logado ou mostrar todas se for admin/gerente
  const filteredMarkerGoals =
    user?.role === "admin" || user?.role === "gerente"
      ? markerGoals
      : markerGoals.filter((goal) => goal.userId === user?.id);

  // Função auxiliar para garantir weeklyResults sempre é um array
  const getWeeklyResults = (goal: UserGoal) => {
    return goal.weeklyResults && Array.isArray(goal.weeklyResults)
      ? goal.weeklyResults
      : [];
  };

  return (
    <div className="flex">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto space-y-6">
          <div className="flex items-center flex-col sm:flex-row gap-4 justify-between mb-6">
            <div className="flex items-start gap-2">
              <Target className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Análise de Metas
                </h1>
                <p className="text-gray-600 text-sm">
                  Acompanhe o progresso das metas de vendas em{" "}
                  {format(
                    new Date(selectedYear, selectedMonth - 1),
                    "MMMM 'de' yyyy",
                    { locale: ptBR },
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="month-select">Mês:</Label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString("pt-BR", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="year-select">Ano:</Label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Nota informativa para vendedores */}
          {user?.role === "vendedor" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <p className="text-blue-800 font-medium">
                  Os resultados semanais são cadastrados pelos gerentes e
                  administradores do sistema.
                </p>
              </div>
            </div>
          )}

          {/* Cards de Metas por Usuário */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Carregando metas...</div>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                Nenhuma meta encontrada para este período
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGoals.map((goal) => {
                  const weeklyResults = getWeeklyResults(goal);
                  const totalSalesAchieved = getTotalAchieved(
                    weeklyResults,
                    "salesAchieved",
                  );
                  const totalItemsAchieved = getTotalAchieved(
                    weeklyResults,
                    "itemsAchieved",
                  );
                  const avgTicketAchieved =
                    weeklyResults.length > 0
                      ? getTotalAchieved(weeklyResults, "ticketAchieved") /
                        weeklyResults.length
                      : 0;

                  const salesPercentage = calculatePercentage(
                    totalSalesAchieved,
                    Number(goal.salesGoal),
                  );
                  const ticketPercentage = calculatePercentage(
                    avgTicketAchieved,
                    Number(goal.averageTicket),
                  );
                  const itemsPercentage = calculatePercentage(
                    totalItemsAchieved,
                    goal.itemsPerSale,
                  );

                  return (
                    <Card key={goal.id} className="relative">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {goal.userName}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {weeklyResults.length}/4 semanas
                          </Badge>
                        </div>
                        <CardDescription>{goal.userEmail}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Meta de Vendas */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Vendas</span>
                            <span className="text-sm text-gray-500">
                              {salesPercentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-green-600 h-3 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(salesPercentage, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>
                              Alcançado: {formatCurrency(totalSalesAchieved)}
                            </span>
                            <span>Meta: {formatCurrency(goal.salesGoal)}</span>
                          </div>
                        </div>

                        {/* Meta de Ticket Médio */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              Ticket Médio
                            </span>
                            <span className="text-sm text-gray-500">
                              {ticketPercentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(ticketPercentage, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>
                              Alcançado: {formatCurrency(avgTicketAchieved)}
                            </span>
                            <span>
                              Meta: {formatCurrency(goal.averageTicket)}
                            </span>
                          </div>
                        </div>

                        {/* Meta de Itens por Venda */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              Itens Vendidos
                            </span>
                            <span className="text-sm text-gray-500">
                              {itemsPercentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(itemsPercentage, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>Alcançado: {totalItemsAchieved} itens</span>
                            <span>Meta: {goal.itemsPerSale} itens</span>
                          </div>
                        </div>

                        {/* Resumo das Semanas */}
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs text-gray-500 mb-2">
                            Resultados por semana:
                          </p>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((week) => {
                              const weekResult = weeklyResults.find(
                                (r) => r.week === week,
                              );
                              return (
                                <div
                                  key={week}
                                  className={`text-center p-1 rounded text-xs ${
                                    weekResult
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  S{week}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Seção de Metas de Telemarketing */}
              {filteredTelemarketingGoals.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Phone className="h-8 w-8 text-purple-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Metas de Ligação
                      </h2>
                      <p className="text-gray-600">
                        Acompanhe as metas de ligação em{" "}
                        {format(
                          new Date(selectedYear, selectedMonth - 1),
                          "MMMM 'de' yyyy",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTelemarketingGoals.map((goal) => {
                      // Buscar estatísticas do usuário
                      const userStats = telemarketingStats.find(
                        (stat) => stat.userId === goal.userId,
                      );
                      const achieved = userStats
                        ? userStats[
                            goal.targetResult as keyof TelemarketingStats
                          ] || 0
                        : 0;
                      const percentage =
                        goal.targetQuantity > 0
                          ? calculatePercentage(
                              Number(achieved),
                              goal.targetQuantity,
                            )
                          : 0;

                      return (
                        <Card
                          key={goal.id}
                          className="relative border-purple-200 hover:shadow-lg transition-shadow"
                        >
                          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg text-purple-900">
                                {goal.userName}
                              </CardTitle>
                              <Badge
                                variant="outline"
                                className="bg-white border-purple-300 text-purple-700"
                              >
                                <Phone className="h-3 w-3 mr-1" />
                                Ligação
                              </Badge>
                            </div>
                            <CardDescription className="text-purple-700">
                              {goal.userEmail}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-6">
                            {/* Progresso da Meta */}
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-purple-900">
                                    {goal.targetResult}
                                  </span>
                                  <span className="text-sm text-purple-600">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(percentage, 100)}%`,
                                    }}
                                  ></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600 mt-1">
                                  <span>Realizado: {achieved} chamadas</span>
                                  <span>
                                    Meta: {goal.targetQuantity} chamadas
                                  </span>
                                </div>
                              </div>

                              {/* Resumo das Estatísticas */}
                              {userStats && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-xs text-gray-500 mb-2">
                                    Estatísticas do mês:
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex justify-between">
                                      <span>Total:</span>
                                      <span className="font-medium">
                                        {userStats.total}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Sucesso:</span>
                                      <span className="font-medium text-green-600">
                                        {userStats["COM SUCESSO"]}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Não Atendida:</span>
                                      <span className="font-medium text-yellow-600">
                                        {userStats["NÃO ATENDIDA"]}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Sem Interesse:</span>
                                      <span className="font-medium text-red-600">
                                        {userStats["SEM INTERESSE"]}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Informações da Meta */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    Período:
                                  </span>
                                  <span className="font-medium">
                                    {new Date(
                                      0,
                                      goal.month - 1,
                                    ).toLocaleDateString("pt-BR", {
                                      month: "long",
                                    })}{" "}
                                    {goal.year}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Foco:</span>
                                  <span className="font-medium">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs ${
                                        goal.targetResult === "COM SUCESSO"
                                          ? "bg-green-100 text-green-800"
                                          : goal.targetResult === "NÃO ATENDIDA"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : goal.targetResult ===
                                                "SEM INTERESSE"
                                              ? "bg-red-100 text-red-800"
                                              : goal.targetResult ===
                                                  "NÃO LIGAR MAIS"
                                                ? "bg-red-100 text-red-800"
                                                : goal.targetResult ===
                                                    "EM OCUPADO"
                                                  ? "bg-orange-100 text-orange-800"
                                                  : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {goal.targetResult}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção de Metas de Cadastros de Clientes */}
              {filteredClientRegistrationGoals.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Users className="h-8 w-8 text-emerald-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Metas de Cadastros de Clientes
                      </h2>
                      <p className="text-gray-600">
                        Acompanhe as metas de cadastros em{" "}
                        {format(
                          new Date(selectedYear, selectedMonth - 1),
                          "MMMM 'de' yyyy",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClientRegistrationGoals.map((goal) => {
                      // Buscar estatísticas do usuário
                      const userStats = clientRegistrationStats.find(
                        (stat) => stat.userId === goal.userId,
                      );
                      const achieved = userStats
                        ? userStats.totalRegistrations
                        : 0;
                      const percentage =
                        goal.targetQuantity > 0
                          ? calculatePercentage(achieved, goal.targetQuantity)
                          : 0;

                      return (
                        <Card
                          key={goal.id}
                          className="relative border-emerald-200 hover:shadow-lg transition-shadow"
                        >
                          <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg text-emerald-900">
                                {goal.userName}
                              </CardTitle>
                              <Badge
                                variant="outline"
                                className="bg-white border-emerald-300 text-emerald-700"
                              >
                                <Users className="h-3 w-3 mr-1" />
                                Cadastros
                              </Badge>
                            </div>
                            <CardDescription className="text-emerald-700">
                              {goal.userEmail}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-6">
                            {/* Progresso da Meta */}
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-emerald-900">
                                    Clientes Cadastrados
                                  </span>
                                  <span className="text-sm text-emerald-600">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(percentage, 100)}%`,
                                    }}
                                  ></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600 mt-1">
                                  <span>Realizado: {achieved} clientes</span>
                                  <span>
                                    Meta: {goal.targetQuantity} clientes
                                  </span>
                                </div>
                              </div>

                              {/* Status da Meta */}
                              <div className="mt-4 pt-4 border-t">
                                <div className="flex items-center justify-center">
                                  {percentage >= 100 ? (
                                    <div className="flex items-center gap-2 text-emerald-600">
                                      <Trophy className="h-5 w-5" />
                                      <span className="font-medium">
                                        Meta Atingida!
                                      </span>
                                    </div>
                                  ) : percentage >= 75 ? (
                                    <div className="flex items-center gap-2 text-yellow-600">
                                      <TrendingUp className="h-5 w-5" />
                                      <span className="font-medium">
                                        Quase lá!
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-blue-600">
                                      <Target className="h-5 w-5" />
                                      <span className="font-medium">
                                        Em progresso
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Informações da Meta */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    Período:
                                  </span>
                                  <span className="font-medium">
                                    {new Date(
                                      0,
                                      goal.month - 1,
                                    ).toLocaleDateString("pt-BR", {
                                      month: "long",
                                    })}{" "}
                                    {goal.year}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Restam:</span>
                                  <span className="font-medium">
                                    {Math.max(
                                      0,
                                      goal.targetQuantity - achieved,
                                    )}{" "}
                                    clientes
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção de Metas de Marcadores */}
              {filteredMarkerGoals.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className="h-8 w-8 text-orange-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Metas de Marcadores
                      </h2>
                      <p className="text-gray-600">
                        Acompanhe as metas por marcadores em{" "}
                        {format(
                          new Date(selectedYear, selectedMonth - 1),
                          "MMMM 'de' yyyy",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMarkerGoals.map((goal) => {
                      // Buscar estatísticas do marcador para o usuário
                      const userMarkerStats = markerStats.find(
                        (stat) => stat.userId === goal.userId && stat.markerName === goal.markerName
                      );
                      const achieved = userMarkerStats
                        ? userMarkerStats.totalClients
                        : 0;
                      const percentage =
                        goal.targetQuantity > 0
                          ? calculatePercentage(achieved, goal.targetQuantity)
                          : 0;

                      return (
                        <Card
                          key={goal.id}
                          className="relative border-orange-200 hover:shadow-lg transition-shadow"
                        >
                          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg text-orange-900">
                                {goal.userName}
                              </CardTitle>
                              <Badge
                                variant="outline"
                                className="bg-white border-orange-300 text-orange-700"
                              >
                                <Badge className="h-3 w-3 mr-1" />
                                {goal.markerName}
                              </Badge>
                            </div>
                            <CardDescription className="text-orange-700">
                              {goal.userEmail}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-6">
                            {/* Progresso da Meta */}
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-orange-900">
                                    Clientes com "{goal.markerName}"
                                  </span>
                                  <span className="text-sm text-orange-600">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className="bg-orange-600 h-3 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(percentage, 100)}%`,
                                    }}
                                  ></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600 mt-1">
                                  <span>Alcançado: {achieved} clientes</span>
                                  <span>
                                    Meta: {goal.targetQuantity} clientes
                                  </span>
                                </div>
                              </div>

                              {/* Status da Meta */}
                              <div className="mt-4 pt-4 border-t">
                                <div className="flex items-center justify-center">
                                  {percentage >= 100 ? (
                                    <div className="flex items-center gap-2 text-orange-600">
                                      <Trophy className="h-5 w-5" />
                                      <span className="font-medium">
                                        Meta Atingida!
                                      </span>
                                    </div>
                                  ) : percentage >= 75 ? (
                                    <div className="flex items-center gap-2 text-yellow-600">
                                      <TrendingUp className="h-5 w-5" />
                                      <span className="font-medium">
                                        Quase lá!
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-blue-600">
                                      <Target className="h-5 w-5" />
                                      <span className="font-medium">
                                        Em progresso
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Informações da Meta */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    Período:
                                  </span>
                                  <span className="font-medium">
                                    {new Date(
                                      0,
                                      goal.month - 1,
                                    ).toLocaleDateString("pt-BR", {
                                      month: "long",
                                    })}{" "}
                                    {goal.year}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Restam:</span>
                                  <span className="font-medium">
                                    {Math.max(
                                      0,
                                      goal.targetQuantity - achieved,
                                    )}{" "}
                                    clientes
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {registrationStats.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Trophy className="h-8 w-8 text-yellow-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Ranking de Cadastros
                      </h2>
                      <p className="text-gray-600">
                        Usuários com mais clientes cadastrados no sistema
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {registrationStats.slice(0, 10).map((stat, index) => {
                      let rankIcon;
                      let rankColor;

                      if (index === 0) {
                        rankIcon = (
                          <Trophy className="h-6 w-6 text-yellow-500" />
                        );
                        rankColor =
                          "bg-gradient-to-r from-yellow-400 to-yellow-600";
                      } else if (index === 1) {
                        rankIcon = <Medal className="h-6 w-6 text-gray-400" />;
                        rankColor =
                          "bg-gradient-to-r from-gray-300 to-gray-500";
                      } else if (index === 2) {
                        rankIcon = <Award className="h-6 w-6 text-amber-600" />;
                        rankColor =
                          "bg-gradient-to-r from-amber-400 to-amber-600";
                      } else {
                        rankIcon = (
                          <span className="text-lg font-bold text-gray-600">
                            #{index + 1}
                          </span>
                        );
                        rankColor =
                          "bg-gradient-to-r from-blue-500 to-blue-600";
                      }

                      return (
                        <Card
                          key={stat.userId}
                          className="relative overflow-hidden"
                        >
                          <div className={`h-2 ${rankColor}`}></div>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {rankIcon}
                                <div>
                                  <CardTitle className="text-lg">
                                    {stat.userName}
                                  </CardTitle>
                                  <CardDescription className="text-sm max-w-[164px] sm:max-w-full sm:text-normal overflow-hidden text-ellipsis">
                                    {stat.userEmail}
                                  </CardDescription>
                                </div>
                              </div>
                              {/* <Badge
                                variant="secondary"
                                className="text-lg font-bold"
                              >
                                {stat.registrationCount}
                              </Badge> */}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                Clientes cadastrados
                              </span>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-600" />
                                <span className="text-2xl font-bold text-blue-600">
                                  {stat.registrationCount}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}