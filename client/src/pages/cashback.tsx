import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Gift,
  DollarSign,
  Users,
  History,
  Calculator,
  TrendingUp,
  Wallet,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  Trash2,
  Plus,
  Receipt,
  Percent,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import CashbackUsageModal from "@/components/cashback-usage-modal";

// Interfaces
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface CashbackBalance {
  balance: number;
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
  const [activeTab, setActiveTab] = useState("cashback");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deletingBalance, setDeletingBalance] = useState<any>(null);
  
  // Estados para vendas
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClientBalance, setSelectedClientBalance] = useState<number>(0);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [saleForm, setSaleForm] = useState<SaleForm>({
    clientId: '',
    date: new Date().toISOString().split('T')[0],
    grossValue: ''
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

  // Buscar transações de cashback
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-transactions"],
  });

  // Buscar saldos de cashback
  const { data: balances = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-balances"],
  });

  // Buscar configurações de cashback
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-settings"],
  });

  // Buscar histórico de resgates
  const { data: allUsage = [] } = useQuery<any[]>({
    queryKey: ["/api/cashback-usage"],
  });

  // Buscar usuários para o filtro
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Buscar relatórios dos últimos 30 dias
  const { data: thirtyDaysReport = {} } = useQuery<any>({
    queryKey: ["/api/cashback-reports/30-days"],
  });

  // Funções para vendas
  const loadClients = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedClientSearch.trim()) {
        params.append('search', debouncedClientSearch);
      }
      params.append('pageSize', '50'); // Limitar a 50 resultados
      
      const response = await fetch(`/api/clients?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadSales = async () => {
    try {
      const response = await fetch('/api/sales');
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
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
        const data: CashbackBalance = await response.json();
        setSelectedClientBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar saldo de cashback:', error);
      setSelectedClientBalance(0);
    }
  };

  const calculateSaleValues = (grossValue: number, clientBalance: number) => {
    // Aplicar cashback existente (máximo 50% do valor bruto)
    const maxCashbackUsage = grossValue * 0.5;
    const cashbackUsed = Math.min(clientBalance, maxCashbackUsage);
    
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
    
    // Gerar novo cashback baseado na configuração
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
      cashbackRate: cashbackRate * 100 // Retornar em percentual para exibição
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!saleForm.clientId || !saleForm.date || !saleForm.grossValue) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const grossValue = parseFloat(saleForm.grossValue);
    if (grossValue <= 0) {
      toast({
        title: "Erro",
        description: "Valor da venda deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Primeiro calcular o cashback usando a API
      const cashbackResponse = await fetch('/api/calculate-cashback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ purchaseAmount: grossValue })
      });

      if (!cashbackResponse.ok) {
        throw new Error('Erro ao calcular cashback');
      }

      const cashbackData = await cashbackResponse.json();

      const saleData = {
        clientId: saleForm.clientId,
        date: saleForm.date,
        grossValue: grossValue,
        userId: user?.id
      };

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Venda registrada com sucesso!"
        });
        
        setSaleForm({
          clientId: '',
          date: new Date().toISOString().split('T')[0],
          grossValue: ''
        });
        setSelectedClientBalance(0);
        setSelectedClientName('');
        setIsDialogOpen(false);
        
        // Recarregar todos os dados relacionados
        await loadSales();
        queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cashback-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cashback-reports/30-days"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao registrar venda');
      }
    } catch (error) {
      console.error('Erro ao registrar venda:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao registrar venda",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSaleForm(prev => ({ ...prev, clientId }));
    const selectedClient = clients.find(c => c.id === clientId);
    setSelectedClientName(selectedClient?.name || '');
    loadClientBalance(clientId);
  };

  const previewValues = () => {
    const grossValue = parseFloat(saleForm.grossValue) || 0;
    const result = calculateSaleValues(grossValue, selectedClientBalance);
    
    // Buscar configuração ativa para obter a taxa real
    const activeSetting = settings.find((s: any) => s.isActive === "true");
    const actualRate = activeSetting ? parseFloat(activeSetting.percentageRate) : 0;
    
    return {
      ...result,
      actualRate
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
          "x-user-role": user?.role || "",
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
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-reports/30-days"] });
      // Forçar refetch imediato dos dados críticos
      queryClient.refetchQueries({ queryKey: ["/api/sales"] });
      queryClient.refetchQueries({ queryKey: ["/api/cashback-reports/30-days"] });
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
    if (!confirm("Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.")) {
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

  // Calcular estatísticas
  const totalCashback = transactions.reduce((sum: number, item: any) => {
    const t = item.cashback_transactions || item;
    if (t.status === "approved") {
      return sum + parseFloat(t.cashbackAmount || 0);
    }
    return sum;
  }, 0);

  const activeClients = balances.filter(
    (b: any) => parseFloat(b.currentBalance) > 0,
  ).length;

  const averageRate =
    settings.length > 0
      ? settings.reduce(
          (sum: number, s: any) => sum + parseFloat(s.percentageRate),
          0,
        ) / settings.length
      : 0;

  // Filtrar saldos por usuário responsável e pesquisa
  const filteredBalances = balances.filter((balance: any) => {
    // Filtro por usuário
    if (
      selectedUserId !== "all" &&
      balance.responsibleUser?.id !== selectedUserId
    ) {
      return false;
    }

    // Filtro por pesquisa (nome, telefone ou CPF)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const client = balance.client;

      if (!client) return false;

      const matchesName = client.name?.toLowerCase().includes(query);
      const matchesPhone = client.phone?.toLowerCase().includes(query);
      const matchesCpf = client.cpf?.toLowerCase().includes(query);

      return matchesName || matchesPhone || matchesCpf;
    }

    return true;
  });

  return (
    <div className="flex">
      <div className="flex-1 overflow-auto">
        <div className="  space-y-6">
          <div className="flex items-start gap-3 mb-6">
            <Gift className="h-8 w-8 shrink-0 text-green-600" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Sistema de Cashback
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Gerencie programa de cashback e recompensas para clientes
              </p>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-1 md:grid-cols-6">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="sales">Vendas</TabsTrigger>
              <TabsTrigger value="balances">Saldos</TabsTrigger>
              <TabsTrigger value="transactions">Transações</TabsTrigger>
              <TabsTrigger value="usage">Resgates</TabsTrigger>
              <TabsTrigger value="reports">Relatórios</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total em Cashback
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(totalCashback)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total distribuído em cashback
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Clientes Ativos
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeClients}</div>
                    <p className="text-xs text-muted-foreground">
                      Com saldo de cashback
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Taxa Média
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {averageRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Taxa de cashback média
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Seção de Cashback Vencendo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Cashback Vencendo 🧨
                  </CardTitle>
                  <CardDescription>
                    Cashbacks que vencem nos próximos 7 dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Filtrar transações que vencem nos próximos 7 dias e ainda estão válidas
                    const today = new Date();
                    const sevenDaysFromNow = new Date();
                    sevenDaysFromNow.setDate(today.getDate() + 7);

                    const expiringTransactions = transactions.filter(
                      (item: any) => {
                        const transaction = item.cashback_transactions || item;
                        if (
                          !transaction.expiresAt ||
                          transaction.status !== "approved"
                        )
                          return false;

                        const expiryDate = new Date(transaction.expiresAt);
                        return (
                          expiryDate > today && expiryDate <= sevenDaysFromNow
                        );
                      },
                    );

                    if (expiringTransactions.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum cashback vencendo
                          </h3>
                          <p className="text-gray-500">
                            Não há cashbacks próximos do vencimento nos próximos
                            7 dias.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {expiringTransactions.slice(0, 5).map((item: any) => {
                          const transaction =
                            item.cashback_transactions || item;
                          const client = item.clients || {};
                          const expiryDate = new Date(transaction.expiresAt);
                          const daysUntilExpiry = Math.ceil(
                            (expiryDate.getTime() - today.getTime()) /
                              (1000 * 60 * 60 * 24),
                          );

                          return (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {client.name || "Cliente"}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Compra de{" "}
                                    {formatCurrency(transaction.purchaseAmount)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-orange-700">
                                  {formatCurrency(transaction.cashbackAmount)}
                                </p>
                                <p className="text-sm text-orange-600 font-medium">
                                  {daysUntilExpiry === 1
                                    ? "Vence amanhã!"
                                    : `Vence em ${daysUntilExpiry} dias`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {expiringTransactions.length > 5 && (
                          <div className="text-center pt-4">
                            <p className="text-sm text-orange-600">
                              E mais {expiringTransactions.length - 5} cashbacks
                              vencendo...
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="space-y-6">
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
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Registrar Nova Venda</DialogTitle>
                    </DialogHeader>
                    
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
                                      saleForm.clientId === client.id ? 'bg-blue-50 border-blue-200' : ''
                                    }`}
                                    onClick={() => {
                                      handleClientChange(client.id);
                                      setClientSearchQuery(client.name);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium text-gray-900">{client.name}</span>
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
                              <div className="text-sm text-gray-600">
                                <strong>Cliente selecionado:</strong> {selectedClientName}
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
                            onChange={(e) => setSaleForm(prev => ({ ...prev, date: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="grossValue">Valor Bruto da Venda *</Label>
                        <Input
                          id="grossValue"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={saleForm.grossValue}
                          onChange={(e) => setSaleForm(prev => ({ ...prev, grossValue: e.target.value }))}
                          required
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
                              <Badge variant="secondary">
                                {formatCurrency(selectedClientBalance)}
                              </Badge>
                            </div>
                            
                            {saleForm.grossValue && (
                              <>
                                <div className="flex justify-between">
                                  <span>Valor Bruto:</span>
                                  <span>{formatCurrency(parseFloat(saleForm.grossValue))}</span>
                                </div>
                                
                                <div className="flex justify-between text-green-600">
                                  <span>Cashback Aplicado:</span>
                                  <span>-{formatCurrency(previewValues().cashbackUsed)}</span>
                                </div>
                                
                                <div className="flex justify-between font-semibold">
                                  <span>Valor Líquido a Pagar:</span>
                                  <span>{formatCurrency(previewValues().netValue)}</span>
                                </div>
                                
                                <div className="flex justify-between text-blue-600">
                                  <span>Novo Cashback Gerado ({previewValues().actualRate?.toFixed(1) || 0}%):</span>
                                  <span>+{formatCurrency(previewValues().cashbackGenerated)}</span>
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
                            setSelectedClientName("");
                            setSaleForm({
                              clientId: '',
                              date: new Date().toISOString().split('T')[0],
                              grossValue: ''
                            });
                            setSelectedClientBalance(0);
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
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
                    <CardTitle className="text-sm font-medium">Total de Vendas (30 dias)</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {thirtyDaysReport.salesCount || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 30 dias
                    </p>
                  </CardContent>
                </Card>

<Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total Bruto (30 dias)</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(thirtyDaysReport.totalSales || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 30 dias
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Valor de venda Líquida</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency((thirtyDaysReport.totalSales || 0) - (thirtyDaysReport.totalCashbackUsed || 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 30 dias
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cashback Utilizado (30 dias)</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(thirtyDaysReport.totalCashbackUsed || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 30 dias
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cashback Gerado (30 dias)</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(thirtyDaysReport.totalCashbackGenerated || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 30 dias
                    </p>
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
                        {isAdmin && (
                          <TableHead className="w-[100px]">Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                            Nenhuma venda registrada ainda.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">{sale.clientName}</TableCell>
                            <TableCell>
                              {new Date(sale.date).toLocaleDateString('pt-BR')}
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
            </TabsContent>

            <TabsContent value="balances" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-start gap-4 flex-col">
                    <div>
                      <CardTitle className="text-lg sm:text-2xl">
                        Saldos de Cashback
                      </CardTitle>
                      <CardDescription className="text-sm sm:text-base">
                        Visualize e gerencie os saldos de cashback de todos os
                        clientes
                      </CardDescription>
                    </div>
                    <div className="flex w-full flex-col sm:flex-row gap-2 items-start sm:items-center gap-2">
                      <div className="relative w-full flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          type="text"
                          placeholder="Buscar por nome, telefone ou CPF..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-full"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Select
                          value={selectedUserId}
                          onValueChange={setSelectedUserId}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filtrar por usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              Todos os usuários
                            </SelectItem>
                            {users.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredBalances.length === 0 ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {selectedUserId === "all" && !searchQuery.trim()
                          ? "Nenhum saldo"
                          : "Nenhum saldo encontrado"}
                      </h3>
                      <p className="text-gray-500">
                        {selectedUserId === "all" && !searchQuery.trim()
                          ? "Os saldos de cashback aparecerão aqui conforme os clientes acumularem pontos."
                          : searchQuery.trim()
                            ? "Nenhum cliente encontrado com os filtros aplicados. Tente uma busca diferente."
                            : "Nenhum cliente com saldo de cashback encontrado para o usuário selecionado."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredBalances.map((balance: any) => (
                        <div
                          key={balance.id}
                          className="flex items-center justify-between overflow-x-auto p-4 border rounded-lg"
                        >
                          <div className="flex items-start sm:items-center  gap-4 flex-1">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Wallet className="h-5 w-5 shrink-0 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium truncate">
                                {balance.client?.name || "Cliente"}
                              </p>
                              <p className="text-sm text-gray-500">
                                Total acumulado:{" "}
                                {formatCurrency(balance.totalEarned || 0)}
                              </p>
                            </div>
                            <div className="text-sm text-gray-600 min-w-[120px] text-center">
                              <p className="font-medium text-gray-700">
                                Responsável
                              </p>
                              <p className="text-gray-500">
                                {balance.responsibleUser?.name ||
                                  "Não definido"}
                              </p>
                            </div>
                            <div className="text-sm text-gray-600 min-w-[110px] text-center">
                              <p className="font-medium text-gray-700">
                                Primeiro Cashback
                              </p>
                              <p className="text-gray-500">
                                {balance.firstCashbackDate
                                  ? new Date(
                                      balance.firstCashbackDate,
                                    ).toLocaleDateString("pt-BR")
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="text-sm text-gray-600 min-w-[110px] text-center">
                              <p className="font-medium text-gray-700">
                                Próximo Vencimento
                              </p>
                              <p
                                className={`text-sm ${
                                  balance.nextExpiryDate
                                    ? new Date(
                                        balance.nextExpiryDate,
                                      ).getTime() -
                                        Date.now() <
                                      7 * 24 * 60 * 60 * 1000
                                      ? "text-orange-600 font-medium"
                                      : "text-gray-500"
                                    : "text-gray-500"
                                }`}
                              >
                                {balance.nextExpiryDate
                                  ? new Date(
                                      balance.nextExpiryDate,
                                    ).toLocaleDateString("pt-BR")
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-medium text-green-600">
                                {formatCurrency(balance.currentBalance || 0)}
                              </p>
                              <p className="text-sm text-gray-500">
                                Saldo disponível
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {parseFloat(balance.currentBalance || 0) > 0 && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    setSelectedClient(balance.client);
                                    setUsageModalOpen(true);
                                  }}
                                >
                                  Resgatar
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-600 hover:bg-red-50"
                                  onClick={() => setDeletingBalance(balance)}
                                  title="Excluir saldo de cashback (apenas administradores)"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Transações</CardTitle>
                  <CardDescription>
                    Todas as movimentações de cashback: compras que geraram
                    pontos e resgates realizados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Combinar transações de cashback (ganhos) e resgates (uso)
                    const allTransactions = [
                      // Transações de cashback (ganhos)
                      ...transactions.map((item: any) => {
                        const t = item.cashback_transactions || item;
                        const client = item.clients || {};
                        return {
                          ...t,
                          client,
                          type: "earn",
                          date: new Date(t.createdAt),
                          amount: parseFloat(t.cashbackAmount),
                          description: `Compra de ${formatCurrency(t.purchaseAmount)} • ${parseFloat(t.cashbackRate).toFixed(1)}% cashback`,
                        };
                      }),
                      // Resgates (uso)
                      ...allUsage.map((item: any) => {
                        const u = item.cashback_usage || item;
                        const client = item.clients || {};
                        return {
                          ...u,
                          client,
                          type: "redeem",
                          date: new Date(u.createdAt),
                          amount: -parseFloat(u.usedAmount),
                          description: u.description || "Resgate de cashback",
                        };
                      }),
                    ].sort((a, b) => b.date.getTime() - a.date.getTime()); // Ordenar por data (mais recente primeiro)

                    return allTransactions.length === 0 ? (
                      <div className="text-center py-8">
                        <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Nenhuma transação
                        </h3>
                        <p className="text-gray-500">
                          As transações de cashback e resgates aparecerão aqui
                          conforme forem realizados.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {allTransactions.map(
                          (transaction: any, index: number) => (
                            <div
                              key={`${transaction.type}-${transaction.id}-${index}`}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                    transaction.type === "earn"
                                      ? "bg-green-100"
                                      : "bg-red-100"
                                  }`}
                                >
                                  {transaction.type === "earn" ? (
                                    <Gift className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <Wallet className="h-5 w-5 text-red-600" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">
                                      {transaction.client?.name || "Cliente"}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className={
                                        transaction.type === "earn"
                                          ? "border-green-200 text-green-700"
                                          : "border-red-200 text-red-700"
                                      }
                                    >
                                      {transaction.type === "earn"
                                        ? "Ganho"
                                        : "Resgate"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {transaction.description}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {transaction.date.toLocaleDateString(
                                      "pt-BR",
                                    )}{" "}
                                    às{" "}
                                    {transaction.date.toLocaleTimeString(
                                      "pt-BR",
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-medium ${
                                    transaction.type === "earn"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {transaction.type === "earn" ? "+" : ""}
                                  {formatCurrency(Math.abs(transaction.amount))}
                                </p>
                                {transaction.type === "earn" && (
                                  <Badge
                                    variant={
                                      transaction.status === "approved"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={
                                      transaction.status === "approved"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }
                                  >
                                    {transaction.status === "approved"
                                      ? "Aprovado"
                                      : "Pendente"}
                                  </Badge>
                                )}
                                {transaction.type === "redeem" && (
                                  <Badge className="bg-red-100 text-red-800">
                                    Resgatado
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Resgates</CardTitle>
                  <CardDescription>
                    Registro de todos os resgates de cashback realizados pelos
                    clientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {allUsage.length === 0 ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Nenhum resgate
                      </h3>
                      <p className="text-gray-500">
                        Os resgates de cashback aparecerão aqui quando
                        realizados.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allUsage.map((item: any) => {
                        const usage = item.cashback_usage || item;
                        const client = item.clients || {};
                        return (
                          <div
                            key={usage.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                <Wallet className="h-4 w-4 text-red-600" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {client.name || "Cliente"}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {usage.description}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-red-600">
                                -{formatCurrency(usage.usedAmount)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(usage.createdAt).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Distribuído
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(totalCashback)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Em cashback acumulado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Resgatado
                    </CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        allUsage.reduce((sum: number, item: any) => {
                          const usage = item.cashback_usage || item;
                          return sum + parseFloat(usage.usedAmount || 0);
                        }, 0),
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Em resgates realizados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Saldo Pendente
                    </CardTitle>
                    <Gift className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        balances.reduce(
                          (sum: number, balance: any) =>
                            sum + parseFloat(balance.currentBalance || 0),
                          0,
                        ),
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Disponível para resgate
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Transações
                    </CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {transactions.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total de transações
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top 5 Clientes por Cashback</CardTitle>
                    <CardDescription>
                      Clientes com maior saldo acumulado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {balances
                        .sort(
                          (a: any, b: any) =>
                            parseFloat(b.totalEarned || 0) -
                            parseFloat(a.totalEarned || 0),
                        )
                        .slice(0, 5)
                        .map((balance: any, index: number) => (
                          <div
                            key={balance.id}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {balance.client?.name || "Cliente"}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Saldo:{" "}
                                  {formatCurrency(balance.currentBalance || 0)}
                                </p>
                              </div>
                            </div>
                            <p className="font-medium text-green-600">
                              {formatCurrency(balance.totalEarned || 0)}
                            </p>
                          </div>
                        ))}
                      {balances.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          Nenhum cliente com cashback ainda
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Configurações Ativas</CardTitle>
                    <CardDescription>
                      Regras de cashback em vigência
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {settings
                        .filter((setting: any) => setting.isActive === "true")
                        .map((setting: any) => (
                          <div
                            key={setting.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{setting.name}</p>
                              <p className="text-sm text-gray-500">
                                Mín:{" "}
                                {formatCurrency(setting.minimumPurchase || 0)}
                                {setting.maximumCashback &&
                                  ` • Máx: ${formatCurrency(setting.maximumCashback)}`}
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              {parseFloat(setting.percentageRate).toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      {settings.filter(
                        (setting: any) => setting.isActive === "true",
                      ).length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          Nenhuma regra ativa
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
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
    </div>
  );
}
