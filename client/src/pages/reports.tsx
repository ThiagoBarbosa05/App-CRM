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
    queryKey: ["/api/clients", user?.id, user?.role, "all"],
    queryFn: async () => {
      // Para relatórios, precisamos buscar TODOS os clientes, não apenas uma página
      const response = await fetch(
        user?.role === "admin"
          ? "/api/clients/export-all" // Endpoint que retorna todos os clientes
          : `/api/clients?userId=${user?.id}&userRole=${user?.role}&pageSize=10000`, // Número alto para pegar todos
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies", user?.id, user?.role, "all"],
    queryFn: async () => {
      // Para relatórios, buscar todas as empresas com um pageSize alto
      const response = await fetch(
        user?.role === "admin"
          ? "/api/companies?pageSize=10000"
          : `/api/companies?userId=${user?.id}&userRole=${user?.role}&pageSize=10000`,
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
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

    // Para a página de relatórios, clients já deve ser um array direto
    const clientsArray = Array.isArray(clients) ? clients : [];

    return clientsArray
      .filter((client) => client.birthday)
      .map((client) => {
        const birthday = parseISO(client.birthday!);
        const currentYear = new Date().getFullYear();

        // Criar data do aniversário para este ano
        const thisYearBirthday = new Date(
          currentYear,
          birthday.getMonth(),
          birthday.getDate()
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
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          ),
        };
      })
      .filter((client) =>
        isWithinInterval(client.nextBirthday, {
          start: today,
          end: next30Days,
        })
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  const upcomingBirthdays = getUpcomingBirthdays();

  // Para a página de relatórios, clients e companies já devem ser arrays diretos
  const clientsArray = Array.isArray(clients) ? clients : [];
  const companiesArray = Array.isArray(companies) ? companies : [];

  const totalClients = clientsArray.length;
  const totalCompanies = companiesArray.length;

  // Estatísticas por categoria (apenas categorias válidas)
  const clientsByCategory = clientsArray.reduce((acc, client) => {
    const category = client.categoria;
    // Só contar se a categoria ainda existe nas configurações ou se não tem categoria
    if (!category) {
      acc["Sem categoria"] = (acc["Sem categoria"] || 0) + 1;
    } else if (validCategoryNames.has(category)) {
      acc[category] = (acc[category] || 0) + 1;
    }
    // Ignora categorias que foram excluídas das configurações
    return acc;
  }, {} as Record<string, number>);

  // Estatísticas por origem (apenas origens válidas)
  const clientsByOrigin = clientsArray.reduce((acc, client) => {
    const origin = client.origem;
    // Só contar se a origem ainda existe nas configurações ou se não tem origem
    if (!origin) {
      acc["Sem origem"] = (acc["Sem origem"] || 0) + 1;
    } else if (validOriginNames.has(origin)) {
      acc[origin] = (acc[origin] || 0) + 1;
    }
    // Ignora origens que foram excluídas das configurações
    return acc;
  }, {} as Record<string, number>);

  // Estatísticas por usuário responsável
  const clientsByUser = clientsArray.reduce((acc, client) => {
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
  }, {} as Record<string, number>);

  // Estatísticas por marcadores
  const clientsByMarkers = clientsArray.reduce((acc, client) => {
    const clientMarkers = client.markers || [];
    const validClientMarkers = clientMarkers.filter((markerName) =>
      validMarkerNames.has(markerName)
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
  }, {} as Record<string, number>);

  // Estatísticas de empresas por setor
  const companiesBySector = companiesArray.reduce((acc, company) => {
    const sectorId = company.sectorId;
    if (!sectorId) {
      acc["Sem setor"] = (acc["Sem setor"] || 0) + 1;
    } else if (validSectorIds.has(sectorId)) {
      const sector = sectors.find((s) => s.id === sectorId);
      const sectorName = sector ? sector.name : "Setor não encontrado";
      acc[sectorName] = (acc[sectorName] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Estatísticas de empresas por usuário responsável
  const companiesByUser = companiesArray.reduce((acc, company) => {
    const responsibleId = company.responsavelId;
    if (!responsibleId) {
      acc["Sem responsável"] = (acc["Sem responsável"] || 0) + 1;
    } else if (validUserIds.has(responsibleId)) {
      const user = users.find((u) => u.id === responsibleId);
      const userName = user ? user.name : "Usuário não encontrado";
      acc[userName] = (acc[userName] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Estatísticas de empresas por estado
  const companiesByState = companiesArray.reduce((acc, company) => {
    const state = company.state;
    if (!state) {
      acc["Sem estado"] = (acc["Sem estado"] || 0) + 1;
    } else {
      acc[state] = (acc[state] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Estatísticas de empresas por cidade
  const companiesByCity = companiesArray.reduce((acc, company) => {
    const city = company.city;
    if (!city) {
      acc["Sem cidade"] = (acc["Sem cidade"] || 0) + 1;
    } else {
      acc[city] = (acc[city] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Use useQuery hook to fetch upcoming birthdays, filtering by user if not admin
  const { data: upcomingBirthdaysFiltered = [] } = useQuery<Client[]>({
    queryKey: ["/api/upcoming-birthdays", 30, user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch("/api/upcoming-birthdays?days=30", {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch upcoming birthdays");
      return response.json();
    },
    enabled: !!user,
  });

  return (
    <div className="flex">
      <div className="flex-1 overflow-auto">
        <div className="space-y-6">
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-4">
                <Users className="size-6 shrink-0 text-blue-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Relatórios
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Acompanhe métricas e informações importantes dos clientes e
                    empresas
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Total de Clientes
                  </CardTitle>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-3 group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
                  {totalClients}
                </div>
                <p className="text-sm text-green-600/70 dark:text-green-400/70 font-medium">
                  clientes cadastrados no sistema
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Total de Empresas
                  </CardTitle>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-2">
                  {totalCompanies}
                </div>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70 font-medium">
                  empresas cadastradas no sistema
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Aniversários Próximos
                  </CardTitle>
                </div>
                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-3 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 transition-colors">
                  <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-700 dark:text-amber-400 mb-2">
                  {upcomingBirthdaysFiltered.length}
                </div>
                <p className="text-sm text-amber-600/70 dark:text-amber-400/70 font-medium">
                  nos próximos 30 dias
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Setores Ativos
                  </CardTitle>
                </div>
                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 transition-colors">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  {Object.keys(companiesBySector).length}
                </div>
                <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70 font-medium">
                  setores diferentes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Próximos Aniversários */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-t-xl border-b border-amber-100 dark:border-amber-800/30">
              <CardTitle className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-2.5 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 transition-colors">
                  <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  Próximos Aniversários
                </span>
              </CardTitle>
              <CardDescription className="text-amber-700/70 dark:text-amber-300/70 font-medium">
                Clientes que fazem aniversário nos próximos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {upcomingBirthdaysFiltered.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Gift className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-amber-600/70 dark:text-amber-400/70 font-medium">
                    Nenhum aniversário nos próximos 30 dias
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBirthdaysFiltered.slice(0, 15).map((client) => (
                    <div
                      key={client.id}
                      className="group/item flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-amber-100 dark:border-amber-800/30 hover:border-amber-200 dark:hover:border-amber-700/50 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex flex-col items-start gap-3 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full flex items-center justify-center group-hover/item:from-amber-200 group-hover/item:to-orange-200 dark:group-hover/item:from-amber-800/40 dark:group-hover/item:to-orange-800/40 transition-colors">
                            <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                            {client.name}
                          </h3>
                        </div>
                        <div className="ml-13 sm:ml-15">
                          <div className="flex flex-col sm:flex-row items-start gap-3 text-sm">
                            {client.phone && (
                              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-1">
                                  <Phone className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </div>
                                <a
                                  href={`tel:${client.phone}`}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline cursor-pointer transition-colors"
                                  title="Clique para ligar"
                                >
                                  {client.phone}
                                </a>
                              </div>
                            )}
                            {client.email && (
                              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-lg">
                                <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1">
                                  <Mail className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                                </div>
                                <span className="text-gray-600 dark:text-gray-300 text-sm font-medium truncate">
                                  {client.email}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-4 sm:mt-0 sm:flex-col sm:items-end">
                        <div className="bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg">
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
                            {format(parseISO(client.birthday!), "dd/MM", {
                              locale: ptBR,
                            })}
                          </div>
                        </div>
                        <div className="bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg">
                          <div className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                            {(() => {
                              const today = startOfDay(new Date());
                              const birthday = parseISO(client.birthday!);
                              const currentYear = new Date().getFullYear();
                              const thisYearBirthday = new Date(
                                currentYear,
                                birthday.getMonth(),
                                birthday.getDate()
                              );
                              const nextBirthday =
                                thisYearBirthday < today
                                  ? new Date(
                                      currentYear + 1,
                                      birthday.getMonth(),
                                      birthday.getDate()
                                    )
                                  : thisYearBirthday;
                              const daysUntil = Math.ceil(
                                (nextBirthday.getTime() - today.getTime()) /
                                  (1000 * 60 * 60 * 24)
                              );

                              if (daysUntil === 0) return "Hoje";
                              if (daysUntil === 1) return "Amanhã";
                              return `Em ${daysUntil} dias`;
                            })()}
                          </div>
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
            <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-3">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Relatórios de Clientes
                </h2>
                <p className="text-green-700/70 dark:text-green-300/70 font-medium">
                  Estatísticas e informações importantes dos clientes
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas por Categoria */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-t-xl border-b border-purple-100 dark:border-purple-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Clientes por Categoria
                </CardTitle>
                <CardDescription className="text-purple-700/70 dark:text-purple-300/70 font-medium">
                  Distribuição dos clientes por categoria
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(clientsByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-purple-100 dark:border-purple-800/30 hover:border-purple-200 dark:hover:border-purple-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300 font-medium px-3 py-1"
                          >
                            {category}
                          </Badge>
                        </div>
                        <div className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-purple-700 dark:text-purple-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-t-xl border-b border-cyan-100 dark:border-cyan-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-cyan-100 dark:bg-cyan-900/30 rounded-lg p-2">
                    <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  Clientes por Origem
                </CardTitle>
                <CardDescription className="text-cyan-700/70 dark:text-cyan-300/70 font-medium">
                  Distribuição dos clientes por origem
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(clientsByOrigin)
                    .sort(([, a], [, b]) => b - a)
                    .map(([origin, count]) => (
                      <div
                        key={origin}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-cyan-100 dark:border-cyan-800/30 hover:border-cyan-200 dark:hover:border-cyan-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300 font-medium px-3 py-1"
                          >
                            {origin}
                          </Badge>
                        </div>
                        <div className="bg-cyan-100 dark:bg-cyan-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-cyan-700 dark:text-cyan-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relatórios por Usuário e Marcadores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-t-xl border-b border-indigo-100 dark:border-indigo-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-2">
                    <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Clientes por Usuário
                </CardTitle>
                <CardDescription className="text-indigo-700/70 dark:text-indigo-300/70 font-medium">
                  Distribuição dos clientes por responsável
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(clientsByUser)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userName, count]) => (
                      <div
                        key={userName}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800/30 hover:border-indigo-200 dark:hover:border-indigo-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="default"
                            className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 font-medium px-3 py-1"
                          >
                            {userName}
                          </Badge>
                        </div>
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-indigo-700 dark:text-indigo-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/10 dark:to-pink-900/10">
              <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-t-xl border-b border-rose-100 dark:border-rose-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-2">
                    <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  Clientes por Marcadores
                </CardTitle>
                <CardDescription className="text-rose-700/70 dark:text-rose-300/70 font-medium">
                  Distribuição dos clientes por marcadores
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(clientsByMarkers)
                    .sort(([, a], [, b]) => b - a)
                    .map(([markerName, count]) => {
                      const marker = markers.find((m) => m.name === markerName);
                      return (
                        <div
                          key={markerName}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-rose-100 dark:border-rose-800/30 hover:border-rose-200 dark:hover:border-rose-700/50 hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="secondary"
                              className="font-medium px-3 py-1"
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
                          <div className="bg-rose-100 dark:bg-rose-900/30 px-3 py-1.5 rounded-lg">
                            <span className="font-bold text-rose-700 dark:text-rose-300 text-lg">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Título da seção de empresas */}
          <div className="pt-8">
            <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-3">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Relatórios de Empresas
                </h2>
                <p className="text-blue-700/70 dark:text-blue-300/70 font-medium">
                  Estatísticas e informações importantes das empresas
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas por Setor e Usuário (Empresas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/10 dark:to-cyan-900/10">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-t-xl border-b border-teal-100 dark:border-teal-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-2">
                    <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  Empresas por Setor
                </CardTitle>
                <CardDescription className="text-teal-700/70 dark:text-teal-300/70 font-medium">
                  Distribuição das empresas por setor de atividade
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(companiesBySector)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sector, count]) => (
                      <div
                        key={sector}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-teal-100 dark:border-teal-800/30 hover:border-teal-200 dark:hover:border-teal-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className="bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/50 dark:text-teal-300 font-medium px-3 py-1"
                          >
                            {sector}
                          </Badge>
                        </div>
                        <div className="bg-teal-100 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-teal-700 dark:text-teal-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-t-xl border-b border-violet-100 dark:border-violet-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-2">
                    <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  Empresas por Usuário
                </CardTitle>
                <CardDescription className="text-violet-700/70 dark:text-violet-300/70 font-medium">
                  Distribuição das empresas por responsável
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(companiesByUser)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userName, count]) => (
                      <div
                        key={userName}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-violet-100 dark:border-violet-800/30 hover:border-violet-200 dark:hover:border-violet-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="default"
                            className="bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 font-medium px-3 py-1"
                          >
                            {userName}
                          </Badge>
                        </div>
                        <div className="bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-violet-700 dark:text-violet-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas por Estado e Cidade (Empresas) */}
          <div className="grid grid-cols-1 pb-2 lg:grid-cols-2 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-t-xl border-b border-emerald-100 dark:border-emerald-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-2">
                    <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Empresas por Estado
                </CardTitle>
                <CardDescription className="text-emerald-700/70 dark:text-emerald-300/70 font-medium">
                  Distribuição das empresas por estado
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(companiesByState)
                    .sort(([, a], [, b]) => b - a)
                    .map(([state, count]) => (
                      <div
                        key={state}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-emerald-100 dark:border-emerald-800/30 hover:border-emerald-200 dark:hover:border-emerald-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20 font-medium px-3 py-1"
                          >
                            {state}
                          </Badge>
                        </div>
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-900/10 dark:to-green-900/10">
              <CardHeader className="bg-gradient-to-r from-lime-50 to-green-50 dark:from-lime-900/20 dark:to-green-900/20 rounded-t-xl border-b border-lime-100 dark:border-lime-800/30 pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                  <div className="bg-lime-100 dark:bg-lime-900/30 rounded-lg p-2">
                    <Building2 className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  Empresas por Cidade
                </CardTitle>
                <CardDescription className="text-lime-700/70 dark:text-lime-300/70 font-medium">
                  Distribuição das empresas por cidade
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Object.entries(companiesByCity)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10) // Mostrar apenas as 10 principais cidades
                    .map(([city, count]) => (
                      <div
                        key={city}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-lime-100 dark:border-lime-800/30 hover:border-lime-200 dark:hover:border-lime-700/50 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="border-lime-200 text-lime-700 hover:bg-lime-50 dark:border-lime-700 dark:text-lime-300 dark:hover:bg-lime-900/20 font-medium px-3 py-1"
                          >
                            {city}
                          </Badge>
                        </div>
                        <div className="bg-lime-100 dark:bg-lime-900/30 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-lime-700 dark:text-lime-300 text-lg">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                {Object.keys(companiesByCity).length > 10 && (
                  <div className="mt-4 p-3 bg-lime-50 dark:bg-lime-900/20 rounded-lg border border-lime-100 dark:border-lime-800/30">
                    <p className="text-sm text-lime-700 dark:text-lime-300 font-medium text-center">
                      Mostrando as 10 principais cidades de{" "}
                      <span className="font-bold">
                        {Object.keys(companiesByCity).length}
                      </span>{" "}
                      total
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
