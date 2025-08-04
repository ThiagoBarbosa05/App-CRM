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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Edit
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Client, ClientCashbackBalance } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import SaleFormModal from "./sale-form-modal";
import CashbackUsageModal from "./cashback-usage-modal";
import ClientInteractionsTab from "./client-interactions-tab";

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (client: Client) => void;
}

export default function ClientDetailsModal({ client, isOpen, onClose, onEdit }: ClientDetailsModalProps) {
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [cashbackUsageModalOpen, setCashbackUsageModalOpen] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);

  // Query para buscar saldo de cashback - deve estar sempre no topo, antes de qualquer return
  const { data: cashbackBalance } = useQuery<ClientCashbackBalance>({
    queryKey: [`/api/cashback-balances/${client?.id}`],
    enabled: !!client?.id && isOpen,
  });

  // Função para formatar moeda
  const formatCurrency = (value: string | number) => {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numericValue);
  };

  if (!client) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
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
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 11) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
    } else if (cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
    }
    
    return phone;
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "Não informado";
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (cleanCPF.length === 11) {
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(9)}`;
    }
    
    return cpf;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-wine-600" />
            {client.name}
          </DialogTitle>
          <DialogDescription>
            Informações detalhadas do cliente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="interactions" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Interações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6 mt-6">
          {/* Ações de Cashback */}
          <Card className="border-2 border-wine-200 bg-wine-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-wine-700">
                <DollarSign className="h-5 w-5" />
                Ações de Cashback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button
                  onClick={() => {
                    if (onEdit) {
                      onEdit(client);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-2 bg-wine-600 hover:bg-wine-700 text-white h-12"
                >
                  <Edit className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Editar</div>
                    <div className="text-xs opacity-90">Alterar dados</div>
                  </div>
                </Button>

                <Button
                  onClick={() => setSaleModalOpen(true)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white h-12"
                >
                  <DollarSign className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Lançar Venda</div>
                    <div className="text-xs opacity-90">Registrar compra</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setBalanceModalOpen(true)}
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 h-12"
                >
                  <Gift className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Ver Saldo</div>
                    <div className="text-xs">Consultar detalhes</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setCashbackUsageModalOpen(true)}
                  disabled={!cashbackBalance?.currentBalance || parseFloat(cashbackBalance.currentBalance.toString()) <= 0}
                  className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 disabled:text-gray-400 disabled:border-gray-200 h-12"
                >
                  <Wallet className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Resgatar</div>
                    <div className="text-xs">Usar cashback</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações Pessoais
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
                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
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
                    <p className="font-medium">{formatCPF(client.cpf || "")}</p>
                  </div>
                </div>

                {client.birthday && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Aniversário</p>
                      <p className="font-medium">{formatBirthday(client.birthday)}</p>
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
                      <span className="text-sm text-gray-600 min-w-[80px]">Endereço:</span>
                      <span className="font-medium">
                        {client.address}
                        {client.number && `, ${client.number}`}
                      </span>
                    </p>
                  )}
                  
                  {client.neighborhood && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">Bairro:</span>
                      <span className="font-medium">{client.neighborhood}</span>
                    </p>
                  )}
                  
                  {client.city && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">Cidade:</span>
                      <span className="font-medium">
                        {client.city}{client.state && `, ${client.state}`}
                      </span>
                    </p>
                  )}
                  
                  {client.cep && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">CEP:</span>
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
                        client.cep && `CEP: ${client.cep}`
                      ].filter(Boolean);
                      
                      const fullAddress = addressParts.join(', ');
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
                      window.open(mapsUrl, '_blank');
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
                      <Badge key={index} variant="default" className="text-xs">
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
                  <span className="text-gray-600 min-w-[120px]">Data de cadastro:</span>
                  <span className="font-medium">{formatDate(String(client.createdAt))}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-600 min-w-[120px]">ID do cliente:</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {client.id}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="interactions" className="mt-6">
            <ClientInteractionsTab client={client} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      <SaleFormModal
        client={client}
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
      />
      
      <CashbackUsageModal
        client={client}
        open={cashbackUsageModalOpen}
        onOpenChange={setCashbackUsageModalOpen}
      />

      {/* Modal de Saldo de Cashback */}
      <Dialog open={balanceModalOpen} onOpenChange={setBalanceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-blue-600" />
              Saldo de Cashback
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-500">CPF: {formatCPF(client.cpf || "")}</p>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-600 mb-1">Saldo Atual (Válido)</p>
                <p className="text-2xl font-bold text-green-600">
                  {cashbackBalance ? formatCurrency(cashbackBalance.currentBalance?.toString() || '0') : formatCurrency(0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Apenas cashbacks válidos (não expirados)
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Ganho</p>
                  <p className="font-medium text-blue-600">
                    {cashbackBalance ? formatCurrency(cashbackBalance.totalEarned?.toString() || '0') : formatCurrency(0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Usado</p>
                  <p className="font-medium text-red-600">
                    {cashbackBalance ? formatCurrency(cashbackBalance.totalUsed?.toString() || '0') : formatCurrency(0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              {cashbackBalance && parseFloat(cashbackBalance.currentBalance?.toString() || '0') > 0 && (
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    setBalanceModalOpen(false);
                    setCashbackUsageModalOpen(true);
                  }}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Resgatar
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setBalanceModalOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}