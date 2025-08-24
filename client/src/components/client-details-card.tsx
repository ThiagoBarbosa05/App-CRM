import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client } from "@shared/schema";
import { User, Phone, Mail, MapPin, Calendar, Tag, Edit, MessageSquare, History, Gift, DollarSign, Wallet, Plus, GitBranch } from "lucide-react";
import { formatDate } from "@/lib/utils";
import ClientInteractionsTab from "./client-interactions-tab";
import DealFormModal from "./deal-form-modal";
import { useQuery } from "@tanstack/react-query";
// Função para formatar moeda
const formatCurrency = (value: string | number) => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
};

interface ClientDetailsCardProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (client: Client) => void;
}

export default function ClientDetailsCard({ client, open, onOpenChange, onEdit }: ClientDetailsCardProps) {
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [showFunnelSelector, setShowFunnelSelector] = useState(false);

  if (!client) return null;
  
  console.log("ClientDetailsCard rendering for client:", client.name);
  console.log("Funnels available:", funnels);

  const formatPhone = (phone: string) => {
    // Remove caracteres não numéricos
    const numbers = phone.replace(/\D/g, '');
    // Aplica máscara (11) 99999-9999
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatCPF = (cpf: string | null | undefined) => {
    if (!cpf) return "Não informado";
    // Remove caracteres não numéricos
    const numbers = cpf.replace(/\D/g, '');
    // Aplica máscara 999.999.999-99
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatAddress = () => {
    return `${client.address}, ${client.number} - ${client.neighborhood}, ${client.city}/${client.state} - CEP: ${client.cep}`;
  };

  const formatBirthday = (birthday: string | null | undefined) => {
    if (!birthday) return "Não informado";
    return formatDate(birthday);
  };

  const getMarkerColors = (markers: string[]) => {
    const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800'];
    return markers.map((_, index) => colors[index % colors.length]);
  };

  const { data: interactions = [] } = useQuery({
    queryKey: [`/api/clients/${client?.id}/interactions`],
    enabled: !!client?.id,
  });

  // Query para buscar saldo de cashback
  const { data: cashbackBalance = {} } = useQuery({
    queryKey: [`/api/cashback-balances/${client?.id}`],
    enabled: !!client?.id,
  });

  // Query para buscar histórico de uso de cashback
  const { data: cashbackUsage = [] } = useQuery({
    queryKey: [`/api/cashback-usage/${client?.id}`],
    enabled: !!client?.id,
  });

  // Query para buscar usuários (para mostrar o responsável)
  const { data: users = [] } = useQuery<{id: string; name: string; email: string}[]>({
    queryKey: ["/api/users"],
  });

  // Query para buscar funis disponíveis
  const { data: funnels = [] } = useQuery({
    queryKey: ["/api/funnels"],
  });

  const handleCreateDeal = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setShowFunnelSelector(false);
    setShowCreateDealModal(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-wine-600" />
              <span className="text-lg font-semibold">{client.name}</span>
            </div>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(client)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {/* Botão para criar negócio */}
        <div className="flex justify-center mb-4" style={{backgroundColor: 'red', padding: '10px'}}>
          <Button
            onClick={() => {
              console.log("Botão criar negócio clicado!");
              setShowFunnelSelector(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6"
            size="default"
            data-testid="button-criar-negocio"
            style={{fontSize: '16px', fontWeight: 'bold'}}
          >
            <Plus className="h-4 w-4" />
            CRIAR NEGÓCIO NO FUNIL
          </Button>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="cashback" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Cashback
            </TabsTrigger>
            <TabsTrigger value="interactions" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6 overflow-y-auto max-h-[65vh]">
            <div className="space-y-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Pessoais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-gray-600">CPF: {formatCPF(client.cpf)}</p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Telefone:</strong> 
                        <a 
                          href={`tel:${client.phone}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer ml-1"
                          title="Clique para ligar"
                        >
                          {formatPhone(client.phone)}
                        </a>
                      </span>
                    </div>

                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          <strong>E-mail:</strong> {client.email}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Aniversário:</strong> {formatBirthday(client.birthday)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Responsável:</strong> {(() => {
                          const user = users.find(u => u.id === client.responsavelId);
                          return user ? user.name : (client.responsavelId ? "Usuário não encontrado" : "Não atribuído");
                        })()}
                      </span>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">{formatAddress()}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const address = formatAddress();
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                      window.open(mapsUrl, '_blank');
                    }}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    Ver no Mapa
                  </Button>
                </CardContent>
              </Card>

              {/* Classificação e Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Classificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Categoria:</p>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {client.categoria}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Origem:</p>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {client.origem}
                      </Badge>
                    </div>
                  </div>

                  {client.markers && client.markers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Marcadores:</p>
                      <div className="flex flex-wrap gap-2">
                        {client.markers.map((marker, index) => (
                          <Badge 
                            key={marker} 
                            variant="secondary" 
                            className={getMarkerColors(client.markers)[index]}
                          >
                            {marker}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ações Rápidas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => setShowFunnelSelector(true)}
                    className="w-full bg-primary hover:bg-primary-dark text-white flex items-center gap-2"
                  >
                    <GitBranch className="h-4 w-4" />
                    Criar Novo Negócio no Funil
                  </Button>
                  <p className="text-sm text-gray-600 text-center">
                    Crie rapidamente um novo negócio para este cliente
                  </p>
                </CardContent>
              </Card>

              {/* Informações do Sistema */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    <p><strong>Cliente desde:</strong> {formatDate(client.createdAt.toString())}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cashback" className="mt-6 overflow-y-auto max-h-[65vh]">
            <div className="space-y-6">
              {/* Saldo de Cashback */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-green-600" />
                    Saldo de Cashback
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <p className="text-sm font-medium text-green-600">Saldo Disponível</p>
                      <p className="text-2xl font-bold text-green-700">
                        {cashbackBalance ? formatCurrency((cashbackBalance as any).balance || 0) : formatCurrency(0)}
                      </p>
                    </div>
                    <Gift className="h-8 w-8 text-green-600" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-600">Total Acumulado</p>
                      <p className="text-lg font-bold text-blue-700">
                        {cashbackBalance ? formatCurrency((cashbackBalance as any).totalEarned || 0) : formatCurrency(0)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm font-medium text-orange-600">Total Utilizado</p>
                      <p className="text-lg font-bold text-orange-700">
                        {cashbackBalance ? formatCurrency((cashbackBalance as any).totalUsed || 0) : formatCurrency(0)}
                      </p>
                    </div>
                  </div>


                </CardContent>
              </Card>

              {/* Histórico de Cashback */}
              {Array.isArray(cashbackUsage) && cashbackUsage.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Histórico de Resgates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(cashbackUsage as any[]).map((usage: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{formatCurrency(usage.amount)}</p>
                            <p className="text-sm text-gray-600">
                              {usage.description || 'Resgate de cashback'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {formatDate(usage.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="interactions" className="mt-6 h-[65vh] overflow-hidden">
            <ClientInteractionsTab client={client} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Modal de Seleção de Funil */}
      <Dialog open={showFunnelSelector} onOpenChange={setShowFunnelSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Selecionar Funil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-500">Escolha o funil para criar o negócio</p>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              {Array.isArray(funnels) && funnels.length > 0 ? (
                funnels.map((funnel: any) => (
                  <Button
                    key={funnel.id}
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={() => handleCreateDeal(funnel.id)}
                  >
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{funnel.name}</p>
                        {funnel.description && (
                          <p className="text-sm text-gray-500">{funnel.description}</p>
                        )}
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">Nenhum funil disponível</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowFunnelSelector(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Criação de Negócio */}
      {showCreateDealModal && (
        <DealFormModal
          open={showCreateDealModal}
          onOpenChange={(open) => {
            setShowCreateDealModal(open);
            if (!open) {
              setSelectedFunnelId("");
            }
          }}
          funnelId={selectedFunnelId}
          deal={{
            title: client.name,
            clientId: client.id,
            funnelId: selectedFunnelId,
            stageId: "",
            value: "",
            notes: "",
          } as any}
        />
      )}
    </Dialog>
  );
}