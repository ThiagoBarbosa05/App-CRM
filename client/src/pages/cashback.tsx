import { useState } from "react";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, DollarSign, Users, History, Calculator, TrendingUp } from "lucide-react";

export default function Cashback() {
  const [activeTab, setActiveTab] = useState("cashback");

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
                    <div className="text-2xl font-bold">R$ 12.450,00</div>
                    <p className="text-xs text-muted-foreground">+20.1% em relação ao mês anterior</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2.350</div>
                    <p className="text-xs text-muted-foreground">+180 novos este mês</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa Média</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2.5%</div>
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
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Gift className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Maria Silva</p>
                          <p className="text-sm text-gray-500">Compra de R$ 500,00</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">+R$ 12,50</p>
                        <p className="text-sm text-gray-500">2.5% cashback</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Calculator className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">João Santos</p>
                          <p className="text-sm text-gray-500">Resgate de cashback</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-600">-R$ 25,00</p>
                        <p className="text-sm text-gray-500">Resgate</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Gift className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Ana Costa</p>
                          <p className="text-sm text-gray-500">Compra de R$ 1.200,00</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">+R$ 30,00</p>
                        <p className="text-sm text-gray-500">2.5% cashback</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações do Programa</CardTitle>
                  <CardDescription>Configure as regras e parâmetros do cashback</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Em Desenvolvimento</h3>
                    <p className="text-gray-500">
                      Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
                    </p>
                  </div>
                </CardContent>
              </Card>
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