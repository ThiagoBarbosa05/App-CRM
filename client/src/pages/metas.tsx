
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Users, TrendingUp, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Sidebar from "@/components/sidebar";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
  address?: string;
  birthday?: string;
  categoria?: string;
  origem?: string;
  markers?: string[];
  responsavelId?: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: string;
}

export default function Metas() {
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filtrar apenas usuários ativos
  const activeUsers = users.filter(user => user.isActive === "true");

  // Calcular início e fim do mês atual
  const now = new Date();
  const startOfCurrentMonth = startOfMonth(now);
  const endOfCurrentMonth = endOfMonth(now);

  // Filtrar clientes cadastrados no mês atual
  const clientsThisMonth = clients.filter(client => {
    const createdAt = parseISO(client.createdAt);
    return createdAt >= startOfCurrentMonth && createdAt <= endOfCurrentMonth;
  });

  // Calcular cadastros por usuário no mês
  const registrationsByUser = activeUsers.map(user => {
    const userClients = clientsThisMonth.filter(client => client.responsavelId === user.id);
    return {
      user,
      count: userClients.length,
      clients: userClients
    };
  });

  // Clientes sem responsável no mês
  const clientsWithoutOwner = clientsThisMonth.filter(client => !client.responsavelId);

  // Ordenar por quantidade de cadastros (decrescente)
  const sortedRegistrations = registrationsByUser.sort((a, b) => b.count - a.count);

  // Calcular totais
  const totalClientsThisMonth = clientsThisMonth.length;
  const totalActiveUsers = activeUsers.length;
  const averagePerUser = totalActiveUsers > 0 ? (totalClientsThisMonth / totalActiveUsers).toFixed(1) : "0";

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "gerente":
        return "default";
      case "vendedor":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "gerente":
        return "Gerente";
      case "vendedor":
        return "Vendedor";
      default:
        return role;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab="metas" onTabChange={() => {}} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Target className="h-8 w-8 text-wine-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Metas</h1>
              <p className="text-gray-600">
                Indicadores de cadastros de clientes por usuário em {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Estatísticas Gerais do Mês */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total do Mês</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-wine-600">{totalClientsThisMonth}</div>
                <p className="text-xs text-muted-foreground">
                  clientes cadastrados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{totalActiveUsers}</div>
                <p className="text-xs text-muted-foreground">
                  usuários no sistema
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média por Usuário</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{averagePerUser}</div>
                <p className="text-xs text-muted-foreground">
                  cadastros por usuário
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sem Responsável</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{clientsWithoutOwner.length}</div>
                <p className="text-xs text-muted-foreground">
                  clientes sem responsável
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Ranking de Cadastros por Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-wine-600" />
                Ranking de Cadastros - {format(now, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                Quantidade de clientes cadastrados por cada usuário no mês atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedRegistrations.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Nenhum usuário ativo encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedRegistrations.map((registration, index) => (
                    <div
                      key={registration.user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-wine-100 text-wine-600 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="h-10 w-10 rounded-full bg-wine-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-wine-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{registration.user.name}</h3>
                            <Badge variant={getRoleBadgeVariant(registration.user.role)} className="text-xs">
                              {getRoleLabel(registration.user.role)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{registration.user.email}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-wine-600">
                          {registration.count}
                        </div>
                        <p className="text-xs text-gray-500">
                          {registration.count === 1 ? 'cliente' : 'clientes'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalhes dos Clientes Sem Responsável */}
          {clientsWithoutOwner.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  Clientes Sem Responsável - {format(now, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <CardDescription>
                  Clientes cadastrados no mês que ainda não possuem responsável definido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clientsWithoutOwner.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-amber-600" />
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-600">{client.phone}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(client.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
