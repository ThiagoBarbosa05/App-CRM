import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Gift,
  Phone,
  Mail,
  Building2,
  FileText,
} from "lucide-react";
import {
  format,
  parseISO,
  isWithinInterval,
  addDays,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import Sidebar from "@/components/sidebar";
import { useAuth } from "@/hooks/useAuth";

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

interface Company {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  sectorId?: string;
  responsavelId?: string;
  createdAt: string;
}

export default function Reports() {
  const { user } = useAuth();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(
        user?.role === "admin"
          ? "/api/clients"
          : `/api/clients?userId=${user?.id}&userRole=${user?.role}`,
      );
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(
        user?.role === "admin"
          ? "/api/companies"
          : `/api/companies?userId=${user?.id}&userRole=${user?.role}`,
      );
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/categories"],
  });

  const { data: origins = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/origins"],
  });

  const { data: users = [] } = useQuery<
    { id: string; name: string; email: string }[]
  >({
    queryKey: ["/api/users"],
  });

  const { data: markers = [] } = useQuery<
    { id: string; name: string; color: string }[]
  >({
    queryKey: ["/api/markers"],
  });

  const { data: sectors = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/sectors"],
  });

  // Criar sets com nomes válidos para validação
  const validCategoryNames = new Set(categories.map((cat) => cat.name));
  const validOriginNames = new Set(origins.map((origin) => origin.name));
  const validUserIds = new Set(users.map((user) => user.id));
  const validMarkerNames = new Set(markers.map((marker) => marker.name));
  const validSectorIds = new Set(sectors.map((sector) => sector.id));

  // Calcular próximos aniversários (próximos 30 dias)
  const getUpcomingBirthdays = () => {
    const today = startOfDay(new Date());
    const next30Days = addDays(today, 30);

    return clients
      .filter((client) => client.birthday)
      .map((client) => {
        const birthday = parseISO(client.birthday!);
        const currentYear = new Date().getFullYear();

        // Criar data do aniversário para este ano
        const thisYearBirthday = new Date(
          currentYear,
          birthday.getMonth(),
          birthday.getDate(),
        );

        // Se já passou este ano, considerar o próximo ano
        const nextBirthday =
          thisYearBirthday < today
            ? new Date(currentYear + 1, birthday.getMonth(), birthday.getDate())
            : thisYearBirthday;

        return {
          ...client,
          nextBirthday,
          daysUntil: Math.ceil(
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          ),
        };
      })
      .filter((client) =>
        isWithinInterval(client.nextBirthday, {
          start: today,
          end: next30Days,
        }),
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  const upcomingBirthdays = getUpcomingBirthdays();
  const totalClients = clients.length;
  const totalCompanies = companies.length;

  // Estatísticas por categoria (apenas categorias válidas)
  const clientsByCategory = clients.reduce(
    (acc, client) => {
      const category = client.categoria;
      // Só contar se a categoria ainda existe nas configurações ou se não tem categoria
      if (!category) {
        acc["Sem categoria"] = (acc["Sem categoria"] || 0) + 1;
      } else if (validCategoryNames.has(category)) {
        acc[category] = (acc[category] || 0) + 1;
      }
      // Ignora categorias que foram excluídas das configurações
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas por origem (apenas origens válidas)
  const clientsByOrigin = clients.reduce(
    (acc, client) => {
      const origin = client.origem;
      // Só contar se a origem ainda existe nas configurações ou se não tem origem
      if (!origin) {
        acc["Sem origem"] = (acc["Sem origem"] || 0) + 1;
      } else if (validOriginNames.has(origin)) {
        acc[origin] = (acc[origin] || 0) + 1;
      }
      // Ignora origens que foram excluídas das configurações
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas por usuário responsável
  const clientsByUser = clients.reduce(
    (acc, client) => {
      const responsibleId = client.responsavelId;
      if (!responsibleId) {
        acc["Sem responsável"] = (acc["Sem responsável"] || 0) + 1;
      } else if (validUserIds.has(responsibleId)) {
        const user = users.find((u) => u.id === responsibleId);
        const userName = user ? user.name : "Usuário não encontrado";
        acc[userName] = (acc[userName] || 0) + 1;
      }
      // Ignora usuários que foram removidos do sistema
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas por marcadores
  const clientsByMarkers = clients.reduce(
    (acc, client) => {
      const clientMarkers = client.markers || [];
      const validClientMarkers = clientMarkers.filter((markerName) =>
        validMarkerNames.has(markerName),
      );

      if (validClientMarkers.length === 0) {
        acc["Sem marcador"] = (acc["Sem marcador"] || 0) + 1;
      } else {
        validClientMarkers.forEach((markerName) => {
          acc[markerName] = (acc[markerName] || 0) + 1;
        });
      }
      // Ignora marcadores que foram excluídos das configurações
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas de empresas por setor
  const companiesBySector = companies.reduce(
    (acc, company) => {
      const sectorId = company.sectorId;
      if (!sectorId) {
        acc["Sem setor"] = (acc["Sem setor"] || 0) + 1;
      } else if (validSectorIds.has(sectorId)) {
        const sector = sectors.find((s) => s.id === sectorId);
        const sectorName = sector ? sector.name : "Setor não encontrado";
        acc[sectorName] = (acc[sectorName] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas de empresas por usuário responsável
  const companiesByUser = companies.reduce(
    (acc, company) => {
      const responsibleId = company.responsavelId;
      if (!responsibleId) {
        acc["Sem responsável"] = (acc["Sem responsável"] || 0) + 1;
      } else if (validUserIds.has(responsibleId)) {
        const user = users.find((u) => u.id === responsibleId);
        const userName = user ? user.name : "Usuário não encontrado";
        acc[userName] = (acc[userName] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas de empresas por estado
  const companiesByState = companies.reduce(
    (acc, company) => {
      const state = company.state;
      if (!state) {
        acc["Sem estado"] = (acc["Sem estado"] || 0) + 1;
      } else {
        acc[state] = (acc[state] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Estatísticas de empresas por cidade
  const companiesByCity = companies.reduce(
    (acc, company) => {
      const city = company.city;
      if (!city) {
        acc["Sem cidade"] = (acc["Sem cidade"] || 0) + 1;
      } else {
        acc[city] = (acc[city] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto  space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="h-8 w-8 text-wine-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-gray-600">
                Acompanhe métricas e informações importantes dos clientes e
                empresas
              </p>
            </div>
          </div>

          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Clientes
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-wine-600">
                  {totalClients}
                </div>
                <p className="text-xs text-muted-foreground">
                  clientes cadastrados no sistema
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Empresas
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {totalCompanies}
                </div>
                <p className="text-xs text-muted-foreground">
                  empresas cadastradas no sistema
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Aniversários Próximos
                </CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {upcomingBirthdays.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  nos próximos 30 dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Setores Ativos
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {Object.keys(companiesBySector).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  setores diferentes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Próximos Aniversários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-600" />
                Próximos Aniversários
              </CardTitle>
              <CardDescription>
                Clientes que fazem aniversário nos próximos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingBirthdays.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhum aniversário nos próximos 30 dias
                </p>
              ) : (
                <div className="space-y-4">
                  {upcomingBirthdays.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <Gift className="h-6 w-6 text-amber-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {client.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {client.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <a
                                  href={`tel:${client.phone}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                  title="Clique para ligar"
                                >
                                  {client.phone}
                                </a>
                              </div>
                            )}
                            {client.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {client.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {format(client.nextBirthday, "dd/MM", {
                            locale: ptBR,
                          })}
                        </div>
                        <div className="text-xs text-gray-600">
                          {client.daysUntil === 0
                            ? "Hoje"
                            : client.daysUntil === 1
                              ? "Amanhã"
                              : `Em ${client.daysUntil} dias`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Título da seção de clientes */}
          <div className="pt-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-8 w-8 text-wine-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Relatórios de Clientes
                </h2>
                <p className="text-gray-600">
                  Estatísticas e informações importantes dos clientes
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas por Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Clientes por Categoria</CardTitle>
                <CardDescription>
                  Distribuição dos clientes por categoria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(clientsByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {category}
                          </Badge>
                        </div>
                        <span className="font-medium text-wine-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clientes por Origem</CardTitle>
                <CardDescription>
                  Distribuição dos clientes por origem
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(clientsByOrigin)
                    .sort(([, a], [, b]) => b - a)
                    .map(([origin, count]) => (
                      <div
                        key={origin}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {origin}
                          </Badge>
                        </div>
                        <span className="font-medium text-wine-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relatórios por Usuário e Marcadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Clientes por Usuário</CardTitle>
                <CardDescription>
                  Distribuição dos clientes por responsável
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(clientsByUser)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userName, count]) => (
                      <div
                        key={userName}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            {userName}
                          </Badge>
                        </div>
                        <span className="font-medium text-wine-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clientes por Marcadores</CardTitle>
                <CardDescription>
                  Distribuição dos clientes por marcadores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(clientsByMarkers)
                    .sort(([, a], [, b]) => b - a)
                    .map(([markerName, count]) => {
                      const marker = markers.find((m) => m.name === markerName);
                      return (
                        <div
                          key={markerName}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor:
                                  marker?.color && markerName !== "Sem marcador"
                                    ? `${marker.color}20`
                                    : undefined,
                                borderColor:
                                  marker?.color && markerName !== "Sem marcador"
                                    ? marker.color
                                    : undefined,
                                color:
                                  marker?.color && markerName !== "Sem marcador"
                                    ? marker.color
                                    : undefined,
                              }}
                            >
                              {markerName}
                            </Badge>
                          </div>
                          <span className="font-medium text-wine-600">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Título da seção de empresas */}
          <div className="pt-8">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Relatórios de Empresas
                </h2>
                <p className="text-gray-600">
                  Estatísticas e informações importantes das empresas
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas por Setor e Usuário (Empresas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Empresas por Setor</CardTitle>
                <CardDescription>
                  Distribuição das empresas por setor de atividade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(companiesBySector)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sector, count]) => (
                      <div
                        key={sector}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {sector}
                          </Badge>
                        </div>
                        <span className="font-medium text-blue-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Empresas por Usuário</CardTitle>
                <CardDescription>
                  Distribuição das empresas por responsável
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(companiesByUser)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userName, count]) => (
                      <div
                        key={userName}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            {userName}
                          </Badge>
                        </div>
                        <span className="font-medium text-blue-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas por Estado e Cidade (Empresas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Empresas por Estado</CardTitle>
                <CardDescription>
                  Distribuição das empresas por estado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(companiesByState)
                    .sort(([, a], [, b]) => b - a)
                    .map(([state, count]) => (
                      <div
                        key={state}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {state}
                          </Badge>
                        </div>
                        <span className="font-medium text-green-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Empresas por Cidade</CardTitle>
                <CardDescription>
                  Distribuição das empresas por cidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(companiesByCity)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10) // Mostrar apenas as 10 principais cidades
                    .map(([city, count]) => (
                      <div
                        key={city}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {city}
                          </Badge>
                        </div>
                        <span className="font-medium text-green-600">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
                {Object.keys(companiesByCity).length > 10 && (
                  <p className="text-xs text-gray-500 mt-3">
                    Mostrando as 10 principais cidades de{" "}
                    {Object.keys(companiesByCity).length} total
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
