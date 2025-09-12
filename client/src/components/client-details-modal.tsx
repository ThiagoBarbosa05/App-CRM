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
import { useMutation, useQuery } from "@tanstack/react-query";
import ClientInteractionsTab from "./client-interactions-tab";
import DealFormModal from "./deal-form-modal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import { Skeleton } from "./ui/skeleton";

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

  const { data: cashbackBalance } = useQuery<ClientCashbackBalance>({
    queryKey: [`/api/cashback-balances/${client?.id}`],
    enabled: !!client?.id && isOpen,
  });

  const { data: clientFunnels = [] } = useQuery({
    queryKey: [`/api/clients/${client?.id}/funnels`],
    enabled: !!client?.id && isOpen,
  });

  const { data: allFunnels = [] } = useQuery({
    queryKey: ["/api/funnels"],
    enabled: !!client?.id && isOpen,
  });

  const { data: umblerContact, isLoading: isLoadingContact } = useQuery({
    queryKey: [`/api/umbler/contacts`, client?.phone],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/contacts/${client?.phone}`);
      if (!response.ok) throw new Error("Failed to fetch umbler contacts");
      return response.json();
    },
    enabled: !!client?.phone && isOpen,
  });

  const { data: contactChat, isLoading: isLoadingChats } = useQuery({
    queryKey: ["contactChat", client?.phone],
    queryFn: async () => {
      const response = await fetch(
        `/api/umbler/chats?customerPhone=${client?.phone}&userId=${user?.id}`,
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }

      return await response.json();
    },
    enabled: !!client?.phone && isOpen,
  });

  const { data: welcomeBot, isLoading: isLoadingWelcomeBot } = useQuery<{
    result: {
      _t: string;
      triggers: string[];
      manualTriggers: string[];
      steps: any[];
      channels: any[];
      title: string;
      order: number;
      final: boolean;
      active: boolean;
      groupIds: any[];
      updatedAtUTC: string;
      executionsCount: number;
      executionsDateUTC: string;
      id: string;
      createdAtUTC: string;
    }[];
  }>({
    queryKey: ["welcomeBot"],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/bot?title=vindas`, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }

      return await response.json();
    },
    enabled: !!client?.phone && isOpen,
  });

  const { data: inactiveBot, isLoading: isLoadingInactiveBot } = useQuery<{
    result: {
      _t: string;
      triggers: string[];
      manualTriggers: string[];
      steps: any[];
      channels: any[];
      title: string;
      order: number;
      final: boolean;
      active: boolean;
      groupIds: any[];
      updatedAtUTC: string;
      executionsCount: number;
      executionsDateUTC: string;
      id: string;
      createdAtUTC: string;
    }[];
  }>({
    queryKey: ["inactiveBot"],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/bot?title=inativo`, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }

      return await response.json();
    },
    enabled: !!client?.phone && isOpen,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/umbler/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({
          contactId: umblerContact?.id,
          userId: user?.id,
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const { newChat } = data;
      console.log("Chat criado com sucesso:", newChat);

      toast({
        title: "Chat criado com sucesso",
        description: "O chat foi criado com sucesso",
      });

      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", client?.phone],
        (old) => {
          console.log(old);
          return {
            items: [...(old?.items ?? []), newChat],
          };
        }
      );
    },
    onError: () => {
      toast({
        title: "Erro ao criar chat",
        description: "Não foi possível criar o chat",
      });
    },
  });

  const syncCustomer = useMutation({
    mutationFn: async (customerData: {
      phoneNumber: string;
      name?: string;
      email?: string;
      organizationId: string;
    }) => {
      const response = await fetch(
        `/api/umbler/contacts/create?userId=${user?.id}`,
        {
          method: "POST",
          body: JSON.stringify(customerData),
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to update customer");
      return response.json();
    },
    onSuccess: (data) => {
      const { newChat } = data;
      console.log("Chat criado com sucesso:", newChat);

      toast({
        title: "Cliente sincronizado com sucesso",
        description: "O cliente foi sincronizado com o Umbler Talk",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/umbler/contacts`, client?.phone],
      });
      // queryClient.invalidateQueries({
      //   queryKey: ["contactChat", client?.phone],
      // });

      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", client?.phone],
        (old) => {
          console.log(old);
          return {
            items: [...(old?.items ?? []), newChat],
          };
        }
      );
    },
    onError: () => {
      toast({
        title: "Erro ao sincronizar cliente",
        description: "Não foi possível sincronizar o cliente com o Umbler Talk",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const chatId = contactChat?.items[0]?.id;
      if (!chatId) throw new Error("Chat não encontrado");

      const response = await fetch("/api/umbler/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({
          chatId,
          message,
        }),
      });

      if (!response.ok) throw new Error("Falha ao enviar mensagem");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada!",
        description: "Sua mensagem foi enviada com sucesso.",
      });
      setMessage("");
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", client?.id, "interactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["contactChat", client?.phone],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    },
  });

  const startBotOnChatMutation = useMutation({
    mutationFn: (data: {
      chatId: string;
      botId: string;
      triggerName: string;
    }) =>
      fetch("/api/start/birthday-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify(data),
      }),
    onSuccess: async (response) => {
      if (!response.ok) throw new Error("Failed to start bot");
      toast({
        title: "Bot iniciado com sucesso",
        description: "A mensagem foi enviada com sucesso.",
      });

      queryClient.invalidateQueries({
        queryKey: ["contactChat", client?.phone],
      });
    },
    onError: () => {
      toast({
        title: "Erro ao iniciar bot",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    },
  });

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
        7
      )}-${cleanPhone.slice(7)}`;
    } else if (cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(
        2,
        6
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
        9
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center justify-between">
                  <div className="flex items-center gap-2">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FaWhatsapp className="h-4 w-4 text-green-600" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingContact ? (
                  <p className="text-sm text-gray-500">
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
                          className="bg-green-100 border-green-200 hover:bg-green-200"
                        >
                          <RefreshCw
                            className={cn(
                              "h-4 w-4 mr-2",
                              syncCustomer.isPending && "animate-spin"
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
                          <p className="text-sm text-gray-500">
                            Carregando conversas...
                          </p>
                        ) : (
                          <>
                            {contactChat && contactChat.items.length > 0 ? (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                                    <MessageSquareMore className="h-4 w-4" />
                                    Última mensagem enviada:
                                  </p>
                                  {contactChat.items[0].lastMessage ? (
                                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                      <p className="text-sm text-gray-800 italic">
                                        "
                                        {
                                          contactChat.items[0].lastMessage
                                            .content
                                        }
                                        "
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">
                                      Nenhuma mensagem enviada ainda
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm text-gray-600">
                                    Envie uma nova mensagem:
                                  </p>
                                  <Textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
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
                                              (bot) =>
                                                bot.title ===
                                                "Fluxo BOAS VINDAS"
                                            )
                                            .map((bot) => (
                                              <Button
                                                onClick={async () =>
                                                  startBotOnChatMutation.mutateAsync(
                                                    {
                                                      botId: bot.id,
                                                      chatId:
                                                        contactChat.items[0].id,
                                                      triggerName:
                                                        "Boas vindas",
                                                    }
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
                                              (bot) =>
                                                bot.title ===
                                                "campanha INATIVOS"
                                            )
                                            .map((bot) => (
                                              <Button
                                                onClick={async () =>
                                                  startBotOnChatMutation.mutateAsync(
                                                    {
                                                      botId: bot.id,
                                                      chatId:
                                                        contactChat.items[0].id,
                                                      triggerName: "Início",
                                                    }
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
                                    createChatMutation.mutateAsync()
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
                          fullAddress
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
                              <p className="text-sm text-white/80">
                                {funnel.description}
                              </p>
                            )}
                            <p className="text-xs text-white/60">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Criar Novo Negócio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium text-gray-900">
                    {client.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    Escolha o funil para criar um novo negócio
                  </p>

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
                                <p className="text-sm text-gray-500">
                                  {funnel.description}
                                </p>
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
                    <p className="text-sm font-medium text-green-600">
                      Saldo Disponível
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                      {cashbackBalance
                        ? formatCurrency(
                            cashbackBalance.currentBalance?.toString() || "0"
                          )
                        : formatCurrency(0)}
                    </p>
                  </div>
                  <Gift className="h-8 w-8 text-green-600" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-600">
                      Total Acumulado
                    </p>
                    <p className="text-lg font-bold text-blue-700">
                      {cashbackBalance
                        ? formatCurrency(
                            cashbackBalance.totalEarned?.toString() || "0"
                          )
                        : formatCurrency(0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm font-medium text-orange-600">
                      Total Utilizado
                    </p>
                    <p className="text-lg font-bold text-orange-700">
                      {cashbackBalance
                        ? formatCurrency(
                            cashbackBalance.totalUsed?.toString() || "0"
                          )
                        : formatCurrency(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
