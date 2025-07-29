import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Target, Users, TrendingUp, Calendar, BarChart3, Trophy, Medal, Award } from "lucide-react";
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

export default function Metas() {
  const { user } = useAuth();

  // Estado para controlar mês/ano atual
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

  // Função para calcular percentual atingido
  const calculatePercentage = (achieved: number, goal: number) => {
    if (goal === 0) return 0;
    return Math.min((achieved / goal) * 100, 100);
  };

  // Função para somar resultados semanais
  const getTotalAchieved = (weeklyResults: WeeklyResult[], field: 'salesAchieved' | 'ticketAchieved' | 'itemsAchieved') => {
    return weeklyResults.reduce((sum, result) => {
      if (field === 'itemsAchieved') {
        return sum + result[field];
      }
      return sum + Number(result[field]);
    }, 0);
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value));
  };

  // Filtrar metas do usuário logado ou mostrar todas se for admin/gerente
  const filteredGoals = user?.role === "admin" || user?.role === "gerente" 
    ? userGoals 
    : userGoals.filter(goal => goal.userId === user?.id);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab="metas" onTabChange={() => {}} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Análise de Metas</h1>
                <p className="text-gray-600">
                  Acompanhe o progresso das metas de vendas em {format(new Date(selectedYear, selectedMonth - 1), "MMMM 'de' yyyy", { locale: ptBR })}
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
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(0, month - 1).toLocaleDateString('pt-BR', { month: 'long' })}
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
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(year => (
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
                  Os resultados semanais são cadastrados pelos gerentes e administradores do sistema.
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
              <p className="text-gray-500 mb-4">Nenhuma meta encontrada para este período</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGoals.map((goal) => {
                const totalSalesAchieved = getTotalAchieved(goal.weeklyResults, 'salesAchieved');
                const totalItemsAchieved = getTotalAchieved(goal.weeklyResults, 'itemsAchieved');
                const avgTicketAchieved = goal.weeklyResults.length > 0 
                  ? getTotalAchieved(goal.weeklyResults, 'ticketAchieved') / goal.weeklyResults.length 
                  : 0;

                const salesPercentage = calculatePercentage(totalSalesAchieved, Number(goal.salesGoal));
                const ticketPercentage = calculatePercentage(avgTicketAchieved, Number(goal.averageTicket));
                const itemsPercentage = calculatePercentage(totalItemsAchieved, goal.itemsPerSale);

                return (
                  <Card key={goal.id} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{goal.userName}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {goal.weeklyResults.length}/4 semanas
                        </Badge>
                      </div>
                      <CardDescription>{goal.userEmail}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Meta de Vendas */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Vendas</span>
                          <span className="text-sm text-gray-500">{salesPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-green-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(salesPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{formatCurrency(totalSalesAchieved)}</span>
                          <span>{formatCurrency(goal.salesGoal)}</span>
                        </div>
                      </div>

                      {/* Meta de Ticket Médio */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Ticket Médio</span>
                          <span className="text-sm text-gray-500">{ticketPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(ticketPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{formatCurrency(avgTicketAchieved)}</span>
                          <span>{formatCurrency(goal.averageTicket)}</span>
                        </div>
                      </div>

                      {/* Meta de Itens por Venda */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Itens Vendidos</span>
                          <span className="text-sm text-gray-500">{itemsPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(itemsPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{totalItemsAchieved} itens</span>
                          <span>{goal.itemsPerSale} itens</span>
                        </div>
                      </div>

                      {/* Resumo das Semanas */}
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500 mb-2">Resultados por semana:</p>
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map(week => {
                            const weekResult = goal.weeklyResults.find(r => r.week === week);
                            return (
                              <div 
                                key={week} 
                                className={`text-center p-1 rounded text-xs ${
                                  weekResult ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
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

            {/* Ranking de Cadastros */}
            {registrationStats.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="h-8 w-8 text-yellow-600" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Ranking de Cadastros</h2>
                    <p className="text-gray-600">Usuários com mais clientes cadastrados no sistema</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {registrationStats.slice(0, 10).map((stat, index) => {
                    let rankIcon;
                    let rankColor;
                    
                    if (index === 0) {
                      rankIcon = <Trophy className="h-6 w-6 text-yellow-500" />;
                      rankColor = "bg-gradient-to-r from-yellow-400 to-yellow-600";
                    } else if (index === 1) {
                      rankIcon = <Medal className="h-6 w-6 text-gray-400" />;
                      rankColor = "bg-gradient-to-r from-gray-300 to-gray-500";
                    } else if (index === 2) {
                      rankIcon = <Award className="h-6 w-6 text-amber-600" />;
                      rankColor = "bg-gradient-to-r from-amber-400 to-amber-600";
                    } else {
                      rankIcon = <span className="text-lg font-bold text-gray-600">#{index + 1}</span>;
                      rankColor = "bg-gradient-to-r from-blue-500 to-blue-600";
                    }

                    return (
                      <Card key={stat.userId} className="relative overflow-hidden">
                        <div className={`h-2 ${rankColor}`}></div>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {rankIcon}
                              <div>
                                <CardTitle className="text-lg">{stat.userName}</CardTitle>
                                <CardDescription className="text-sm">{stat.userEmail}</CardDescription>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-lg font-bold">
                              {stat.registrationCount}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Clientes cadastrados</span>
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
          )}
        </div>
      </div>
    </div>
  );
}