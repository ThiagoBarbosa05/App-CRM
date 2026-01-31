import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  CheckCircle,
  Search,
  Filter,
  Receipt,
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
    responsibleName?: string;
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
    status: "pending" as "pending" | "paid",
  });

  // Buscar dívidas
  const {
    data: debts = [],
    isLoading,
    isFetching,
  } = useQuery<ClientDebt[]>({
    queryKey: ["/api/client-debts"],
    queryFn: async () => {
      const response = await fetch("/api/client-debts");
      if (!response.ok) throw new Error("Failed to fetch debts");
      return response.json();
    },
  });

  // Estado para busca de clientes
  const [clientSearch, setClientSearch] = useState("");
  const clientSearchInputRef = useRef<HTMLInputElement>(null);

  // Use a busca com debounce para as queries
  const searchTerm = clientSearch.length >= 2 ? clientSearch : "";

  // Buscar clientes com pesquisa
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", searchTerm],
    queryFn: async () => {
      let url = "/api/clients";
      if (searchTerm.trim()) {
        url += `?search=${encodeURIComponent(searchTerm.trim())}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch clients");
      const result = await response.json();
      return result.data || result; // Handle both {data: [...]} and [...] formats
    },
    enabled: searchTerm.length === 0 || searchTerm.length >= 2, // Só busca se tiver 2+ chars
  });

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

  // Marcar dívida como paga
  const payDebtMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/client-debts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      if (!response.ok) throw new Error("Failed to mark debt as paid");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-debts"] });
      toast({ title: "Dívida marcada como paga!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao marcar dívida como paga",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markDebtAsPaid = (debtId: string) => {
    payDebtMutation.mutate(debtId);
  };

  const resetForm = () => {
    setFormData({
      clientId: "",
      amount: "",
      description: "",
      dueDate: "",
      status: "pending",
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
      dueDate: debt.dueDate.split("T")[0], // Format for date input
      status: debt.status === "paid" ? "paid" : "pending",
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

  const getOverdueDays = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Usar clientes filtrados do servidor
  const filteredClients = Array.isArray(clients) ? clients : [];

  // Filtrar dívidas
  const filteredDebts = Array.isArray(debts)
    ? debts.filter((debt) => {
        const matchesSearch =
          debt.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          debt.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "paid" && debt.status === "paid") ||
          (statusFilter === "pending" && debt.status === "pending") ||
          (statusFilter === "overdue" &&
            debt.status === "pending" &&
            new Date(debt.dueDate) < new Date());

        return matchesSearch && matchesStatus;
      })
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50/30 dark:from-slate-900 dark:to-slate-800">
      <div className="p-4 lg:p-6">
        {/* Header com gradiente red/orange */}
        <div className="bg-gradient-to-r from-red-500 to-orange-600 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <Receipt className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                Dívidas de Clientes
              </h1>
              <p className="text-red-100 text-sm lg:text-base">
                Gerencie as dívidas e cobranças dos seus clientes
              </p>
            </div>
            <Button
              onClick={() => {
                setIsAddDialogOpen(true);
                setClientSearch("");
              }}
              className="bg-white/20 hover:bg-white/30 dark:bg-orange-800 dark:hover:bg-orange-700 dark:border-orange-900 text-white  border-white/30 backdrop-blur-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Dívida
            </Button>
          </div>
        </div>

        {/* Barra de pesquisa e filtros */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-300 focus:border-red-400 focus:ring-red-400 dark:border-slate-600 dark:focus:border-red-500"
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                </div>
              )}
            </div>
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:text-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 dark:focus:border-red-500"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Pendente</option>
                <option value="overdue">Vencida</option>
                <option value="paid">Pago</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="space-y-6">
          {/* Skeleton Loading */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-48" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <Skeleton className="h-4 w-full max-w-md" />
                        <div className="flex flex-wrap gap-4">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Conteúdo Real */}
          {!isLoading && (
            <>
              {filteredDebts.length === 0 && debts.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Receipt className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Nenhuma dívida cadastrada
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                      Comece cadastrando as primeiras dívidas dos seus clientes.
                    </p>
                    <Button
                      onClick={() => {
                        setIsAddDialogOpen(true);
                        setClientSearch("");
                      }}
                      className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Dívida
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredDebts.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Search className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Nenhuma dívida encontrada
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      Tente ajustar os filtros ou o termo de busca.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredDebts.map((debt) => (
                    <Card
                      key={debt.id}
                      className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-lg">
                                  <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg group-hover:text-red-600 transition-colors">
                                  {debt.client.name}
                                </h3>
                              </div>
                              <Badge
                                className={
                                  debt.status === "paid"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
                                    : new Date(debt.dueDate) < new Date()
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
                                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                                }
                              >
                                {getStatusText(debt.status, debt.dueDate)}
                              </Badge>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                              {debt.description}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-red-500" />
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {formatCurrency(parseFloat(debt.amount))}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-500" />
                                <span className="text-slate-600 dark:text-slate-400">
                                  {formatDate(debt.dueDate)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-slate-500" />
                                <span className="text-slate-600 dark:text-slate-400">
                                  {debt.client.phone}
                                </span>
                              </div>
                              {debt.client.responsibleName && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-slate-500" />
                                  <span className="text-slate-600 dark:text-slate-400">
                                    {debt.client.responsibleName}
                                  </span>
                                </div>
                              )}
                            </div>
                            {debt.status === "pending" &&
                              new Date(debt.dueDate) < new Date() && (
                                <div className="flex items-center gap-2 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  <span className="text-red-600 dark:text-red-400 font-medium text-sm">
                                    {getOverdueDays(debt.dueDate)} dias em
                                    atraso
                                  </span>
                                </div>
                              )}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                            {debt.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markDebtAsPaid(debt.id)}
                                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/20"
                                title="Marcar como pago"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(debt)}
                              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingDebt(debt)}
                              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog
        open={isAddDialogOpen || !!editingDebt}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingDebt(null);
            setClientSearch("");
            resetForm();
          }
        }}
      >
        <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
              <div className="p-2 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-lg">
                <Receipt className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              {editingDebt ? "Editar Dívida" : "Nova Dívida"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label
                htmlFor="clientId"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cliente
              </Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, clientId: value }))
                }
              >
                <SelectTrigger className="border-slate-300 focus:border-red-400 focus:ring-red-400 dark:border-slate-600 dark:focus:border-red-500">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2" onMouseDown={(e) => e.stopPropagation()}>
                    <Input
                      placeholder="Buscar por nome, CPF ou telefone..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="mb-2 border-slate-300 focus:border-red-400 focus:ring-red-400"
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onFocus={() => {}}
                      tabIndex={-1}
                    />
                  </div>
                  {clientsLoading ? (
                    <div className="p-2 text-sm text-slate-500 dark:text-slate-400">
                      Carregando...
                    </div>
                  ) : filteredClients.length === 0 &&
                    clientSearch.length >= 2 ? (
                    <div className="p-2 text-sm text-slate-500 dark:text-slate-400">
                      Nenhum cliente encontrado
                    </div>
                  ) : clientSearch.length > 0 && clientSearch.length < 2 ? (
                    <div className="p-2 text-sm text-slate-500 dark:text-slate-400">
                      Digite pelo menos 2 caracteres para buscar
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {client.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {client.phone}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="amount"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Valor
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                className="border-slate-300 focus:border-red-400 focus:ring-red-400 dark:border-slate-600 dark:focus:border-red-500 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Descrição
              </Label>
              <Textarea
                id="description"
                placeholder="Descreva a dívida..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="border-slate-300 focus:border-red-400 focus:ring-red-400 dark:border-slate-600 dark:focus:border-red-500 bg-white dark:bg-slate-800 resize-none"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="dueDate"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Data de Vencimento
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                className="border-slate-300 focus:border-red-400 focus:ring-red-400 dark:border-slate-600 dark:focus:border-red-500 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="status"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: "pending" | "paid") =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="border-slate-300 focus:border-red-400 focus:ring-red-400 dark:border-slate-600 dark:focus:border-red-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingDebt(null);
                  resetForm();
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createDebtMutation.isPending || updateDebtMutation.isPending
                }
                className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createDebtMutation.isPending ||
                updateDebtMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Salvando...
                  </div>
                ) : editingDebt ? (
                  "Atualizar"
                ) : (
                  "Cadastrar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para deletar */}
      <AlertDialog
        open={!!deletingDebt}
        onOpenChange={(open) => !open && setDeletingDebt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta dívida? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingDebt && deleteDebtMutation.mutate(deletingDebt.id)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
