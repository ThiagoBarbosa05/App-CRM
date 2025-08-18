
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle
} from "lucide-react";
import ClientDetailsCard from "@/components/client-details-card";

interface ClientDebt {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email?: string;
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
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    enabled: !!user,
  });

  // Buscar dívidas dos clientes do vendedor
  const { data: clientDebts = [] } = useQuery<ClientDebt[]>({
    queryKey: [`/api/client-debts`, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/client-debts?responsibleId=${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch client debts');
      return response.json();
    },
    enabled: !!user,
  });

  // Buscar próximos aniversários
  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: [`/api/upcoming-birthdays`, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/upcoming-birthdays?responsibleId=${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch birthdays');
      return response.json();
    },
    enabled: !!user,
  });

  const getDebtStatusColor = (status: string, dueDate: string) => {
    if (status === "paid") return "bg-green-100 text-green-800";
    if (status === "overdue" || new Date(dueDate) < new Date()) return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  const getDebtStatusText = (status: string, dueDate: string) => {
    if (status === "paid") return "Pago";
    if (status === "overdue" || new Date(dueDate) < new Date()) return "Vencida";
    return "Pendente";
  };

  const pendingDebts = clientDebts.filter(debt => debt.status === "pending");
  const overdueDebts = clientDebts.filter(debt => 
    debt.status === "pending" && new Date(debt.dueDate) < new Date()
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Visão geral das suas atividades</p>
            </div>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meus Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Clientes sob sua responsabilidade
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Negócios Ativos</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeDeals || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Oportunidades em andamento
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dívidas Pendentes</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{pendingDebts.length}</div>
                <p className="text-xs text-muted-foreground">
                  Cobranças a realizar
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dívidas Vencidas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{overdueDebts.length}</div>
                <p className="text-xs text-muted-foreground">
                  Requer atenção urgente
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs com conteúdo */}
          <Tabs defaultValue="debts" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="debts" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Dívidas
              </TabsTrigger>
              <TabsTrigger value="birthdays" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Aniversários
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Resumo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="debts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Dívidas Pendentes dos Clientes
                  </CardTitle>
                  <CardDescription>
                    Dívidas que ainda não foram quitadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingDebts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma dívida pendente</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingDebts.map((debt) => (
                        <div
                          key={debt.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium">{debt.client.name}</h3>
                              <Badge className={getDebtStatusColor(debt.status, debt.dueDate)}>
                                {getDebtStatusText(debt.status, debt.dueDate)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{debt.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Valor: {formatCurrency(parseFloat(debt.amount))}</span>
                              <span>Vencimento: {formatDate(debt.dueDate)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`tel:${debt.client.phone}`, '_self')}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            {debt.client.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`mailto:${debt.client.email}`, '_blank')}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedClient(debt.client)}
                            >
                              Ver Cliente
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="birthdays" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Próximos Aniversários
                  </CardTitle>
                  <CardDescription>
                    Clientes que fazem aniversário nos próximos 30 dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingBirthdays.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum aniversário nos próximos 30 dias</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingBirthdays.map((client: any) => (
                        <div
                          key={client.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Calendar className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">{client.name}</h3>
                              <p className="text-sm text-gray-600">
                                {client.daysUntil === 0 ? 'Hoje!' : 
                                 client.daysUntil === 1 ? 'Amanhã' : 
                                 `Em ${client.daysUntil} dias`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`tel:${client.phone}`, '_self')}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedClient(client)}
                            >
                              Ver Cliente
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Resumo Financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total em dívidas:</span>
                      <span className="font-medium">
                        {formatCurrency(
                          clientDebts.reduce((sum, debt) => sum + parseFloat(debt.amount), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dívidas vencidas:</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(
                          overdueDebts.reduce((sum, debt) => sum + parseFloat(debt.amount), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dívidas pendentes:</span>
                      <span className="font-medium text-yellow-600">
                        {formatCurrency(
                          pendingDebts.reduce((sum, debt) => sum + parseFloat(debt.amount), 0)
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Ações Recomendadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {overdueDebts.length > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">
                            {overdueDebts.length} dívida(s) vencida(s) requer(em) atenção
                          </span>
                        </div>
                      )}
                      {upcomingBirthdays.length > 0 && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {upcomingBirthdays.length} aniversário(s) se aproximando
                          </span>
                        </div>
                      )}
                      {overdueDebts.length === 0 && upcomingBirthdays.length === 0 && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Tudo em dia!</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
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
