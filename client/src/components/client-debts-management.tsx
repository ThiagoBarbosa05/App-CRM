
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Calendar,
  DollarSign,
  User,
  Phone,
  CheckCircle
} from "lucide-react";
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

interface ClientDebt {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  amount: string;
  description: string;
  dueDate: string;
  status: "pending" | "overdue" | "paid";
  createdAt: string;
  createdBy: string;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export default function ClientDebtsManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<ClientDebt | null>(null);
  const [deletingDebt, setDeletingDebt] = useState<ClientDebt | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    clientId: "",
    amount: "",
    description: "",
    dueDate: "",
    status: "pending" as "pending" | "paid"
  });

  // Buscar dívidas
  const { data: debts = [] } = useQuery<ClientDebt[]>({
    queryKey: ["/api/client-debts"],
    queryFn: async () => {
      const response = await fetch("/api/client-debts");
      if (!response.ok) throw new Error("Failed to fetch debts");
      return response.json();
    },
  });

  // Buscar clientes
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Estado para busca de clientes
  const [clientSearch, setClientSearch] = useState("");
  const clientSearchInputRef = useRef<HTMLInputElement>(null);

  // Criar dívida
  const createDebtMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/client-debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create debt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-debts"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Dívida cadastrada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar dívida",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar dívida
  const updateDebtMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<typeof formData>) => {
      const response = await fetch(`/api/client-debts/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update debt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-debts"] });
      setEditingDebt(null);
      resetForm();
      toast({ title: "Dívida atualizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar dívida",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deletar dívida
  const deleteDebtMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/client-debts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete debt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-debts"] });
      setDeletingDebt(null);
      toast({ title: "Dívida removida com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover dívida",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      clientId: "",
      amount: "",
      description: "",
      dueDate: "",
      status: "pending"
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDebt) {
      updateDebtMutation.mutate({ ...formData, id: editingDebt.id });
    } else {
      createDebtMutation.mutate(formData);
    }
  };

  const handleEdit = (debt: ClientDebt) => {
    setFormData({
      clientId: debt.clientId,
      amount: debt.amount,
      description: debt.description,
      dueDate: debt.dueDate.split('T')[0], // Format for date input
      status: debt.status === "paid" ? "paid" : "pending"
    });
    setEditingDebt(debt);
  };

  const getStatusColor = (status: string, dueDate: string) => {
    if (status === "paid") return "bg-green-100 text-green-800";
    if (new Date(dueDate) < new Date()) return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  const getStatusText = (status: string, dueDate: string) => {
    if (status === "paid") return "Pago";
    if (new Date(dueDate) < new Date()) return "Vencida";
    return "Pendente";
  };

  // Filtrar clientes para o select
  const filteredClients = clients.filter((client) => {
    const searchLower = clientSearch.toLowerCase();
    return client.name.toLowerCase().includes(searchLower) ||
           client.phone.toLowerCase().includes(searchLower) ||
           (client.email && client.email.toLowerCase().includes(searchLower));
  });

  // Filtrar dívidas
  const filteredDebts = debts.filter((debt) => {
    const matchesSearch = debt.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         debt.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "paid" && debt.status === "paid") ||
                         (statusFilter === "pending" && debt.status === "pending") ||
                         (statusFilter === "overdue" && debt.status === "pending" && new Date(debt.dueDate) < new Date());
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Dívidas de Clientes
        </CardTitle>
        <CardDescription>
          Gerencie as dívidas dos seus clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por cliente ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Vencida</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen || !!editingDebt} onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingDebt(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Dívida
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingDebt ? "Editar Dívida" : "Nova Dívida"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="clientId">Cliente</Label>
                  <Select value={formData.clientId} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, clientId: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          ref={clientSearchInputRef}
                          placeholder="Buscar por nome, CPF ou telefone..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="mb-2"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredClients.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">
                          Nenhum cliente encontrado
                        </div>
                      ) : (
                        filteredClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{client.name}</span>
                              <span className="text-xs text-gray-500">{client.phone}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Valor</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva a dívida..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="dueDate">Data de Vencimento</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: "pending" | "paid") => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingDebt ? "Atualizar" : "Cadastrar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingDebt(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Dívidas */}
        <div className="space-y-4">
          {filteredDebts.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma dívida encontrada</p>
            </div>
          ) : (
            filteredDebts.map((debt) => (
              <div
                key={debt.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{debt.client.name}</h3>
                    <Badge className={getStatusColor(debt.status, debt.dueDate)}>
                      {getStatusText(debt.status, debt.dueDate)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{debt.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(parseFloat(debt.amount))}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Vencimento: {formatDate(debt.dueDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {debt.client.phone}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(debt)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingDebt(debt)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Dialog de confirmação para deletar */}
      <AlertDialog open={!!deletingDebt} onOpenChange={(open) => !open && setDeletingDebt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta dívida? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDebt && deleteDebtMutation.mutate(deletingDebt.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
