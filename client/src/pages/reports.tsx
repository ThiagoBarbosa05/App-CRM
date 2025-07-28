import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Gift, Phone, Mail } from "lucide-react";
import { format, parseISO, isWithinInterval, addDays, startOfDay } from "date-fns";
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
  responsible?: string;
  createdAt: string;
}

export default function Reports() {
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: categories = [] } = useQuery<{id: string; name: string}[]>({
    queryKey: ["/api/categories"],
  });

  const { data: origins = [] } = useQuery<{id: string; name: string}[]>({
    queryKey: ["/api/origins"],
  });

  // Criar sets com nomes válidos para validação
  const validCategoryNames = new Set(categories.map(cat => cat.name));
  const validOriginNames = new Set(origins.map(origin => origin.name));

  // Calcular próximos aniversários (próximos 30 dias)
  const getUpcomingBirthdays = () => {
    const today = startOfDay(new Date());
    const next30Days = addDays(today, 30);
    
    return clients
      .filter(client => client.birthday)
      .map(client => {
        const birthday = parseISO(client.birthday!);
        const currentYear = new Date().getFullYear();
        
        // Criar data do aniversário para este ano
        const thisYearBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());
        
        // Se já passou este ano, considerar o próximo ano
        const nextBirthday = thisYearBirthday < today 
          ? new Date(currentYear + 1, birthday.getMonth(), birthday.getDate())
          : thisYearBirthday;
        
        return {
          ...client,
          nextBirthday,
          daysUntil: Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
      .filter(client => 
        isWithinInterval(client.nextBirthday, { start: today, end: next30Days })
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  const upcomingBirthdays = getUpcomingBirthdays();
  const totalClients = clients.length;

  // Estatísticas por categoria (apenas categorias válidas)
  const clientsByCategory = clients.reduce((acc, client) => {
    const category = client.categoria;
    // Só contar se a categoria ainda existe nas configurações ou se não tem categoria
    if (!category) {
      acc["Sem categoria"] = (acc["Sem categoria"] || 0) + 1;
    } else if (validCategoryNames.has(category)) {
      acc[category] = (acc[category] || 0) + 1;
    } else {
      // Categoria foi excluída - contar como "Categoria removida"
      acc["Categoria removida"] = (acc["Categoria removida"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Estatísticas por origem (apenas origens válidas)
  const clientsByOrigin = clients.reduce((acc, client) => {
    const origin = client.origem;
    // Só contar se a origem ainda existe nas configurações ou se não tem origem
    if (!origin) {
      acc["Sem origem"] = (acc["Sem origem"] || 0) + 1;
    } else if (validOriginNames.has(origin)) {
      acc[origin] = (acc[origin] || 0) + 1;
    } else {
      // Origem foi excluída - contar como "Origem removida"
      acc["Origem removida"] = (acc["Origem removida"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab="clientes" onTabChange={() => {}} />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="h-8 w-8 text-wine-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-gray-600">Acompanhe métricas e informações importantes dos clientes</p>
            </div>
          </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-wine-600">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              clientes cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversários Próximos</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{upcomingBirthdays.length}</div>
            <p className="text-xs text-muted-foreground">
              nos próximos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias Ativas</CardTitle>
            <Badge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{Object.keys(clientsByCategory).length}</div>
            <p className="text-xs text-muted-foreground">
              categorias diferentes
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
                <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                        <Gift className="h-6 w-6 text-amber-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{client.name}</h3>
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
                      {format(client.nextBirthday, "dd/MM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-gray-600">
                      {client.daysUntil === 0 ? "Hoje" : 
                       client.daysUntil === 1 ? "Amanhã" : 
                       `Em ${client.daysUntil} dias`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                .sort(([,a], [,b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={category === "Categoria removida" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {category}
                      </Badge>
                      {category === "Categoria removida" && (
                        <span className="text-xs text-red-500">
                          (Categoria foi excluída das configurações)
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-wine-600">{count}</span>
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
                .sort(([,a], [,b]) => b - a)
                .map(([origin, count]) => (
                  <div key={origin} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={origin === "Origem removida" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {origin}
                      </Badge>
                      {origin === "Origem removida" && (
                        <span className="text-xs text-red-500">
                          (Origem foi excluída das configurações)
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-wine-600">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </div>
    </div>
  );
}