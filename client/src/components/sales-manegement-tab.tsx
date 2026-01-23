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
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { Client, ClientCashbackBalance } from "@shared/schema";
import { Bot as IBot } from "server/integrations/interfaces/bot";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CustomField } from "server/integrations/interfaces/create-contact";
import {
  useUmblerCashbackAutomation,
  useSyncUmblerCustomer,
  useCreateUmblerChat,
} from "@/hooks/use-umbler";
import ClientFormModal from "./client-form-modal";
import { SalesStatsCards } from "./sales-stats-cards";
import { SalesHistory } from "./sales-history";

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
  clientCurrentBalance?: number; // Saldo atual do cliente após a venda
}

interface SaleForm {
  clientId: string;
  date: string;
  grossValue: string;
  notes: string;
  invoiceNumber: string;
}

interface SalesStatistics {
  salesCount: number;
  totalSales: number;
  totalCashbackUsed: number;
  totalCashbackGenerated: number;
  netValue: number;
  averageSaleValue: number;
  period: string;
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
  const [umblerAutomationLoading, setUmblerAutomationLoading] = useState(false);
  const [useCashback, setUseCashback] = useState<boolean>(true); // Controla se deve usar cashback
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [debouncedClientSearch, setDebouncedClientSearch] =
    useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedClientBalance, setSelectedClientBalance] = useState<number>(0);

  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "administrador" || user?.role === "admin";

  // Hook para automação completa do Umbler
  const umblerCashbackAutomation = useUmblerCashbackAutomation(
    user?.id,
    user?.role
  );

  // Hooks individuais para funcionalidades específicas
  const syncCustomer = useSyncUmblerCustomer(user?.id, user?.role);
  const createChatMutation = useCreateUmblerChat(user?.id, user?.role);

  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-settings"],
  });

  // Buscar estatísticas de vendas da nova API otimizada
  const {
    data: salesStatsData,
    isLoading: isSalesStatsLoading,
    isError: isSalesStatsError,
    error: salesStatsError,
  } = useQuery<{ success: boolean; data: SalesStatistics }>({
    queryKey: ["/api/sales-statistics"],
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos para melhor performance
    refetchOnWindowFocus: false, // Evita refetch desnecessário
    retry: 3, // Tentar novamente até 3 vezes em caso de erro
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
  });

  const salesStats = salesStatsData?.data;

  const { data: umblerContact, isLoading: isLoadingUmblerContact } = useQuery<{
    id: string;
  } | null>({
    queryKey: ["umblerContactByPhone", selectedClient?.phone],
    queryFn: async () => {
      if (!selectedClient?.phone) return null;
      const response = await fetch(
        `/api/umbler/contacts/${selectedClient?.phone}`
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
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }
      return response.json();
    },
    enabled: !!selectedClient?.phone,
  });

  const contactId = umblerContact?.id;

  // useEffect para debounce da busca de clientes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedClientSearch(clientSearchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [clientSearchQuery]);

  // useEffect para carregar clientes quando a busca mudar
  useEffect(() => {
    if (isDialogOpen) {
      loadClients();
    }
  }, [debouncedClientSearch, isDialogOpen]);

  // Exibir toast de erro se a API de estatísticas de vendas falhar
  useEffect(() => {
    if (isSalesStatsError && salesStatsError) {
      console.error(
        "Erro ao carregar estatísticas de vendas:",
        salesStatsError
      );
      toast({
        title: "Erro",
        description:
          "Não foi possível carregar as estatísticas de vendas. Tentando novamente...",
        variant: "destructive",
      });
    }
  }, [isSalesStatsError, salesStatsError, toast]);

  // Função auxiliar para formatação de moeda (compatível com SalesStatsCards)
  const formatCurrencyForCards = (value: string | number): string => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return formatCurrency(numValue);
  };

  const loadClients = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedClientSearch.trim()) {
        params.append("search", debouncedClientSearch);
      }
      params.append("pageSize", "100"); // Limitar para performance

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []); // API retorna {data: [...]}
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  };

  const previewValues = () => {
    const grossValue = parseFloat(saleForm.grossValue) || 0;
    const result = calculateSaleValues(
      grossValue,
      selectedClientBalance,
      useCashback
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
    shouldUseCashback: boolean = true
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

    if (!selectedClient) {
      toast({
        title: "Erro",
        description: "Cliente deve estar selecionado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const saleData = {
        clientId: saleForm.clientId,
        date: saleForm.date,
        grossValue: grossValue,
        notes: saleForm.notes,
        invoiceNumber: saleForm.invoiceNumber,
        userId: user?.id,
        useCashback: useCashback,
      };

      // 1. Criar a venda
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao registrar venda");
      }

      const saleResult = await response.json();

      toast({
        title: "Sucesso",
        description: "Venda registrada com sucesso!",
      });

      // 2. Executar automação Umbler em paralelo (não bloquear o sucesso da venda)
      setUmblerAutomationLoading(true);

      // Buscar organizationId - você pode ajustar conforme sua implementação
      const organizationId = "aGx7Jh43-au36EGi"; // Ajustar conforme necessário

      umblerCashbackAutomation.mutate(
        {
          client: {
            id: selectedClient.id,
            name: selectedClient.name,
            phone: selectedClient.phone,
            email: selectedClient.email || undefined,
          },
          newBalance: saleResult.clientCurrentBalance || 0,
          organizationId,
        },
        {
          onSettled: () => setUmblerAutomationLoading(false),
        }
      );

      // 3. Limpar formulário e recarregar dados
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
      setClientSearchQuery("");
      setDebouncedClientSearch("");
      setClients([]);
      setUseCashback(true);
      setIsDialogOpen(false);

      // Recarregar todos os dados relacionados
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-reports/30-days"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
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
    setClientSearchQuery(""); // Limpar busca após selecionar
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
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-statistics"] });
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
        "Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    setDeletingSaleId(saleId);
    deleteSaleMutation.mutate(saleId);
  };

  return (
    <div className="space-y-6 mt-5">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Vendas
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Gerencie vendas e cashback automaticamente
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 font-semibold">
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[95vh] overflow-y-auto">
            <AlertDialogHeader>
              <DialogTitle>Registrar Nova Venda</DialogTitle>
            </AlertDialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="client" className="text-sm font-medium">
                    Cliente *
                  </Label>
                  <div className="space-y-3">
                    {!saleForm.clientId && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Buscar por nome, CPF ou telefone..."
                            value={clientSearchQuery}
                            onChange={(e) =>
                              setClientSearchQuery(e.target.value)
                            }
                            className="pl-10 h-11"
                          />
                        </div>
                        {clientSearchQuery.trim() && clients.length > 0 && (
                          <div className="border rounded-lg max-h-48 overflow-y-auto shadow-sm">
                            {clients.map((client) => (
                              <div
                                key={client.id}
                                className="p-4 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                                onClick={() => {
                                  handleClientChange(client.id);
                                }}
                              >
                                <div className="flex flex-col space-y-1">
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
                          <div className="border rounded-lg p-6 text-center text-sm text-gray-500 bg-gray-50">
                            <div className="flex flex-col items-center space-y-3">
                              <Search className="h-8 w-8 text-gray-300" />
                              <span>Nenhum cliente encontrado</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsClientModalOpen(true)}
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar Cliente
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {saleForm.clientId && selectedClientName && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 sm:space-y-0">
                        <div className="text-sm text-gray-700 space-y-1">
                          <div>
                            <strong>Cliente selecionado:</strong>{" "}
                            {selectedClientName}
                          </div>
                          {selectedClientBalance > 0 && (
                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Saldo disponível:{" "}
                              <span className="font-bold">
                                {formatCurrency(selectedClientBalance)}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClient(null);
                            setSelectedClientName("");
                            setClientSearchQuery("");
                            setSelectedClientBalance(0);
                            setSaleForm((prev) => ({ ...prev, clientId: "" }));
                          }}
                          className="shrink-0"
                        >
                          Alterar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium">
                    Data da Venda *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={saleForm.date}
                    onChange={(e) =>
                      setSaleForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="h-11"
                    required
                  />
                </div>
              </div>

              {/* Umbler Status Section */}
              {selectedClient && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Automação de Cashback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUmblerContact || isLoadingChats ? (
                      <div className="flex items-center gap-3 text-sm text-blue-600">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Verificando status na Umbler...</span>
                      </div>
                    ) : !umblerContact ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-800">
                          <Info className="h-5 w-5" />
                          <span className="font-medium">Ação Necessária</span>
                        </div>
                        <p className="text-sm text-blue-700 leading-relaxed">
                          Sincronize este contato com a Umbler para poder
                          disparar o bot de cashback automaticamente.
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
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <RefreshCcw
                            className={cn(
                              "size-4 mr-2",
                              syncCustomer.isPending && "animate-spin"
                            )}
                          />
                          {syncCustomer.isPending
                            ? "Sincronizando..."
                            : "Sincronizar com Umbler"}
                        </Button>
                      </div>
                    ) : !contactChat || contactChat.items.length === 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-800">
                          <Info className="h-5 w-5" />
                          <span className="font-medium">Chat não iniciado</span>
                        </div>
                        <p className="text-sm text-amber-700 leading-relaxed">
                          Este cliente ainda não tem um chat no WhatsApp. Crie
                          um para enviar o cashback automaticamente.
                        </p>
                        <Button
                          type="button"
                          disabled={createChatMutation.isPending || !contactId}
                          onClick={() =>
                            createChatMutation.mutate(
                              { contactId: contactId! },
                              {
                                onSuccess: () => {
                                  // Invalidar queries específicas para forçar atualização da UI
                                  queryClient.invalidateQueries({
                                    queryKey: ["contactChat", selectedClient?.phone],
                                  });
                                  queryClient.invalidateQueries({
                                    queryKey: ["umblerContactByPhone", selectedClient?.phone],
                                  });
                                },
                              }
                            )
                          }
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700"
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
                      <div className="flex items-center gap-3 text-green-700 font-medium text-sm">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span>
                          Prontinho! O bot de cashback será disparado após
                          registrar a venda.
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="grossValue" className="text-sm font-medium">
                    Valor Bruto da Venda *
                  </Label>
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
                    className="h-11 text-lg font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="invoiceNumber"
                    className="text-sm font-medium"
                  >
                    Número da Nota Fiscal
                  </Label>
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
                    className="h-11"
                  />
                </div>
              </div>

              {/* Cashback Option */}
              {saleForm.clientId && selectedClientBalance > 0 && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="useCashback"
                      checked={useCashback}
                      onChange={(e) => setUseCashback(e.target.checked)}
                      className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded mt-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="useCashback"
                        className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                      >
                        Usar saldo de cashback disponível (
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(selectedClientBalance)}
                        </span>
                        )
                      </Label>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {useCashback
                          ? "O cashback será aplicado automaticamente na venda"
                          : "O cashback não será usado nesta venda"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Observações da Venda
                </Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Adicione observações sobre a venda..."
                  value={saleForm.notes}
                  onChange={(e) =>
                    setSaleForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="h-11"
                />
              </div>

              {/* Sale Summary */}
              {saleForm.clientId && (
                <Card className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-800 dark:text-slate-200">
                      Resumo da Venda
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Saldo de Cashback Disponível:
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-sm font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                        >
                          {formatCurrency(selectedClientBalance)}
                        </Badge>
                        {selectedClientBalance > 0 && (
                          <Badge
                            variant={useCashback ? "default" : "outline"}
                            className={cn(
                              "text-xs font-medium",
                              useCashback
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
                                : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                            )}
                          >
                            {useCashback ? "Será usado" : "Não será usado"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {saleForm.grossValue && (
                      <div className="space-y-3 pt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Valor Bruto:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(parseFloat(saleForm.grossValue))}
                          </span>
                        </div>

                        <div
                          className={cn(
                            "flex justify-between items-center",
                            useCashback && previewValues().cashbackUsed > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-gray-500 dark:text-gray-400"
                          )}
                        >
                          <span className="text-sm">Cashback Aplicado:</span>
                          <span className="font-semibold">
                            {useCashback && previewValues().cashbackUsed > 0
                              ? `-${formatCurrency(
                                  previewValues().cashbackUsed
                                )}`
                              : formatCurrency(0)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Valor Líquido a Pagar:
                          </span>
                          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(previewValues().netValue)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                          <span className="text-sm font-medium">
                            Novo Cashback Gerado (
                            <span className="font-semibold text-blue-700 dark:text-blue-300">
                              {previewValues().actualRate?.toFixed(1) || 0}%
                            </span>
                            ):
                          </span>
                          <span className="font-bold text-blue-700 dark:text-blue-300">
                            +{formatCurrency(previewValues().cashbackGenerated)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setClientSearchQuery("");
                    setDebouncedClientSearch("");
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
                    setClients([]);
                  }}
                  className="flex-1 sm:flex-none h-11"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !isUmblerReady}
                  className="flex-1 sm:flex-none h-11 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="font-medium">Registrando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="font-semibold">Registrar Venda</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sales Statistics - Componente otimizado */}
      <SalesStatsCards
        statistics={salesStats}
        isLoading={isSalesStatsLoading}
        formatCurrency={formatCurrencyForCards}
      />

      {/* Sales History - Componente otimizado com filtros, ordenação e paginação */}
      <SalesHistory />

      {/* Modal de Cadastro de Cliente */}
      <ClientFormModal
        open={isClientModalOpen}
        onOpenChange={(open) => {
          setIsClientModalOpen(open);
          if (!open) {
            // Quando o modal fechar, recarregar a lista de clientes
            // Se um cliente foi criado, aparecerá na nova busca
            setTimeout(() => {
              loadClients();
            }, 500);
          }
        }}
      />
    </div>
  );
}
