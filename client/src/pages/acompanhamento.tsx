import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Calendar, Clock, Search, AlertCircle, TrendingUp, Users, BarChart3 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import InteractionFormModal from "@/components/interaction-form-modal";

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  birthday?: string;
  categoria?: string;
  origem?: string;
  markers?: string[];
  responsavelId?: string;
  createdAt: string;
}

interface Interaction {
  id: string;
  clientId: string;
  date: string;
  type: string;
  notes?: string;
}

interface ClientWithStats extends Client {
  daysSinceCreated: number;
  hasRecentContact: boolean;
  lastContactDate?: string;
  responsavelName?: string;
}

export default function Acompanhamento() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);

  // Buscar clientes
  const { data: allClients = [], isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!user,
  });

  // Buscar interações
  const { data: allInteractions = [], isLoading: loadingInteractions } = useQuery<Interaction[]>({
    queryKey: ["/api/interactions"],
    enabled: !!user,
  });

  // Buscar usuários para mapear responsáveis
  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const isLoading = loadingClients || loadingInteractions;

  // Processar dados dos clientes
  const processedClients: ClientWithStats[] = allClients.map(client => {
    const createdDate = new Date(client.createdAt);
    const today = new Date();
    const daysSinceCreated = Math.floor(
      (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Buscar interações do cliente
    const clientInteractions = allInteractions.filter(interaction => 
      interaction.clientId === client.id
    );

    const hasRecentContact = clientInteractions.length > 0;
    const lastContactDate = hasRecentContact 
      ? clientInteractions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : undefined;

    // Mapear responsável
    const responsavel = users.find(u => u.id === client.responsavelId);
    const responsavelName = responsavel?.name || "Não definido";

    return {
      ...client,
      daysSinceCreated,
      hasRecentContact,
      lastContactDate,
      responsavelName,
    };
  });

  // Filtrar clientes sem contato recente
  const clientsWithoutContact = processedClients.filter(client => {
    const needsContact = !client.hasRecentContact && client.daysSinceCreated >= 1;
    
    // Aplicar filtros de permissão
    if (user?.role !== "admin" && user?.role !== "administrador") {
      return needsContact && client.responsavelId === user?.id;
    }
    
    return needsContact;
  }).sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);

  // Filtrar por busca
  const filteredClients = clientsWithoutContact.filter(client =>
    searchQuery === "" || (
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery) ||
      (client.cpf && client.cpf.includes(searchQuery))
    )
  );

  // Calcular estatísticas
  const stats = {
    totalPendentes: filteredClients.length,
    criticos: filteredClients.filter(c => c.daysSinceCreated > 30).length,
    alta: filteredClients.filter(c => c.daysSinceCreated > 14 && c.daysSinceCreated <= 30).length,
    media: filteredClients.filter(c => c.daysSinceCreated > 7 && c.daysSinceCreated <= 14).length,
    normal: filteredClients.filter(c => c.daysSinceCreated >= 1 && c.daysSinceCreated <= 7).length,
    produtividade: allClients.length > 0 
      ? Math.round(((allClients.length - filteredClients.length) / allClients.length) * 100)
      : 100,
    totalInteracoes: allInteractions.length,
    mediaInteracoes: allClients.length > 0 ? (allInteractions.length / allClients.length).toFixed(1) : "0"
  };

  const handleContact = (client: ClientWithStats) => {
    setSelectedClient(client);
    setIsInteractionModalOpen(true);
  };

  const getPriorityColor = (days: number) => {
    if (days > 30) return "bg-red-100 text-red-800 border-red-200";
    if (days > 14) return "bg-orange-100 text-orange-800 border-orange-200";
    if (days > 7) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  const getPriorityLabel = (days: number) => {
    if (days > 30) return "Crítico";
    if (days > 14) return "Alta";
    if (days > 7) return "Média";
    return "Normal";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acompanhamento</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acompanhamento</h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Clientes que precisam ser contactados
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{stats.totalPendentes}</div>
              <div className="text-sm text-gray-500">Clientes pendentes</div>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 py-4 rounded-lg shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Buscar clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Pendentes</p>
                <p className="text-2xl font-bold text-primary">{stats.totalPendentes}</p>
              </div>
              <Users className="h-8 w-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Críticos</p>
                <p className="text-2xl font-bold text-red-600">{stats.criticos}</p>
                <p className="text-xs text-gray-500 mt-1">30+ dias</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Taxa Produtividade</p>
                <p className="text-2xl font-bold text-green-600">{stats.produtividade}%</p>
                <p className="text-xs text-gray-500 mt-1">Clientes acompanhados</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Interações Média</p>
                <p className="text-2xl font-bold text-blue-600">{stats.mediaInteracoes}</p>
                <p className="text-xs text-gray-500 mt-1">Por cliente</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas por Prioridade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{stats.alta}</div>
              <p className="text-xs text-gray-500">Alta (14-30 dias)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">{stats.media}</div>
              <p className="text-xs text-gray-500">Média (7-14 dias)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats.normal}</div>
              <p className="text-xs text-gray-500">Normal (1-7 dias)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{stats.totalInteracoes}</div>
              <p className="text-xs text-gray-500">Total Interações</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Clientes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        {filteredClients.length === 0 ? (
          <div className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? "Nenhum cliente encontrado" : "Excelente trabalho!"}
            </h3>
            <p className="text-gray-500">
              {searchQuery 
                ? "Tente ajustar os termos de busca."
                : "Todos os clientes estão sendo acompanhados adequadamente."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredClients.map((client) => (
              <div key={client.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="text-primary h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{client.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                        {client.email && <span>{client.email}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Cadastrado há {client.daysSinceCreated} dias
                        </span>
                        <span>Responsável: {client.responsavelName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {client.categoria && (
                          <Badge variant="outline" className="text-xs">
                            {client.categoria}
                          </Badge>
                        )}
                        {client.origem && (
                          <Badge variant="outline" className="text-xs">
                            {client.origem}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge className={`${getPriorityColor(client.daysSinceCreated)} border`}>
                        {getPriorityLabel(client.daysSinceCreated)}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {client.daysSinceCreated} dias sem contato
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title="Abrir no WhatsApp"
                      >
                        <FaWhatsapp className="h-4 w-4" />
                      </a>
                      <a
                        href={`tel:${client.phone}`}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ligar"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <Button
                        size="sm"
                        onClick={() => handleContact(client)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Registrar Contato
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interaction Modal */}
      {selectedClient && (
        <InteractionFormModal
          open={isInteractionModalOpen}
          onOpenChange={setIsInteractionModalOpen}
          clientId={selectedClient.id}
        />
      )}
    </div>
  );
}