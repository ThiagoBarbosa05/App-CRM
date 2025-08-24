import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Tag,
  FileText,
  UserCheck,
  Building,
  CreditCard,
  DollarSign,
  Gift,
  Wallet,
  MessageSquare,
  Edit,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Client, ClientCashbackBalance } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import ClientInteractionsTab from "./client-interactions-tab";
import DealFormModal from "./deal-form-modal";

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (client: Client) => void;
}

export default function ClientDetailsModal({
  client,
  isOpen,
  onClose,
  onEdit,
}: ClientDetailsModalProps) {
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");

  // Query para buscar saldo de cashback - deve estar sempre no topo, antes de qualquer return
  const { data: cashbackBalance } = useQuery<ClientCashbackBalance>({
    queryKey: [`/api/cashback-balances/${client?.id}`],
    enabled: !!client?.id && isOpen,
  });

  // Query para buscar funis específicos do cliente
  const { data: clientFunnels = [] } = useQuery({
    queryKey: [`/api/clients/${client?.id}/funnels`],
    enabled: !!client?.id && isOpen,
  });

  // Query para buscar todos os funis disponíveis
  const { data: allFunnels = [] } = useQuery({
    queryKey: ['/api/funnels'],
    enabled: !!client?.id && isOpen,
  });


  // Função para formatar moeda
  const formatCurrency = (value: string | number) => {
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numericValue);
  };

  if (!client) return null;

  const formatDate = (dateString: string) => {
    try {
      const date =
        typeof dateString === "string"
          ? parseISO(dateString)
          : new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatBirthday = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "Não informado";
    }
  };

  const formatPhone = (phone: string) => {
    // Remove caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length === 11) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(
        2,
        7,
      )}-${cleanPhone.slice(7)}`;
    } else if (cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(
        2,
        6,
      )}-${cleanPhone.slice(6)}`;
    }

    return phone;
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "Não informado";
    const cleanCPF = cpf.replace(/\D/g, "");

    if (cleanCPF.length === 11) {
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(
        6,
        9,
      )}-${cleanCPF.slice(9)}`;
    }

    return cpf;
  };

  const handleCreateDeal = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setShowCreateDealModal(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-wine-600" />
            {client.name}
          </DialogTitle>
          <DialogDescription className="text-left">
            Informações detalhadas do cliente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="negocio" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Funis
            </TabsTrigger>
            <TabsTrigger
              value="interactions"
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Interações
            </TabsTrigger>
            <TabsTrigger value="cashback" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Cashback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6 mt-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex flex-col sm:flex-row justify-start sm:items-center justify-between">
                  <div className="flex  items-center gap-2">
                    <User className="h-4 w-4" />
                    Informações Pessoais
                  </div>
                  <Button
                    onClick={() => {
                      if (onEdit) {
                        onEdit(client);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                    size="sm"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Editar</span>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Telefone</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${client.phone}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Clique para ligar"
                        >
                          {formatPhone(client.phone)}
                        </a>
                        <a
                          href={`https://wa.me/${client.phone.replace(
                            /\D/g,
                            "",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 transition-colors"
                          title="Abrir no WhatsApp"
                        >
                          <FaWhatsapp className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">E-mail</p>
                        <p className="font-medium">{client.email}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">CPF</p>
                      <p className="font-medium">
                        {formatCPF(client.cpf || "")}
                      </p>
                    </div>
                  </div>

                  {client.birthday && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Aniversário</p>
                        <p className="font-medium">
                          {formatBirthday(client.birthday)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            {(client.address || client.cep) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {client.address && (
                      <p className="flex items-start gap-2">
                        <span className="text-sm text-gray-600 min-w-[80px]">
                          Endereço:
                        </span>
                        <span className="font-medium">
                          {client.address}
                          {client.number && `, ${client.number}`}
                        </span>
                      </p>
                    )}

                    {client.neighborhood && (
                      <p className="flex items-start gap-2">
                        <span className="text-sm text-gray-600 min-w-[80px]">
                          Bairro:
                        </span>
                        <span className="font-medium">
                          {client.neighborhood}
                        </span>
                      </p>
                    )}

                    {client.city && (
                      <p className="flex items-start gap-2">
                        <span className="text-sm text-gray-600 min-w-[80px]">
                          Cidade:
                        </span>
                        <span className="font-medium">
                          {client.city}
                          {client.state && `, ${client.state}`}
                        </span>
                      </p>
                    )}

                    {client.cep && (
                      <p className="flex items-start gap-2">
                        <span className="text-sm text-gray-600 min-w-[80px]">
                          CEP:
                        </span>
                        <span className="font-medium">{client.cep}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const addressParts = [
                          client.address,
                          client.number && `${client.number}`,
                          client.neighborhood,
                          client.city,
                          client.state,
                          client.cep && `CEP: ${client.cep}`,
                        ].filter(Boolean);

                        const fullAddress = addressParts.join(", ");
                        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          fullAddress,
                        )}`;
                        window.open(mapsUrl, "_blank");
                      }}
                      className="flex items-center gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      Ver no Mapa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informações Comerciais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Informações Comerciais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {client.categoria && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Categoria</p>
                      <Badge variant="secondary" className="capitalize">
                        {client.categoria}
                      </Badge>
                    </div>
                  )}

                  {client.origem && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Origem</p>
                      <Badge variant="outline" className="capitalize">
                        {client.origem}
                      </Badge>
                    </div>
                  )}
                </div>

                {client.markers && client.markers.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Marcadores
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {client.markers.map((marker, index) => (
                        <Badge
                          key={index}
                          variant="default"
                          className="text-xs"
                        >
                          {marker}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Informações do Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Informações do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="text-gray-600 min-w-[120px]">
                      Data de cadastro:
                    </span>
                    <span className="font-medium">
                      {formatDate(String(client.createdAt))}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-gray-600 min-w-[120px]">
                      ID do cliente:
                    </span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {client.id}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="negocio" className="space-y-6 mt-6">
            {/* Funis onde o cliente já tem negócios */}
            {Array.isArray(clientFunnels) && clientFunnels.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Funis com Negócios Existentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {clientFunnels.map((funnel: any) => (
                      <Button 
                        key={funnel.id}
                        variant="default" 
                        className="w-full justify-start h-auto p-4"
                        onClick={() => handleCreateDeal(funnel.id)}
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4" />
                          <div className="text-left">
                            <p className="font-medium">{funnel.name}</p>
                            {funnel.description && (
                              <p className="text-sm text-white/80">{funnel.description}</p>
                            )}
                            <p className="text-xs text-white/60">Adicionar novo negócio</p>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Todos os funis disponíveis para criar novos negócios */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Criar Novo Negócio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium text-gray-900">{client.name}</p>
                  <p className="text-sm text-gray-500">Escolha o funil para criar um novo negócio</p>
                  
                  <div className="space-y-3">
                    {Array.isArray(allFunnels) && allFunnels.length > 0 ? (
                      allFunnels.map((funnel: any) => (
                        <Button 
                          key={funnel.id}
                          variant="outline" 
                          className="w-full justify-start h-auto p-4"
                          onClick={() => handleCreateDeal(funnel.id)}
                        >
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-primary" />
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interactions" className="mt-6">
            <ClientInteractionsTab client={client} />
          </TabsContent>

          <TabsContent value="cashback" className="space-y-6 mt-6">
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
                      {cashbackBalance ? formatCurrency(cashbackBalance.currentBalance?.toString() || "0") : formatCurrency(0)}
                    </p>
                  </div>
                  <Gift className="h-8 w-8 text-green-600" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-600">Total Acumulado</p>
                    <p className="text-lg font-bold text-blue-700">
                      {cashbackBalance ? formatCurrency(cashbackBalance.totalEarned?.toString() || "0") : formatCurrency(0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm font-medium text-orange-600">Total Utilizado</p>
                    <p className="text-lg font-bold text-orange-700">
                      {cashbackBalance ? formatCurrency(cashbackBalance.totalUsed?.toString() || "0") : formatCurrency(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Modal de Criação de Negócio */}
      {showCreateDealModal && client && (
        <DealFormModal
          open={showCreateDealModal}
          onOpenChange={(open) => {
            setShowCreateDealModal(open);
            if (!open) {
              setSelectedFunnelId("");
            }
          }}
          funnelId={selectedFunnelId}
          deal={undefined}
          initialClientId={client.id}
          initialTitle={client.name}
        />
      )}
    </Dialog>
  );
}
