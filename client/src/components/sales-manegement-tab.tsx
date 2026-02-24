import {
  ArrowRight,
  Bot,
  CalendarIcon,
  DollarSign,
  Hash,
  Info,
  Loader2,
  MessageSquareMore,
  Percent,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="space-y-10 mt-8">
      {/* Header Section Premium */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
            Gestão de <span className="text-blue-600 dark:text-blue-400">Vendas</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
            Registre e acompanhe o histórico de transações da loja.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-8 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95">
              <Plus className="h-5 w-5 mr-3" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
            
            <CardHeader className="relative px-10 py-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/10 rounded-2xl p-3 text-blue-600">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Registrar <span className="text-blue-600 dark:text-blue-400">Nova Venda</span>
                  </DialogTitle>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Preencha os dados abaixo para computar o cashback.
                  </p>
                </div>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="client" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Cliente *
                  </Label>
                  <div className="space-y-3">
                    {!saleForm.clientId && (
                      <>
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Input
                            placeholder="Buscar por nome, CPF ou telefone..."
                            value={clientSearchQuery}
                            onChange={(e) =>
                              setClientSearchQuery(e.target.value)
                            }
                            className="pl-12 h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 font-bold transition-all"
                          />
                        </div>
                        {clientSearchQuery.trim() && clients.length > 0 && (
                          <div className="absolute z-50 w-full mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                            {clients.map((client) => (
                              <div
                                key={client.id}
                                className="p-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors"
                                onClick={() => {
                                  handleClientChange(client.id);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">
                                    {client.name}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {client.cpf} • {client.phone}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {clientSearchQuery.trim() && clients.length === 0 && (
                          <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex flex-col items-center space-y-4">
                              <Search className="h-8 w-8 text-slate-300" />
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nenhum cliente encontrado</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsClientModalOpen(true)}
                                className="h-10 px-6 rounded-xl border-blue-200 text-blue-600 font-black uppercase tracking-widest text-[10px] hover:bg-blue-50"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar Novo
                              </Button>
                            </div>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setIsClientModalOpen(true)}
                          className="p-0 h-auto text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                        >
                          + Novo Cadastro
                        </Button>
                      </>
                    )}
                    {saleForm.clientId && selectedClientName && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-3 sm:space-y-0"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-500/10 p-2.5 rounded-xl">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Cliente Selecionado</p>
                            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm leading-none mt-1">{selectedClientName}</p>
                            {selectedClientBalance > 0 && (
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                                Saldo: {formatCurrency(selectedClientBalance)}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedClient(null);
                            setSelectedClientName("");
                            setClientSearchQuery("");
                            setSelectedClientBalance(0);
                            setSaleForm((prev) => ({ ...prev, clientId: "" }));
                          }}
                          className="h-9 w-9 p-0 rounded-full hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Data da Venda *
                  </Label>
                  <div className="relative group">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                      id="date"
                      type="date"
                      value={saleForm.date}
                      onChange={(e) =>
                        setSaleForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="pl-12 h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 font-bold transition-all"
                      required
                    />
                  </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="grossValue" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Valor Bruto da Venda *
                  </Label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
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
                      className="pl-12 h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-emerald-500/5 font-black text-xl transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="invoiceNumber" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Número da Nota Fiscal
                  </Label>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
                      className="pl-12 h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 font-bold transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Cashback Option Polished */}
              {saleForm.clientId && selectedClientBalance > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-[2rem] border transition-all duration-300 ${
                    useCashback
                      ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl transition-colors ${
                        useCashback ? "bg-emerald-500/20 text-emerald-600" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}>
                        <Percent className="h-6 w-6" />
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${
                          useCashback ? "text-emerald-600" : "text-slate-400"
                        }`}>Cashback Disponível</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">
                          {formatCurrency(selectedClientBalance)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${
                         useCashback ? "text-emerald-600" : "text-slate-400"
                       }`}>{useCashback ? "Aplicado" : "Não usar"}</span>
                       <button
                         type="button"
                         onClick={() => setUseCashback(!useCashback)}
                         className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                           useCashback ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                         }`}
                       >
                         <span
                           className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                             useCashback ? "translate-x-7" : "translate-x-1"
                           }`}
                         />
                       </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="space-y-3">
                <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Observações da Transação
                </Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Detalhes adicionais sobre a venda..."
                  value={saleForm.notes}
                  onChange={(e) =>
                    setSaleForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/5 transition-all"
                />
              </div>

              {/* Sale Summary Premium */}
              {saleForm.clientId && saleForm.grossValue && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 space-y-5 shadow-inner"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subtotal</span>
                    <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums">{formatCurrency(parseFloat(saleForm.grossValue))}</span>
                  </div>
                  
                  {useCashback && previewValues().cashbackUsed > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Cashback Utilizado</span>
                      <span className="font-black text-emerald-600 tabular-nums">-{formatCurrency(previewValues().cashbackUsed)}</span>
                    </div>
                  )}

                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Total Líquido</span>
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">
                      {formatCurrency(previewValues().netValue)}
                    </span>
                  </div>

                  <div className="bg-blue-500/10 px-5 py-4 rounded-2xl flex items-center justify-between border border-blue-500/10">
                    <div className="flex items-center gap-3">
                       <ArrowRight className="h-5 w-5 text-blue-600" />
                       <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Recompensa</p>
                         <p className="text-[10px] font-bold text-blue-500/70 uppercase">Taxa: {previewValues().actualRate?.toFixed(1)}%</p>
                       </div>
                    </div>
                    <span className="text-xl font-black text-blue-600 tabular-nums">+{formatCurrency(previewValues().cashbackGenerated)}</span>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  type="button"
                  variant="ghost"
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
                  className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-all"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !isUmblerReady}
                  className="flex-1 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95"
                >
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-3" />
                      Registrar Venda
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
