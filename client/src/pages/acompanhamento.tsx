
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Calendar, Clock, Search, AlertCircle } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { formatPhone, formatDate } from "@/lib/utils";
import InteractionFormModal from "@/components/interaction-form-modal";

interface ClientWithoutContact {
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
  daysSinceCreated: number;
  lastInteractionDate?: string;
  responsavelName?: string;
}

export default function Acompanhamento() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientWithoutContact | null>(null);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);

  // Buscar clientes sem contato recente
  const { data: clientsWithoutContact = [], isLoading } = useQuery({
    queryKey: ["/api/clients/without-contact", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(`/api/clients/without-contact?userId=${user?.id}&userRole=${user?.role}&days=1`);
      if (!response.ok) throw new Error('Failed to fetch clients without contact');
      return response.json();
    },
    enabled: !!user,
  });

  // Filtrar por busca
  const filteredClients = clientsWithoutContact.filter(client =>
    searchQuery === "" || (
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery) ||
      (client.cpf && client.cpf.includes(searchQuery))
    )
  );

  const handleContact = (client: ClientWithoutContact) => {
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
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">Acompanhamento</h2>
          <p className="text-gray-600 mt-1">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Acompanhamento</h2>
            <p className="text-gray-600 mt-1">
              Clientes que ainda não foram contactados
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{filteredClients.length}</div>
              <div className="text-sm text-gray-500">Clientes pendentes</div>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 px-6 py-4 rounded-lg shadow-sm">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Crítico (30+ dias)</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredClients.filter(c => c.daysSinceCreated > 30).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alta (14-30 dias)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredClients.filter(c => c.daysSinceCreated > 14 && c.daysSinceCreated <= 30).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Média (7-14 dias)</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredClients.filter(c => c.daysSinceCreated > 7 && c.daysSinceCreated <= 14).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Normal (1-7 dias)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredClients.filter(c => c.daysSinceCreated >= 1 && c.daysSinceCreated <= 7).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients List */}
      <div className="bg-white rounded-lg shadow-sm">
        {filteredClients.length === 0 ? (
          <div className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "Nenhum cliente encontrado" : "Todos os clientes foram contactados!"}
            </h3>
            <p className="text-gray-500">
              {searchQuery 
                ? "Tente ajustar os termos de busca."
                : "Parabéns! Não há clientes pendentes de contato."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredClients.map((client) => (
              <div key={client.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                      <User className="text-primary h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{client.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhone(client.phone)}
                        </span>
                        {client.email && (
                          <span>{client.email}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Cadastrado em {formatDate(client.createdAt)}
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
                        className="bg-primary hover:bg-primary-dark"
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
          clientName={selectedClient.name}
          onSuccess={() => {
            setIsInteractionModalOpen(false);
            setSelectedClient(null);
          }}
        />
      )}
    </div>
  );
}
