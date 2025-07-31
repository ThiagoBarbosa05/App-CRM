import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, DollarSign, Users, History, Calculator, TrendingUp, Wallet, Clock, AlertTriangle, Filter } from "lucide-react";
import { formatDate } from "@/lib/utils";

import CashbackUsageModal from "@/components/cashback-usage-modal";

export default function Cashback() {
  const [activeTab, setActiveTab] = useState("cashback");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  // Buscar transações de cashback
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/cashback-transactions"],
  });

  // Buscar saldos de cashback
  const { data: balances = [] } = useQuery({
    queryKey: ["/api/cashback-balances"],
  });

  // Buscar configurações de cashback
  const { data: settings = [] } = useQuery({
    queryKey: ["/api/cashback-settings"],
  });

  // Buscar histórico de resgates
  const { data: allUsage = [] } = useQuery({
    queryKey: ["/api/cashback-usage"],
  });

  // Buscar usuários para o filtro
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const formatCurrency = (value: string | number) => {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numericValue);
  };

  // Calcular estatísticas
  const totalCashback = transactions
    .filter((t: any) => t.status === 'approved')
    .reduce((sum: number, t: any) => sum + parseFloat(t.cashbackAmount), 0);

  const activeClients = balances.filter((b: any) => parseFloat(b.currentBalance) > 0).length;

  const averageRate = settings.length > 0
    ? settings.reduce((sum: number, s: any) => sum + parseFloat(s.percentageRate), 0) / settings.length
    : 0;

  // Filtrar saldos por usuário responsável
  const filteredBalances = selectedUserId === "all" 
    ? balances 
    : balances.filter((balance: any) => balance.responsibleUser?.id === selectedUserId);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Gift className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sistema de Cashback</h1>
              <p className="text-gray-600">Gerencie programa de cashback e recompensas para clientes</p>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="balances">Saldos</TabsTrigger>
              <TabsTrigger value="transactions">Transações</TabsTrigger>
              <TabsTrigger value="usage">Resgates</TabsTrigger>
              <TabsTrigger value="reports">Relatórios</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total em Cashback</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalCashback)}</div>
                    <p className="text-xs text-muted-foreground">Total distribuído em cashback</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeClients}</div>
                    <p className="text-xs text-muted-foreground">Com saldo de cashback</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa Média</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{averageRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Taxa de cashback média</p>
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
                  <CardDescription>Cashbacks que vencem nos próximos 7 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Filtrar transações que vencem nos próximos 7 dias e ainda estão válidas
                    const today = new Date();
                    const sevenDaysFromNow = new Date();
                    sevenDaysFromNow.setDate(today.getDate() + 7);

                    const expiringTransactions = transactions.filter((transaction: any) => {
                      if (!transaction.expiresAt || transaction.status !== 'approved') return false;
                      
                      const expiryDate = new Date(transaction.expiresAt);
                      return expiryDate > today && expiryDate <= sevenDaysFromNow;
                    });

                    if (expiringTransactions.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cashback vencendo</h3>
                          <p className="text-gray-500">
                            Não há cashbacks próximos do vencimento nos próximos 7 dias.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {expiringTransactions.slice(0, 5).map((transaction: any) => {
                          const expiryDate = new Date(transaction.expiresAt);
                          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          
                          return (
                            <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-200">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{transaction.client?.name || 'Cliente'}</p>
                                  <p className="text-sm text-gray-600">
                                    Compra de {formatCurrency(transaction.purchaseAmount)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-orange-700">
                                  {formatCurrency(transaction.cashbackAmount)}
                                </p>
                                <p className="text-sm text-orange-600 font-medium">
                                  {daysUntilExpiry === 1 ? 'Vence amanhã!' : `Vence em ${daysUntilExpiry} dias`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {expiringTransactions.length > 5 && (
                          <div className="text-center pt-4">
                            <p className="text-sm text-orange-600">
                              E mais {expiringTransactions.length - 5} cashbacks vencendo...
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balances" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Saldos de Cashback</CardTitle>
                      <CardDescription>Visualize e gerencie os saldos de cashback de todos os clientes</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filtrar por usuário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os usuários</SelectItem>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredBalances.length === 0 ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {selectedUserId === "all" ? "Nenhum saldo" : "Nenhum saldo encontrado"}
                      </h3>
                      <p className="text-gray-500">
                        {selectedUserId === "all" 
                          ? "Os saldos de cashback aparecerão aqui conforme os clientes acumularem pontos."
                          : "Nenhum cliente com saldo de cashback encontrado para o usuário selecionado."
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredBalances.map((balance: any) => (
                        <div key={balance.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Wallet className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{balance.client?.name || 'Cliente'}</p>
                              <p className="text-sm text-gray-500">
                                Total acumulado: {formatCurrency(balance.totalEarned || 0)}
                              </p>
                            </div>
                            <div className="text-sm text-gray-600 min-w-[150px] text-center">
                              <p className="font-medium text-gray-700">Responsável</p>
                              <p className="text-gray-500">{balance.responsibleUser?.name || 'Não definido'}</p>
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
                  <CardDescription>Todas as movimentações de cashback: compras que geraram pontos e resgates realizados</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Combinar transações de cashback (ganhos) e resgates (uso)
                    const allTransactions = [
                      // Transações de cashback (ganhos)
                      ...transactions.map((t: any) => ({
                        ...t,
                        type: 'earn',
                        date: new Date(t.createdAt),
                        amount: parseFloat(t.cashbackAmount),
                        description: `Compra de ${formatCurrency(t.purchaseAmount)} • ${parseFloat(t.cashbackRate).toFixed(1)}% cashback`
                      })),
                      // Resgates (uso)
                      ...allUsage.map((u: any) => ({
                        ...u,
                        type: 'redeem',
                        date: new Date(u.createdAt),
                        amount: -parseFloat(u.usedAmount),
                        description: u.description || 'Resgate de cashback'
                      }))
                    ].sort((a, b) => b.date.getTime() - a.date.getTime()); // Ordenar por data (mais recente primeiro)

                    return allTransactions.length === 0 ? (
                      <div className="text-center py-8">
                        <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma transação</h3>
                        <p className="text-gray-500">
                          As transações de cashback e resgates aparecerão aqui conforme forem realizados.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {allTransactions.map((transaction: any, index: number) => (
                          <div key={`${transaction.type}-${transaction.id}-${index}`} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                transaction.type === 'earn' ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                {transaction.type === 'earn' ? (
                                  <Gift className="h-5 w-5 text-green-600" />
                                ) : (
                                  <Wallet className="h-5 w-5 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{transaction.client?.name || 'Cliente'}</p>
                                  <Badge 
                                    variant="outline"
                                    className={transaction.type === 'earn' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}
                                  >
                                    {transaction.type === 'earn' ? 'Ganho' : 'Resgate'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500">
                                  {transaction.description}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {transaction.date.toLocaleDateString('pt-BR')} às {transaction.date.toLocaleTimeString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium ${
                                transaction.type === 'earn' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'earn' ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                              </p>
                              {transaction.type === 'earn' && (
                                <Badge 
                                  variant={transaction.status === 'approved' ? 'default' : 'secondary'}
                                  className={transaction.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                                >
                                  {transaction.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                </Badge>
                              )}
                              {transaction.type === 'redeem' && (
                                <Badge className="bg-red-100 text-red-800">
                                  Resgatado
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
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
                  <CardDescription>Registro de todos os resgates de cashback realizados pelos clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  {allUsage.length === 0 ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum resgate</h3>
                      <p className="text-gray-500">
                        Os resgates de cashback aparecerão aqui quando realizados.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allUsage.map((usage: any) => (
                        <div key={usage.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                              <Wallet className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium">{usage.client?.name || 'Cliente'}</p>
                              <p className="text-sm text-gray-500">{usage.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-red-600">
                              -{formatCurrency(usage.usedAmount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(usage.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Distribuído</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalCashback)}</div>
                    <p className="text-xs text-muted-foreground">Em cashback acumulado</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Resgatado</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(allUsage.reduce((sum: number, usage: any) => sum + parseFloat(usage.usedAmount || 0), 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">Em resgates realizados</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Pendente</CardTitle>
                    <Gift className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(balances.reduce((sum: number, balance: any) => sum + parseFloat(balance.currentBalance || 0), 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">Disponível para resgate</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transações</CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{transactions.length}</div>
                    <p className="text-xs text-muted-foreground">Total de transações</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top 5 Clientes por Cashback</CardTitle>
                    <CardDescription>Clientes com maior saldo acumulado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {balances
                        .sort((a: any, b: any) => parseFloat(b.totalEarned || 0) - parseFloat(a.totalEarned || 0))
                        .slice(0, 5)
                        .map((balance: any, index: number) => (
                          <div key={balance.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{balance.client?.name || 'Cliente'}</p>
                                <p className="text-sm text-gray-500">
                                  Saldo: {formatCurrency(balance.currentBalance || 0)}
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
                    <CardDescription>Regras de cashback em vigência</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {settings
                        .filter((setting: any) => setting.isActive === 'true')
                        .map((setting: any) => (
                          <div key={setting.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium">{setting.name}</p>
                              <p className="text-sm text-gray-500">
                                Mín: {formatCurrency(setting.minimumPurchase || 0)}
                                {setting.maximumCashback && ` • Máx: ${formatCurrency(setting.maximumCashback)}`}
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              {parseFloat(setting.percentageRate).toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      {settings.filter((setting: any) => setting.isActive === 'true').length === 0 && (
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
    </div>
  );
}