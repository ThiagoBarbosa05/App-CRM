import {
  Bot,
  DollarSign,
  Info,
  Loader2,
  MessageSquareMore,
  Percent,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AlertDialogHeader } from "./ui/alert-dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { Client, ClientCashbackBalance } from "@shared/schema";
import { Bot as IBot } from "server/integrations/interfaces/bot";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CustomField } from "server/integrations/interfaces/create-contact";

interface SalesManagementProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (isOpen: boolean) => void;
}

interface Sale {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  grossValue: number;
  cashbackUsed: number;
  netValue: number;
  cashbackGenerated: number;
  createdAt: string;
}

interface SaleForm {
  clientId: string;
  date: string;
  grossValue: string;
  notes: string;
  invoiceNumber: string;
}

export function SalesManagementTab({
  isDialogOpen,
  setIsDialogOpen,
}: SalesManagementProps) {
  const [saleForm, setSaleForm] = useState<SaleForm>({
    clientId: "",
    date: new Date().toISOString().split("T")[0],
    grossValue: "",
    notes: "",
    invoiceNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [useCashback, setUseCashback] = useState<boolean>(true); // Controla se deve usar cashback
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedClientBalance, setSelectedClientBalance] = useState<number>(0);

  const [sales, setSales] = useState<Sale[]>([]);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "administrador" || user?.role === "admin";

  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-settings"],
  });

  const { data: thirtyDaysReport = {} } = useQuery<any>({
    queryKey: ["/api/cashback-reports/30-days"],
  });

  const { data: umblerContact, isLoading: isLoadingUmblerContact } = useQuery<{
    id: string;
  } | null>({
    queryKey: ["umblerContactByPhone", selectedClient?.phone],
    queryFn: async () => {
      if (!selectedClient?.phone) return null;
      const response = await fetch(
        `/api/umbler/contacts/${selectedClient?.phone}`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch Umbler contact");
      const data = await response.json();
      console.log(data);
      return data;
    },
    enabled: !!selectedClient && isDialogOpen,
  });

  const { data: contactChat, isLoading: isLoadingChats } = useQuery({
    queryKey: ["contactChat", selectedClient?.phone],
    queryFn: async () => {
      if (!selectedClient?.phone) return null;
      const response = await fetch(
        `/api/umbler/chats?customerPhone=${selectedClient.phone}&userId=${user?.id}`,
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }
      return response.json();
    },
    enabled: !!selectedClient?.phone,
  });

  const contactId = umblerContact?.id;

  const createCashbackMutation = useMutation({
    mutationFn: async (data: { value: string; contactId: string }) => {
      const response = await fetch(`/api/umbler/cashback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Erro ao cadastrar cashback na Umbler");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields", contactId] });
    },
    onError: () => {
      toast({
        title: "Erro ao criar campo de cashback na Umbler",
        variant: "destructive",
      });
    },
  });

  const updateCashbackMutation = useMutation({
    mutationFn: async (data: {
      value: string;
      contactId: string;
      customFieldId: string;
    }) => {
      const response = await fetch(
        `/api/umbler/cashback/${data.customFieldId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
          body: JSON.stringify({
            value: data.value,
            contactId: data.contactId,
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Erro ao atualizar cashback na Umbler");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields", contactId] });
    },
    onError: () => {
      toast({
        title: "Erro ao sincronizar cashback com a Umbler",
        variant: "destructive",
      });
    },
  });

  const syncAndStartBotMutation = useMutation({
    mutationFn: async (data: {
      chatId: string;
      botId: string;
      triggerName: string;
    }) => {
      if (!selectedClient) throw new Error("Cliente não selecionado");

      // 1. Get latest balance
      await queryClient.invalidateQueries({
        queryKey: [`/api/cashback-balances/${selectedClient.id}`],
      });
      const balanceData = await queryClient.fetchQuery<ClientCashbackBalance>({
        queryKey: [`/api/cashback-balances/${selectedClient.id}`],
      });
      const newBalance = balanceData?.currentBalance ?? "0";

      const formattedBalance = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(parseFloat(newBalance.toString()));

      // 2. Get latest custom field
      const customFieldData = await queryClient.fetchQuery<{
        result: CustomField;
      } | null>({ queryKey: ["customFields", contactId] });
      const umblerField = customFieldData?.result;

      // 3. Create or Update
      toast({ title: "Sincronizando saldo com a Umbler..." });
      if (umblerField) {
        await updateCashbackMutation.mutateAsync({
          value: formattedBalance,
          contactId: contactId!,
          customFieldId: umblerField.id,
        });
      } else {
        await createCashbackMutation.mutateAsync({
          value: formattedBalance,
          contactId: contactId!,
        });
      }

      // 4. Start Bot
      return fetch("/api/start/birthday-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: async (response) => {
      if (!response.ok) throw new Error("Failed to start bot");
      toast({
        title: "Automação de cashback iniciada!",
        description: "O saldo na Umbler foi atualizado e a mensagem enviada.",
      });
      queryClient.invalidateQueries({
        queryKey: ["contactChat", selectedClient?.phone],
      });
    },
    onError: () => {
      toast({
        title: "Erro na automação",
        description:
          "A venda foi salva, mas houve um erro ao sincronizar o cashback e enviar a mensagem.",
        variant: "destructive",
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
        },
      );
      if (!response.ok) throw new Error("Failed to update customer");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente sincronizado com sucesso",
        description: "O cliente foi sincronizado com o Umbler Talk",
      });
      queryClient.invalidateQueries({
        queryKey: ["umblerContactByPhone", selectedClient?.phone],
      });
      queryClient.invalidateQueries({
        queryKey: ["contactChat", selectedClient?.phone],
      });
    },
    onError: () => {
      toast({
        title: "Erro ao sincronizar cliente",
        description: "Não foi possível sincronizar o cliente com o Umbler Talk",
      });
    },
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
          contactId: contactId,
          userId: user?.id,
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const { newChat } = data;
      toast({
        title: "Chat criado com sucesso",
        description: "O chat foi criado com sucesso",
      });
      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", selectedClient?.phone],
        (old) => ({
          items: [...(old?.items ?? []), newChat],
        }),
      );
    },
    onError: () => {
      toast({
        title: "Erro ao criar chat",
        description: "Não foi possível criar o chat",
      });
    },
  });

  const loadSales = async () => {
    try {
      const response = await fetch("/api/sales");
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
    }
  };

  const previewValues = () => {
    const grossValue = parseFloat(saleForm.grossValue) || 0;
    const result = calculateSaleValues(
      grossValue,
      selectedClientBalance,
      useCashback,
    );

    // Buscar configuração ativa para obter a taxa real
    const activeSetting = settings.find((s: any) => s.isActive === "true");
    const actualRate = activeSetting
      ? parseFloat(activeSetting.percentageRate)
      : 0;

    return {
      ...result,
      actualRate,
    };
  };

  const calculateSaleValues = (
    grossValue: number,
    clientBalance: number,
    shouldUseCashback: boolean = true,
  ) => {
    // Aplicar cashback existente apenas se o vendedor escolher usar
    let cashbackUsed = 0;
    if (shouldUseCashback && clientBalance > 0) {
      const maxCashbackUsage = grossValue * 0.5;
      cashbackUsed = Math.min(clientBalance, maxCashbackUsage);
    }

    // Valor líquido após aplicação do cashback
    const netValue = grossValue - cashbackUsed;

    // Buscar configuração ativa de cashback
    const activeSetting = settings.find((s: any) => s.isActive === "true");
    let cashbackRate = 0;

    if (activeSetting) {
      const minimumPurchase = parseFloat(activeSetting.minimumPurchase || "0");

      // Verificar se o valor líquido atende ao mínimo
      if (netValue >= minimumPurchase) {
        cashbackRate = parseFloat(activeSetting.percentageRate) / 100;
      }
    }

    // Gerar novo cashback baseado no valor líquido após desconto do cashback usado
    let cashbackGenerated = netValue * cashbackRate;

    // Aplicar limite máximo se definido
    if (activeSetting && activeSetting.maximumCashback) {
      const maxCashback = parseFloat(activeSetting.maximumCashback);
      cashbackGenerated = Math.min(cashbackGenerated, maxCashback);
    }

    return {
      cashbackUsed,
      netValue,
      cashbackGenerated,
      cashbackRate: cashbackRate * 100, // Retornar em percentual para exibição
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!saleForm.clientId || !saleForm.date || !saleForm.grossValue) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const grossValue = parseFloat(saleForm.grossValue);
    if (grossValue <= 0) {
      toast({
        title: "Erro",
        description: "Valor da venda deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Primeiro calcular o cashback usando a API
      const cashbackResponse = await fetch("/api/calculate-cashback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purchaseAmount: grossValue }),
      });

      if (!cashbackResponse.ok) {
        throw new Error("Erro ao calcular cashback");
      }

      const cashbackData = await cashbackResponse.json();

      const saleData = {
        clientId: saleForm.clientId,
        date: saleForm.date,
        grossValue: grossValue,
        notes: saleForm.notes,
        invoiceNumber: saleForm.invoiceNumber,
        userId: user?.id,
        useCashback: useCashback,
      };

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saleData),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Venda registrada com sucesso!",
        });

        // START: Trigger Cashback Bot
        const chatId = queryClient.getQueryData<any>([
          "contactChat",
          selectedClient?.phone,
        ])?.items?.[0]?.id;
        const bot = queryClient.getQueryData<{ result: IBot }>([
          "botCashback",
        ])?.result;

        if (chatId && bot?.id) {
          await syncAndStartBotMutation.mutateAsync({
            chatId: chatId,
            botId: bot.id,
            triggerName: "Início",
          });
        } else {
          toast({
            title: "Aviso",
            description:
              "A venda foi registrada, mas não foi possível iniciar o bot de cashback.",
            variant: "default",
          });
        }
        // END: Trigger Cashback Bot

        setSaleForm({
          clientId: "",
          date: new Date().toISOString().split("T")[0],
          grossValue: "",
          notes: "",
          invoiceNumber: "",
        });
        setSelectedClient(null);
        setSelectedClientBalance(0);
        setSelectedClientName("");
        setUseCashback(true);
        setIsDialogOpen(false);

        // Recarregar todos os dados relacionados
        await loadSales();
        queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/cashback-transactions"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/cashback-reports/30-days"],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Erro ao registrar venda");
      }
    } catch (error) {
      console.error("Erro ao registrar venda:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao registrar venda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientBalance = async (clientId: string) => {
    if (!clientId) {
      setSelectedClientBalance(0);
      return;
    }

    try {
      const response = await fetch(`/api/cashback-balances/${clientId}`);
      if (response.ok) {
        const data: any = await response.json();
        setSelectedClientBalance(parseFloat(data.currentBalance) || 0);
      }
    } catch (error) {
      console.error("Erro ao carregar saldo de cashback:", error);
      setSelectedClientBalance(0);
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setSelectedClient(client || null);
    setSaleForm((prev) => ({ ...prev, clientId }));
    setSelectedClientName(client?.name || "");
    loadClientBalance(clientId);
  };

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "",
          "x-user-email": user?.email || "",
        },
      });

      if (!response.ok) {
        // Tentar parsear como JSON, se falhar usar texto simples
        try {
          const error = await response.json();
          throw new Error(error.message || "Erro ao excluir venda");
        } catch {
          throw new Error("Erro ao excluir venda");
        }
      }

      // Para DELETE bem-sucedido, não é necessário retornar JSON
      // Se a resposta for vazia, retornar objeto simples
      try {
        return await response.json();
      } catch {
        return { success: true };
      }
    },
    onSuccess: () => {
      toast({
        title: "Venda excluída",
        description: "A venda foi removida com sucesso.",
      });
      // Recarregar dados relacionados - forçar refetch
      loadSales();
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-reports/30-days"],
      });
      // Forçar refetch imediato dos dados críticos
      queryClient.refetchQueries({ queryKey: ["/api/sales"] });
      queryClient.refetchQueries({
        queryKey: ["/api/cashback-reports/30-days"],
      });
      setDeletingSaleId(null);
    },
    onError: (error: any) => {
      console.error("Erro ao excluir venda:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a venda.",
        variant: "destructive",
      });
      setDeletingSaleId(null);
    },
  });

  const isUmblerReady = !!contactId && !!contactChat?.items?.[0]?.id;

  const handleDeleteSale = (saleId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    setDeletingSaleId(saleId);
    deleteSaleMutation.mutate(saleId);
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vendas</h2>
          <p className="text-muted-foreground">
            Gerencie vendas e cashback automaticamente
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[95vh] overflow-y-auto">
            <AlertDialogHeader>
              <DialogTitle>Registrar Nova Venda</DialogTitle>
            </AlertDialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente *</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar por nome, CPF ou telefone..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {clientSearchQuery.trim() && clients.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {clients.map((client) => (
                          <div
                            key={client.id}
                            className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                              saleForm.clientId === client.id
                                ? "bg-blue-50 border-blue-200"
                                : ""
                            }`}
                            onClick={() => {
                              handleClientChange(client.id);
                              setClientSearchQuery(client.name);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {client.name}
                              </span>
                              <span className="text-sm text-gray-500">
                                {client.cpf} • {client.phone}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {clientSearchQuery.trim() && clients.length === 0 && (
                      <div className="border rounded-md p-4 text-center text-sm text-gray-500">
                        Nenhum cliente encontrado
                      </div>
                    )}
                    {saleForm.clientId && selectedClientName && (
                      <div className="text-sm text-gray-600 mt-2">
                        <strong>Cliente selecionado:</strong>{" "}
                        {selectedClientName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Data da Venda *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={saleForm.date}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              {/* START: Umbler Status UI */}
              {selectedClient && (
                <Card className="bg-gray-50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      Automação de Cashback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUmblerContact || isLoadingChats ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verificando status na Umbler...</span>
                      </div>
                    ) : !umblerContact ? (
                      <div className="flex flex-col items-start gap-3">
                        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                          <Info className="h-5 w-5" />
                          <span className="font-medium">Ação Necessária</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                          Sincronize este contato com a Umbler para poder
                          disparar o bot de cashback.
                        </p>
                        <Button
                          type="button"
                          onClick={() =>
                            syncCustomer.mutate({
                              phoneNumber: selectedClient.phone,
                              name: selectedClient.name,
                              organizationId: "aGx7Jh43-au36EGi",
                            })
                          }
                          disabled={syncCustomer.isPending}
                          size="sm"
                        >
                          <RefreshCcw
                            className={cn(
                              "size-4 mr-2",
                              syncCustomer.isPending && "animate-spin",
                            )}
                          />
                          {syncCustomer.isPending
                            ? "Sincronizando..."
                            : "Sincronizar com Umbler"}
                        </Button>
                      </div>
                    ) : !contactChat || contactChat.items.length === 0 ? (
                      <div className="flex flex-col items-start gap-3">
                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                          <Info className="h-5 w-5" />
                          <span className="font-medium">Chat não iniciado</span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                          Este cliente ainda não tem um chat no WhatsApp. Crie
                          um para enviar o cashback.
                        </p>
                        <Button
                          type="button"
                          disabled={createChatMutation.isPending}
                          onClick={() => createChatMutation.mutate()}
                          size="sm"
                        >
                          {createChatMutation.isPending ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <MessageSquareMore className="size-4 mr-2" />
                          )}
                          {createChatMutation.isPending
                            ? "Criando chat..."
                            : "Criar chat no WhatsApp"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                        Prontinho! O bot de cashback será disparado após
                        registrar a venda.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {/* END: Umbler Status UI */}

              <div className="space-y-2">
                <Label htmlFor="grossValue">Valor Bruto da Venda *</Label>
                <Input
                  id="grossValue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={saleForm.grossValue}
                  onChange={(e) =>
                    setSaleForm((prev) => ({
                      ...prev,
                      grossValue: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {/* Opção para usar cashback */}
              {saleForm.clientId && selectedClientBalance > 0 && (
                <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="useCashback"
                    checked={useCashback}
                    onChange={(e) => setUseCashback(e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="useCashback"
                      className="text-sm font-medium text-green-700 cursor-pointer"
                    >
                      Usar saldo de cashback disponível (
                      {formatCurrency(selectedClientBalance)})
                    </Label>
                    <p className="text-xs text-green-600">
                      {useCashback
                        ? "O cashback será aplicado automaticamente"
                        : "O cashback não será usado nesta venda"}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Nº Nota</Label>
                <Input
                  id="invoiceNumber"
                  type="text"
                  placeholder="Ex: 123456"
                  value={saleForm.invoiceNumber}
                  onChange={(e) =>
                    setSaleForm((prev) => ({
                      ...prev,
                      invoiceNumber: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações da Venda</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Adicione observações sobre a venda..."
                  value={saleForm.notes}
                  onChange={(e) =>
                    setSaleForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              {saleForm.clientId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Resumo da Venda</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Saldo de Cashback Disponível:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {formatCurrency(selectedClientBalance)}
                        </Badge>
                        {selectedClientBalance > 0 && (
                          <Badge
                            variant={useCashback ? "default" : "outline"}
                            className={
                              useCashback
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {useCashback ? "Será usado" : "Não será usado"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {saleForm.grossValue && (
                      <>
                        <div className="flex justify-between">
                          <span>Valor Bruto:</span>
                          <span>
                            {formatCurrency(parseFloat(saleForm.grossValue))}
                          </span>
                        </div>

                        <div
                          className={`flex justify-between ${useCashback && previewValues().cashbackUsed > 0 ? "text-green-600" : "text-gray-500"}`}
                        >
                          <span>Cashback Aplicado:</span>
                          <span>
                            {useCashback && previewValues().cashbackUsed > 0
                              ? `-${formatCurrency(previewValues().cashbackUsed)}`
                              : formatCurrency(0)}
                          </span>
                        </div>

                        <div className="flex justify-between font-semibold">
                          <span>Valor Líquido a Pagar:</span>
                          <span>
                            {formatCurrency(previewValues().netValue)}
                          </span>
                        </div>

                        <div className="flex justify-between text-blue-600">
                          <span>
                            Novo Cashback Gerado (
                            {previewValues().actualRate?.toFixed(1) || 0}%):
                          </span>
                          <span>
                            +{formatCurrency(previewValues().cashbackGenerated)}
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setClientSearchQuery("");
                    setSelectedClient(null);
                    setSelectedClientName("");
                    setUseCashback(true);
                    setSaleForm({
                      clientId: "",
                      date: new Date().toISOString().split("T")[0],
                      grossValue: "",
                      notes: "",
                      invoiceNumber: "",
                    });
                    setSelectedClientBalance(0);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || !isUmblerReady}>
                  {loading ? "Registrando..." : "Registrar Venda"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas de Vendas - Últimos 30 dias */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Vendas (30 dias)
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {thirtyDaysReport.salesCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valor Total Bruto (30 dias)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(thirtyDaysReport.totalSales || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valor de venda Líquida
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(
                (thirtyDaysReport.totalSales || 0) -
                  (thirtyDaysReport.totalCashbackUsed || 0),
              )}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cashback Utilizado (30 dias)
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(thirtyDaysReport.totalCashbackUsed || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cashback Gerado (30 dias)
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(thirtyDaysReport.totalCashbackGenerated || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Cashback Usado</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Cashback Gerado</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhuma venda registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      {sale.clientName}
                    </TableCell>
                    <TableCell>
                      {new Date(sale.date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{formatCurrency(sale.grossValue)}</TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(sale.cashbackUsed)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(sale.netValue)}
                    </TableCell>
                    <TableCell className="text-blue-600">
                      {formatCurrency(sale.cashbackGenerated)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSale(sale.id)}
                          disabled={deletingSaleId === sale.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Excluir venda (apenas administradores)"
                        >
                          {deletingSaleId === sale.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
