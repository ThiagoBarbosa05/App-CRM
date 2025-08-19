
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, Receipt, Percent } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
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

export default function Vendas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClientBalance, setSelectedClientBalance] = useState<number>(0);
  const [saleForm, setSaleForm] = useState<SaleForm>({
    clientId: '',
    date: new Date().toISOString().split('T')[0],
    grossValue: ''
  });

  useEffect(() => {
    loadClients();
    loadSales();
  }, []);

  const loadClients = async () => {
    try {
      const response = await fetch('/api/clients');
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
    
    // Gerar novo cashback (5% do valor líquido)
    const cashbackGenerated = netValue * 0.05;

    return {
      cashbackUsed,
      netValue,
      cashbackGenerated
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
        setIsDialogOpen(false);
        loadSales();
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
    loadClientBalance(clientId);
  };

  const previewValues = () => {
    const grossValue = parseFloat(saleForm.grossValue) || 0;
    return calculateSaleValues(grossValue, selectedClientBalance);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!user) {
    return null;
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vendas</h1>
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
                    <Select
                      value={saleForm.clientId}
                      onValueChange={handleClientChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                            <span>Novo Cashback Gerado (5%):</span>
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
                    onClick={() => setIsDialogOpen(false)}
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

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sales.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total Bruto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(sales.reduce((sum, sale) => sum + sale.grossValue, 0))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cashback Utilizado</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(sales.reduce((sum, sale) => sum + sale.cashbackUsed, 0))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cashback Gerado</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(sales.reduce((sum, sale) => sum + sale.cashbackGenerated, 0))}
              </div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
