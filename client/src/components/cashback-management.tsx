
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, DialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Percent, Gift, Users, History, Plus, Edit, Trash2, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CashbackSetting {
  id: string;
  name: string;
  description?: string;
  percentageRate: string;
  minimumPurchase: string;
  maximumCashback?: string;
  validUntil?: string;
  isActive: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CashbackTransaction {
  id: string;
  clientId: string;
  dealId?: string;
  purchaseAmount: string;
  cashbackAmount: string;
  cashbackRate: string;
  status: "pending" | "approved" | "paid" | "cancelled";
  settingId?: string;
  notes?: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    phone: string;
  };
}

interface ClientCashbackBalance {
  id: string;
  clientId: string;
  totalEarned: string;
  totalUsed: string;
  currentBalance: string;
  lastUpdated: string;
  client: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function CashbackManagement() {
  const { toast } = useToast();
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<CashbackSetting | null>(null);
  const [deletingSetting, setDeleteingSetting] = useState<CashbackSetting | null>(null);
  const [calculatorAmount, setCalculatorAmount] = useState("");
  const [calculatorResult, setCalculatorResult] = useState<any>(null);

  // Formulário de configuração
  const [settingForm, setSettingForm] = useState({
    name: "",
    description: "",
    percentageRate: "",
    minimumPurchase: "",
    maximumCashback: "",
    validUntil: "",
    isActive: "true",
  });

  // Formulário de transação
  const [transactionForm, setTransactionForm] = useState({
    clientId: "",
    purchaseAmount: "",
    notes: "",
  });

  // Queries
  const { data: settings = [] } = useQuery<CashbackSetting[]>({
    queryKey: ["/api/cashback-settings"],
  });

  const { data: transactions = [] } = useQuery<CashbackTransaction[]>({
    queryKey: ["/api/cashback-transactions"],
  });

  const { data: balances = [] } = useQuery<ClientCashbackBalance[]>({
    queryKey: ["/api/cashback-balances"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Mutations
  const createSettingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/cashback-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-settings"] });
      setIsSettingModalOpen(false);
      resetSettingForm();
      toast({ title: "Configuração criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar configuração", variant: "destructive" });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await apiRequest("PUT", `/api/cashback-settings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-settings"] });
      setIsSettingModalOpen(false);
      setEditingSetting(null);
      resetSettingForm();
      toast({ title: "Configuração atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar configuração", variant: "destructive" });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/cashback-settings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-settings"] });
      setDeleteingSetting(null);
      toast({ title: "Configuração excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir configuração", variant: "destructive" });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/cashback-transactions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      setIsTransactionModalOpen(false);
      resetTransactionForm();
      toast({ title: "Transação criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar transação", variant: "destructive" });
    },
  });

  const calculateCashbackMutation = useMutation({
    mutationFn: async (purchaseAmount: number) => {
      return await apiRequest("POST", "/api/calculate-cashback", { purchaseAmount });
    },
    onSuccess: (result) => {
      setCalculatorResult(result);
    },
    onError: () => {
      toast({ title: "Erro ao calcular cashback", variant: "destructive" });
    },
  });

  const resetSettingForm = () => {
    setSettingForm({
      name: "",
      description: "",
      percentageRate: "",
      minimumPurchase: "",
      maximumCashback: "",
      validUntil: "",
      isActive: "true",
    });
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      clientId: "",
      purchaseAmount: "",
      notes: "",
    });
  };

  const handleEditSetting = (setting: CashbackSetting) => {
    setEditingSetting(setting);
    setSettingForm({
      name: setting.name,
      description: setting.description || "",
      percentageRate: setting.percentageRate,
      minimumPurchase: setting.minimumPurchase,
      maximumCashback: setting.maximumCashback || "",
      validUntil: setting.validUntil ? setting.validUntil.split('T')[0] : "",
      isActive: setting.isActive,
    });
    setIsSettingModalOpen(true);
  };

  const handleSubmitSetting = () => {
    if (editingSetting) {
      updateSettingMutation.mutate({ id: editingSetting.id, ...settingForm });
    } else {
      createSettingMutation.mutate({
        ...settingForm,
        createdBy: "system", // Idealmente vem da sessão do usuário
      });
    }
  };

  const handleSubmitTransaction = async () => {
    // Primeiro calcular o cashback
    const purchaseAmount = parseFloat(transactionForm.purchaseAmount);
    const calculation = await apiRequest("POST", "/api/calculate-cashback", { purchaseAmount });
    
    createTransactionMutation.mutate({
      ...transactionForm,
      purchaseAmount: transactionForm.purchaseAmount,
      cashbackAmount: calculation.cashbackAmount.toString(),
      cashbackRate: calculation.rate.toString(),
      settingId: calculation.setting?.id,
      status: "pending",
    });
  };

  const handleCalculate = () => {
    const amount = parseFloat(calculatorAmount);
    if (amount > 0) {
      calculateCashbackMutation.mutate(amount);
    }
  };

  const totalCashbackPaid = transactions
    .filter(t => t.status === "paid")
    .reduce((sum, t) => sum + parseFloat(t.cashbackAmount), 0);

  const totalCashbackPending = transactions
    .filter(t => t.status === "pending" || t.status === "approved")
    .reduce((sum, t) => sum + parseFloat(t.cashbackAmount), 0);

  const totalClientsWithCashback = balances.filter(b => parseFloat(b.currentBalance) > 0).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Cashback</h2>
          <p className="text-gray-600 mt-1">Configure e gerencie o sistema de cashback</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsCalculatorModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            Calculadora
          </Button>
          <Button
            onClick={() => setIsTransactionModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
          <Button
            onClick={() => setIsSettingModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Configuração
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashback Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCashbackPaid.toString())}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashback Pendente</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCashbackPending.toString())}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes c/ Saldo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClientsWithCashback}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configurações Ativas</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings.filter(s => s.isActive === "true").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="balances">Saldos</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Cashback</CardTitle>
              <CardDescription>
                Configure as regras para cálculo automático de cashback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{setting.name}</h3>
                        <Badge variant={setting.isActive === "true" ? "default" : "secondary"}>
                          {setting.isActive === "true" ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {setting.description}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>Taxa: {setting.percentageRate}%</span>
                        <span>Mín: {formatCurrency(setting.minimumPurchase)}</span>
                        {setting.maximumCashback && (
                          <span>Máx: {formatCurrency(setting.maximumCashback)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSetting(setting)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteingSetting(setting)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transações de Cashback</CardTitle>
              <CardDescription>
                Histórico de todas as transações de cashback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{transaction.client.name}</h3>
                        <Badge 
                          variant={
                            transaction.status === "paid" ? "default" :
                            transaction.status === "approved" ? "secondary" :
                            transaction.status === "pending" ? "outline" : "destructive"
                          }
                        >
                          {transaction.status === "paid" ? "Pago" :
                           transaction.status === "approved" ? "Aprovado" :
                           transaction.status === "pending" ? "Pendente" : "Cancelado"}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-gray-500">
                        <span>Compra: {formatCurrency(transaction.purchaseAmount)}</span>
                        <span>Cashback: {formatCurrency(transaction.cashbackAmount)}</span>
                        <span>Taxa: {transaction.cashbackRate}%</span>
                        <span>
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Saldos de Cashback</CardTitle>
              <CardDescription>
                Saldos atuais de cashback dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {balances.map((balance) => (
                  <div
                    key={balance.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{balance.client.name}</h3>
                      <div className="flex gap-4 mt-1 text-sm text-gray-500">
                        <span>Ganho: {formatCurrency(balance.totalEarned)}</span>
                        <span>Usado: {formatCurrency(balance.totalUsed)}</span>
                        <span className="font-medium text-green-600">
                          Saldo: {formatCurrency(balance.currentBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Configuração */}
      <Dialog open={isSettingModalOpen} onOpenChange={setIsSettingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSetting ? "Editar Configuração" : "Nova Configuração"}
            </DialogTitle>
            <DialogDescription>
              Configure as regras de cashback
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={settingForm.name}
                onChange={(e) => setSettingForm({ ...settingForm, name: e.target.value })}
                placeholder="Ex: Cashback Padrão"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={settingForm.description}
                onChange={(e) => setSettingForm({ ...settingForm, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
            <div>
              <Label htmlFor="percentageRate">Taxa (%)</Label>
              <Input
                id="percentageRate"
                type="number"
                step="0.01"
                value={settingForm.percentageRate}
                onChange={(e) => setSettingForm({ ...settingForm, percentageRate: e.target.value })}
                placeholder="Ex: 5.00"
              />
            </div>
            <div>
              <Label htmlFor="minimumPurchase">Compra Mínima (R$)</Label>
              <Input
                id="minimumPurchase"
                type="number"
                step="0.01"
                value={settingForm.minimumPurchase}
                onChange={(e) => setSettingForm({ ...settingForm, minimumPurchase: e.target.value })}
                placeholder="Ex: 100.00"
              />
            </div>
            <div>
              <Label htmlFor="maximumCashback">Cashback Máximo (R$)</Label>
              <Input
                id="maximumCashback"
                type="number"
                step="0.01"
                value={settingForm.maximumCashback}
                onChange={(e) => setSettingForm({ ...settingForm, maximumCashback: e.target.value })}
                placeholder="Ex: 50.00"
              />
            </div>
            <div>
              <Label htmlFor="validUntil">Válido até</Label>
              <Input
                id="validUntil"
                type="date"
                value={settingForm.validUntil}
                onChange={(e) => setSettingForm({ ...settingForm, validUntil: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={settingForm.isActive === "true"}
                onCheckedChange={(checked) => setSettingForm({ ...settingForm, isActive: checked ? "true" : "false" })}
              />
              <Label htmlFor="isActive">Configuração ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSubmitSetting}>
              {editingSetting ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Transação */}
      <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Transação de Cashback</DialogTitle>
            <DialogDescription>
              Registre uma nova transação para gerar cashback
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientId">Cliente</Label>
              <Select
                value={transactionForm.clientId}
                onValueChange={(value) => setTransactionForm({ ...transactionForm, clientId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="purchaseAmount">Valor da Compra (R$)</Label>
              <Input
                id="purchaseAmount"
                type="number"
                step="0.01"
                value={transactionForm.purchaseAmount}
                onChange={(e) => setTransactionForm({ ...transactionForm, purchaseAmount: e.target.value })}
                placeholder="Ex: 250.00"
              />
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={transactionForm.notes}
                onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                placeholder="Observações sobre a transação"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSubmitTransaction}>Criar Transação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Calculadora */}
      <Dialog open={isCalculatorModalOpen} onOpenChange={setIsCalculatorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calculadora de Cashback</DialogTitle>
            <DialogDescription>
              Calcule o cashback para um valor de compra
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="calculatorAmount">Valor da Compra (R$)</Label>
              <Input
                id="calculatorAmount"
                type="number"
                step="0.01"
                value={calculatorAmount}
                onChange={(e) => setCalculatorAmount(e.target.value)}
                placeholder="Ex: 250.00"
              />
            </div>
            <Button onClick={handleCalculate} className="w-full">
              Calcular Cashback
            </Button>
            {calculatorResult && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Resultado:</h3>
                {calculatorResult.setting ? (
                  <div className="space-y-1 text-sm">
                    <p>Regra aplicada: {calculatorResult.setting.name}</p>
                    <p>Taxa: {calculatorResult.rate}%</p>
                    <p className="font-semibold text-green-600">
                      Cashback: {formatCurrency(calculatorResult.cashbackAmount.toString())}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Nenhuma regra de cashback aplicável para este valor.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingSetting} onOpenChange={() => setDeleteingSetting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a configuração "{deletingSetting?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingSetting) {
                  deleteSettingMutation.mutate(deletingSetting.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
