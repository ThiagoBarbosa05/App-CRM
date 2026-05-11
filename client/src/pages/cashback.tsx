import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import CashbackReports from "@/components/CashbackReports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gift,
  DollarSign,
  History,
  Calculator,
  Wallet,
  Percent,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import CashbackUsageModal from "@/components/cashback-usage-modal";
import { SalesManagementTab } from "@/components/sales-manegement-tab";
import { CashbackStatsCards } from "@/components/cashback-stats-cards";
import { ExpiringCashbacks } from "@/components/expiring-cashbacks";
import { CashbackBalancesList } from "@/components/cashback-balances-list";
import { CashbackTransactionsList } from "@/components/cashback-transactions-list";
import { CashbackUsageList } from "@/components/cashback-usage-list";
import { PageHeader } from "@/components/page-header";
import { motion, AnimatePresence } from "framer-motion";

// Interfaces
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface CashbackBalance {
  currentBalance: string;
  totalEarned: string;
  totalUsed: string;
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

interface CashbackStatistics {
  totalCashback: number;
  activeClients: number;
  averageRate: number;
  totalClients: number;
  totalTransactions: number;
  totalSettings: number;
}

// Função para formatar valores em moeda brasileira
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
};

export default function Cashback() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [deletingBalance, setDeletingBalance] = useState<any>(null);

  // Estados para vendas
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClientBalance, setSelectedClientBalance] = useState<number>(0);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [debouncedClientSearch, setDebouncedClientSearch] =
    useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [useCashback, setUseCashback] = useState<boolean>(true); // Controla se deve usar cashback
  const [saleForm, setSaleForm] = useState<SaleForm>({
    clientId: "",
    date: new Date().toISOString().split("T")[0],
    grossValue: "",
    notes: "",
    invoiceNumber: "",
  });

  const { toast } = useToast();
  const { user } = useAuth();

  // Verificar se o usuário é administrador
  const isAdmin = user?.role === "administrador" || user?.role === "admin";

  // useEffect para carregar dados de vendas
  useEffect(() => {
    loadClients();
    loadSales();
  }, []);

  // useEffect para debounce da busca de clientes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedClientSearch(clientSearchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [clientSearchQuery]);

  // Buscar configurações de cashback (ainda necessário para sales)
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-settings"],
  });

  // Buscar usuários para o filtro
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Buscar relatórios dos últimos 30 dias
  const { data: thirtyDaysReport = {} } = useQuery<any>({
    queryKey: ["/api/cashback-reports/30-days"],
  });

  // Buscar estatísticas de cashback da nova API otimizada
  // Esta API retorna todas as estatísticas em uma única requisição
  const {
    data: cashbackStats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    error: statsError,
  } = useQuery<CashbackStatistics>({
    queryKey: ["/api/cashback-settings/statistics"],
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos para melhor performance
    refetchOnWindowFocus: false, // Evita refetch desnecessário
    retry: 3, // Tentar novamente até 3 vezes em caso de erro
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
  });

  // Exibir toast de erro se a API de estatísticas falhar
  useEffect(() => {
    if (isStatsError && statsError) {
      console.error("Erro ao carregar estatísticas de cashback:", statsError);
      toast({
        title: "Erro",
        description:
          "Não foi possível carregar as estatísticas de cashback. Tentando novamente...",
        variant: "destructive",
      });
    }
  }, [isStatsError, statsError, toast]);

  // Funções para vendas
  const loadClients = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedClientSearch.trim()) {
        params.append("search", debouncedClientSearch);
      }
      params.append("pageSize", "5000"); // Buscar mais clientes

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []); // API retorna {data: [...]}
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  };

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

        setSaleForm({
          clientId: "",
          date: new Date().toISOString().split("T")[0],
          grossValue: "",
          notes: "",
          invoiceNumber: "",
        });
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
        queryClient.invalidateQueries({
          queryKey: ["/api/cashback-statistics"],
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

  const handleClientChange = (clientId: string) => {
    setSaleForm((prev) => ({ ...prev, clientId }));
    const selectedClient = clients.find((c) => c.id === clientId);
    setSelectedClientName(selectedClient?.name || "");
    loadClientBalance(clientId);
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

  // Recarregar clientes quando a busca mudar
  useEffect(() => {
    if (isDialogOpen) {
      loadClients();
    }
  }, [debouncedClientSearch, isDialogOpen]);

  // Mutation para excluir saldo de cashback
  const deleteBalanceMutation = useMutation({
    mutationFn: async (balanceId: string) => {
      const response = await fetch(`/api/cashback-balances/${balanceId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email || "",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir saldo");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Saldo excluído",
        description: "O saldo de cashback foi removido com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-statistics"],
      });
      setDeletingBalance(null);
    },
    onError: (error: any) => {
      console.error("Erro ao excluir saldo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o saldo de cashback.",
        variant: "destructive",
      });
    },
  });

  // Estados para exclusão de vendas
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);

  // Mutation para excluir venda
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
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
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-statistics"],
      });
      // Forçar refetch imediato dos dados críticos
      queryClient.refetchQueries({ queryKey: ["/api/sales"] });
      queryClient.refetchQueries({
        queryKey: ["/api/cashback-reports/30-days"],
      });
      queryClient.refetchQueries({
        queryKey: ["/api/cashback-statistics"],
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

  const formatCurrency = (value: string | number) => {
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numericValue);
  };

  // As estatísticas agora são fornecidas diretamente pela API otimizada
  // Isso elimina a necessidade de múltiplos cálculos no frontend

  return (
    <>
      <div className="space-y-6 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon icon={Gift} />
            <PageHeader.Text>
              <PageHeader.Title>Sistema de Cashback</PageHeader.Title>
              <PageHeader.Description>
                Gestão estratégica de recompensas, saldos e fidelização de clientes
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
        </PageHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
          <TabsList className="flex items-center justify-start gap-4 bg-transparent h-auto p-0 overflow-x-auto no-scrollbar">
            {[
              { id: "overview", label: "Visão Geral", icon: Gift, color: "blue" },
              { id: "sales", label: "Vendas", icon: DollarSign, color: "emerald" },
              { id: "balances", label: "Saldos", icon: Wallet, color: "purple" },
              { id: "transactions", label: "Transações", icon: History, color: "amber" },
              { id: "usage", label: "Resgates", icon: Percent, color: "rose" },
              { id: "reports", label: "Relatórios", icon: Calculator, color: "indigo" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={`group flex items-center gap-3 px-6 py-4 rounded-2xl border border-transparent transition-all duration-300
                  data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 
                  data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 
                  data-[state=active]:shadow-lg dark:data-[state=active]:shadow-blue-500/5 
                  hover:bg-white/50 dark:hover:bg-white/5`}
              >
                <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-data-[state=active]:bg-blue-500/10 transition-colors`}>
                  <tab.icon className={`h-4 w-4 text-slate-500 group-data-[state=active]:text-blue-500`} />
                </div>
                <span className="text-sm font-bold tracking-tight text-slate-500 group-data-[state=active]:text-slate-900 dark:group-data-[state=active]:text-white">
                  {tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >

            <TabsContent value="overview" className="space-y-6">
              <CashbackStatsCards
                statistics={cashbackStats}
                isLoading={isStatsLoading}
                formatCurrency={formatCurrency}
              />

              {/* Seção de Cashback Vencendo com filtros e ordenação */}
              <ExpiringCashbacks formatCurrency={formatCurrency} />
            </TabsContent>

            <TabsContent value="sales" className="space-y-6">
              <SalesManagementTab
                isDialogOpen={isDialogOpen}
                setIsDialogOpen={setIsDialogOpen}
              />
            </TabsContent>

            <TabsContent value="balances" className="space-y-6">
              <CashbackBalancesList
                formatCurrency={formatCurrency}
                users={users}
                onDeleteBalance={(balanceId) =>
                  setDeletingBalance({ id: balanceId })
                }
                isAdmin={isAdmin}
              />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <CashbackTransactionsList
                formatCurrency={formatCurrency}
                users={users}
              />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <CashbackUsageList
                formatCurrency={formatCurrency}
                users={users}
              />
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <CashbackReports />
            </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>

      <CashbackUsageModal
        client={selectedClient}
        open={usageModalOpen}
        onOpenChange={setUsageModalOpen}
      />

      <AlertDialog
        open={!!deletingBalance}
        onOpenChange={() => setDeletingBalance(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Saldo de Cashback</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o saldo de cashback de{" "}
              <strong>{deletingBalance?.client?.name}</strong>?
              <br />
              <br />
              <strong>Saldo atual:</strong>{" "}
              {deletingBalance &&
                formatCurrency(deletingBalance.currentBalance || 0)}
              <br />
              <strong>Total acumulado:</strong>{" "}
              {deletingBalance &&
                formatCurrency(deletingBalance.totalEarned || 0)}
              <br />
              <br />
              Esta ação irá remover permanentemente todo o histórico de cashback
              deste cliente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingBalance &&
                deleteBalanceMutation.mutate(deletingBalance.id)
              }
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteBalanceMutation.isPending}
            >
              {deleteBalanceMutation.isPending
                ? "Excluindo..."
                : "Excluir Saldo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
