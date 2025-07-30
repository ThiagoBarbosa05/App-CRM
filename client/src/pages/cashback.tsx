import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, DollarSign, Users, History, Calculator, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/utils";
import CashbackSettingsManagement from "@/components/cashback-settings-management";

export default function Cashback() {
  const [activeTab, setActiveTab] = useState("cashback");

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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
              <TabsTrigger value="transactions">Transações</TabsTrigger>
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

              <Card>
                <CardHeader>
                  <CardTitle>Transações Recentes</CardTitle>
                  <CardDescription>Últimas atividades de cashback do sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma transação</h3>
                      <p className="text-gray-500">
                        As transações de cashback aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.slice(0, 5).map((transaction: any) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              transaction.status === 'approved' ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                              <Gift className={`h-4 w-4 ${
                                transaction.status === 'approved' ? 'text-green-600' : 'text-yellow-600'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium">{transaction.client?.name || 'Cliente'}</p>
                              <p className="text-sm text-gray-500">
                                Compra de {formatCurrency(transaction.purchaseAmount)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">
                              +{formatCurrency(transaction.cashbackAmount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {parseFloat(transaction.cashbackRate).toFixed(1)}% cashback
                            </p>
                          </div>
                        </div>
                      ))}
                      {transactions.length > 5 && (
                        <div className="text-center pt-4">
                          <p className="text-sm text-gray-500">
                            E mais {transactions.length - 5} transações...
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <CashbackSettingsManagement />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Transações</CardTitle>
                  <CardDescription>Todas as transações de cashback do sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Em Desenvolvimento</h3>
                    <p className="text-gray-500">
                      Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Relatórios de Cashback</CardTitle>
                  <CardDescription>Análises e métricas do programa de cashback</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Em Desenvolvimento</h3>
                    <p className="text-gray-500">
                      Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}