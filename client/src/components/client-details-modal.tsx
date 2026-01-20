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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Tag,
  FileText,
  Building,
  CreditCard,
  Gift,
  Wallet,
  MessageSquare,
  Edit,
  RefreshCw,
  Check,
  MessageSquareMore,
  Send,
  Bot,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { format, parseISO } from "date-fns";
import { ptBR, th } from "date-fns/locale";
import { type Client, ClientCashbackBalance } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import ClientInteractionsTab from "./client-interactions-tab";
import DealFormModal from "./deal-form-modal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import { Skeleton } from "./ui/skeleton";
import { ClientCashbackTab } from "./client-cashback-tab";
import {
  useUmblerContact,
  useUmblerContactChats,
  useUmblerBot,
  useCreateUmblerChat,
  useSyncUmblerCustomer,
  useSendUmblerMessage,
  useStartUmblerBot,
} from "../hooks/use-umbler";

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
  const [message, setMessage] = useState("");
  const { user } = useAuth();

  const { data: clientFunnels = [] } = useQuery({
    queryKey: [`/api/clients/${client?.id}/funnels`],
    enabled: !!client?.id && isOpen,
  });

  const { data: allFunnels = [] } = useQuery({
    queryKey: ["/api/funnels"],
    enabled: !!client?.id && isOpen,
  });

  const { data: umblerContact, isLoading: isLoadingContact } = useUmblerContact(
    client?.phone,
    !!client?.phone && isOpen,
  );

  const { data: contactChat, isLoading: isLoadingChats } =
    useUmblerContactChats(client?.phone, user?.id, !!client?.phone && isOpen);

  const { data: welcomeBot, isLoading: isLoadingWelcomeBot } = useUmblerBot(
    "vindas",
    user?.id,
    user?.role,
    !!client?.phone && isOpen,
  );

  const { data: inactiveBot, isLoading: isLoadingInactiveBot } = useUmblerBot(
    "inativo",
    user?.id,
    user?.role,
    !!client?.phone && isOpen,
  );

  const createChatMutation = useCreateUmblerChat(user?.id, user?.role);

  const syncCustomer = useSyncUmblerCustomer(user?.id, user?.role);

  const sendMessageMutation = useSendUmblerMessage(user?.id, user?.role);

  const startBotOnChatMutation = useStartUmblerBot(user?.id, user?.role);

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header moderno e limpo */}
        <div className="border-b border-gray-100 dark:border-slate-600  px-6 py-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <span className="block">{client.name}</span>
                <DialogDescription className="text-sm text-gray-600 mt-1">
                  Informações completas e interações do cliente
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Conteúdo do modal */}
        <div className="px-6 py-4">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-slate-600 dark:border-slate-800 border border-gray-200 rounded-lg p-1 mb-6">
              <TabsTrigger
                value="info"
                className="flex items-center gap-2 dark:text-slate-100 dark:data-[state=active]:text-slate-900 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 transition-colors"
              >
                <User className="h-4 w-4" />
                Informações
              </TabsTrigger>
              <TabsTrigger
                value="negocio"
                className="flex items-center gap-2 dark:text-slate-100 dark:data-[state=active]:text-slate-900 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 transition-colors"
              >
                <User className="h-4 w-4" />
                Funis
              </TabsTrigger>
              <TabsTrigger
                value="interactions"
                className="flex items-center gap-2 dark:text-slate-100 dark:data-[state=active]:text-slate-900 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Interações
              </TabsTrigger>
              <TabsTrigger
                value="cashback"
                className="flex items-center gap-2 dark:text-slate-100 dark:data-[state=active]:text-slate-900 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 transition-colors"
              >
                <Wallet className="h-4 w-4" />
                Cashback
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center justify-between">
                    <div className="flex items-center dark:text-slate-200 gap-2">
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
                    <div className="flex items-center  gap-2">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-slate-200" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 dark:text-slate-200">
                          Telefone
                        </p>
                        <a
                          href={`tel:${client.phone}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Clique para ligar"
                        >
                          {formatPhone(client.phone)}
                        </a>
                      </div>
                    </div>

                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500 dark:text-slate-200" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-slate-200">
                            E-mail
                          </p>
                          <p className="font-medium dark:text-slate-400">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 dark:text-slate-200">
                      <CreditCard className="h-4 w-4 text-gray-500 dark:text-slate-200" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-slate-200">
                          CPF
                        </p>
                        <p className="font-medium dark:text-slate-400">
                          {formatCPF(client.cpf || "")}
                        </p>
                      </div>
                    </div>

                    {client.birthday && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500 dark:text-slate-200" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-slate-200">
                            Aniversário
                          </p>
                          <p className="font-medium dark:text-slate-400">
                            {formatBirthday(client.birthday)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center dark:text-slate-200 gap-2">
                    <FaWhatsapp className="h-4 w-4 text-green-600" />
                    WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingContact ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      Verificando status do WhatsApp...
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        {umblerContact ? (
                          <Badge
                            className="bg-green-100 border-green-200 py-1 text-green-800"
                            variant="outline"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Sincronizado
                          </Badge>
                        ) : (
                          <Button
                            size={"sm"}
                            variant={"outline"}
                            disabled={syncCustomer.isPending}
                            onClick={() => {
                              syncCustomer.mutate({
                                phoneNumber: client.phone,
                                organizationId: "aGx7Jh43-au36EGi",
                                name: client.name,
                                email: client.email!,
                              });
                            }}
                            className="bg-green-100 border-green-200 hover:bg-green-200 dark:bg-green-900 dark:border-green-800 dark:hover:bg-green-800 text-green-800 dark:text-green-200 flex items-center"
                          >
                            <RefreshCw
                              className={cn(
                                "h-4 w-4 mr-2",
                                syncCustomer.isPending && "animate-spin",
                              )}
                            />
                            {syncCustomer.isPending
                              ? "Sincronizando..."
                              : "Sincronizar com WhatsApp"}
                          </Button>
                        )}
                      </div>

                      {umblerContact && (
                        <div className="mt-4">
                          {isLoadingChats ? (
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              Carregando conversas...
                            </p>
                          ) : (
                            <>
                              {contactChat && contactChat.items.length > 0 ? (
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <MessageSquareMore className="h-4 w-4" />
                                      Última mensagem enviada:
                                    </p>
                                    {contactChat.items[0].lastMessage ? (
                                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
                                        <p className="text-sm text-gray-800 dark:text-slate-200 italic">
                                          "
                                          {
                                            contactChat.items[0].lastMessage
                                              .content
                                          }
                                          "
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400 dark:text-slate-500 italic">
                                        Nenhuma mensagem enviada ainda
                                      </p>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-sm text-gray-600 dark:text-slate-400">
                                      Envie uma nova mensagem:
                                    </p>
                                    <Textarea
                                      value={message}
                                      onChange={(e) =>
                                        setMessage(e.target.value)
                                      }
                                      placeholder="Digite sua mensagem para o cliente..."
                                      className="border-green-500 focus:ring-green-500"
                                      rows={3}
                                    />
                                    <div className="flex justify-end flex-col sm:flex-row gap-2 sm:items-center">
                                      <div className="flex-1">
                                        {isLoadingInactiveBot &&
                                        isLoadingWelcomeBot ? (
                                          <Skeleton className="w[240px] h-[40px] bg-gray-200" />
                                        ) : (
                                          <div className="flex sm:items-center flex-col sm:flex-row gap-2">
                                            {welcomeBot?.result
                                              .filter(
                                                (bot: any) =>
                                                  bot.title ===
                                                  "Fluxo BOAS VINDAS",
                                              )
                                              .map((bot: any) => (
                                                <Button
                                                  key={bot.id}
                                                  onClick={async () =>
                                                    startBotOnChatMutation.mutateAsync(
                                                      {
                                                        botId: bot.id,
                                                        chatId:
                                                          contactChat.items[0]
                                                            .id,
                                                        triggerName:
                                                          "Boas vindas",
                                                      },
                                                    )
                                                  }
                                                  disabled={
                                                    startBotOnChatMutation.isPending
                                                  }
                                                  size={"sm"}
                                                  variant={"outline"}
                                                >
                                                  <Bot />
                                                  {startBotOnChatMutation.isPending
                                                    ? "iniciando bot..."
                                                    : `${bot.title}`}
                                                </Button>
                                              ))}

                                            {inactiveBot?.result
                                              .filter(
                                                (bot: any) =>
                                                  bot.title ===
                                                  "campanha INATIVOS",
                                              )
                                              .map((bot: any) => (
                                                <Button
                                                  key={bot.id}
                                                  onClick={async () =>
                                                    startBotOnChatMutation.mutateAsync(
                                                      {
                                                        botId: bot.id,
                                                        chatId:
                                                          contactChat.items[0]
                                                            .id,
                                                        triggerName: "Início",
                                                      },
                                                    )
                                                  }
                                                  disabled={
                                                    startBotOnChatMutation.isPending
                                                  }
                                                  size={"sm"}
                                                  variant={"outline"}
                                                >
                                                  <Bot />
                                                  {startBotOnChatMutation.isPending
                                                    ? "iniciando bot..."
                                                    : `${bot.title}`}
                                                </Button>
                                              ))}
                                          </div>
                                        )}
                                      </div>

                                      <Button
                                        onClick={() =>
                                          sendMessageMutation.mutate({
                                            chatId: contactChat?.items[0]?.id,
                                            message,
                                          })
                                        }
                                        disabled={
                                          sendMessageMutation.isPending ||
                                          !message
                                        }
                                        className="bg-green-600 text-white hover:bg-green-700 disabled:bg-opacity-70"
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        {sendMessageMutation.isPending
                                          ? "Enviando..."
                                          : "Enviar Mensagem"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-4 flex items-center justify-center">
                                  <Button
                                    disabled={createChatMutation.isPending}
                                    onClick={async () =>
                                      createChatMutation.mutateAsync({
                                        contactId: umblerContact?.id,
                                      })
                                    }
                                    className="bg-green-500 text-white font-medium"
                                  >
                                    <MessageSquareMore className="size-5 mr-2" />
                                    {createChatMutation.isPending
                                      ? "Criando chat..."
                                      : "Criar chat no WhatsApp"}
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {(client.address || client.cep) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex dark:text-slate-200 items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Endereço
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {client.address && (
                        <p className="flex items-start gap-2">
                          <span className="text-sm text-gray-600 dark:text-slate-400 min-w-[80px]">
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
                          <span className="text-sm text-gray-600 dark:text-slate-200 min-w-[80px]">
                            Bairro:
                          </span>
                          <span className="font-medium dark:text-slate-400">
                            {client.neighborhood}
                          </span>
                        </p>
                      )}

                      {client.city && (
                        <p className="flex items-start gap-2">
                          <span className="text-sm text-gray-600 dark:text-slate-200 min-w-[80px]">
                            Cidade:
                          </span>
                          <span className="font-medium dark:text-slate-400">
                            {client.city}
                            {client.state && `, ${client.state}`}
                          </span>
                        </p>
                      )}

                      {client.cep && (
                        <p className="flex items-start gap-2">
                          <span className="text-sm text-gray-600 dark:text-slate-200 min-w-[80px]">
                            CEP:
                          </span>
                          <span className="font-medium dark:text-slate-400">
                            {client.cep}
                          </span>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex dark:text-slate-200 items-center gap-2">
                    <Building className="h-4 w-4" />
                    Informações Comerciais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {client.categoria && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-slate-200 mb-1">
                          Categoria
                        </p>
                        <Badge variant="secondary" className="capitalize">
                          {client.categoria}
                        </Badge>
                      </div>
                    )}

                    {client.origem && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-slate-200 mb-1">
                          Origem
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {client.origem}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {client.markers && client.markers.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-200 mb-2 flex items-center gap-1">
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center dark:text-slate-200 gap-2">
                    <FileText className="h-4 w-4" />
                    Informações do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-slate-200 min-w-[120px]">
                        Data de cadastro:
                      </span>
                      <span className="font-medium dark:text-slate-400">
                        {formatDate(String(client.createdAt))}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-slate-200 min-w-[120px]">
                        ID do cliente:
                      </span>
                      <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {client.id}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="negocio" className="space-y-6 mt-6">
              {Array.isArray(clientFunnels) && clientFunnels.length > 0 && (
                <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="border-b border-gray-100 bg-gray-50 p-4">
                    <CardTitle className="text-lg flex items-center gap-3 font-semibold text-gray-900">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      Funis com Negócios Existentes
                    </CardTitle>
                    <p className="text-gray-600 text-sm mt-2">
                      Funis onde este cliente já possui negócios ativos
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {clientFunnels.map((funnel: any) => (
                        <Button
                          key={funnel.id}
                          variant="default"
                          className="w-full justify-start h-auto p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
                          onClick={() => handleCreateDeal(funnel.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-white/20 rounded-lg">
                              <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-white">
                                {funnel.name}
                              </p>
                              {funnel.description && (
                                <p className="text-sm text-white/80 mt-1">
                                  {funnel.description}
                                </p>
                              )}
                              <p className="text-xs text-white/70 mt-1">
                                Adicionar novo negócio
                              </p>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4">
                  <CardTitle className="text-lg flex items-center gap-3 font-semibold text-gray-900 dark:text-slate-200">
                    <div className="p-2 bg-blue-100 dark:bg-slate-700 rounded-lg">
                      <User className="h-4 w-4 text-blue-600 dark:text-slate-400" />
                    </div>
                    Criar Novo Negócio
                  </CardTitle>
                  <p className="text-gray-600 dark:text-slate-400 text-sm mt-2">
                    Selecione um funil para iniciar uma nova oportunidade de
                    negócio
                  </p>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="text-center py-2">
                      <div className="inline-flex items-center dark:bg-slate-950 dark:border-slate-700 dark:text-blue-400 gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-200">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {Array.isArray(allFunnels) && allFunnels.length > 0 ? (
                        allFunnels.map((funnel: any) => (
                          <Button
                            key={funnel.id}
                            variant="outline"
                            className="w-full justify-start h-auto p-4 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors duration-200"
                            onClick={() => handleCreateDeal(funnel.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <User className="h-4 w-4 text-gray-600" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium text-gray-900 dark:text-slate-200">
                                  {funnel.name}
                                </p>
                                {funnel.description && (
                                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    {funnel.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Button>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <div className="p-3 bg-gray-100 rounded-full inline-block mb-3">
                            <User className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-gray-900 font-medium">
                            Nenhum funil disponível
                          </p>
                          <p className="text-gray-500 text-sm mt-1">
                            Configure funis de vendas para criar negócios
                          </p>
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
              <ClientCashbackTab
                client={client}
                contactId={umblerContact ? umblerContact.id : undefined}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

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
        />
      )}
    </Dialog>
  );
}
