import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { DealWithClient } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "./deal-form-modal";
import ClientDetailsCard from "./client-details-card";
import ClientFormModal from "./client-form-modal";
import DealDetailsModal from "./deal-details-modal";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Search, FilterX, Filter } from "lucide-react";


interface SalesFunnel {
  id: string;
  name: string;
  description?: string;
  isActive: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stages: FunnelStage[];
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

import { FunnelStage } from "@shared/schema";

interface FunnelKanbanBoardProps {
  funnelId: string;
  funnel: SalesFunnel;
}

export default function FunnelKanbanBoard({
  funnelId,
  funnel,
}: FunnelKanbanBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingDeal, setEditingDeal] = useState<DealWithClient | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<DealWithClient | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<DealWithClient | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<
    DealWithClient["client"] | null
  >(null);
  const [editingClient, setEditingClient] = useState<
    DealWithClient["client"] | null
  >(null);
  const [selectedDeal, setSelectedDeal] = useState<DealWithClient | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  // Estados dos filtros
  const [filters, setFilters] = useState({
    search: "",
    valueMin: "",
    valueMax: "",
    company: "",
    assignedUser: "",
    dateFrom: "",
    dateTo: "",
    status: ""
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["/api/deals", funnelId],
    queryFn: async () => {
      // Get user data from localStorage for the query
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        const response = await apiRequest(
          "GET",
          `/api/deals?userId=${user.id}&userRole=${user.role}&funnelId=${funnelId}`,
        );
        const data = await response.json();
        console.log("🎯 DEALS CARREGADOS:", data.length, "deals para funil", funnelId);
        return data;
      }
      const response = await apiRequest(
        "GET",
        `/api/deals?funnelId=${funnelId}`,
      );
      const data = await response.json();
      console.log("🎯 DEALS CARREGADOS:", data.length, "deals para funil", funnelId);
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: companiesResponse } = useQuery({
    queryKey: ["/api/companies"],
  });

  const companies = companiesResponse?.data || [];

  // Função para filtrar deals
  const filteredDeals = deals.filter((deal: any) => {
    const matchesSearch = !filters.search ||
      deal.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      deal.description?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesValueMin = !filters.valueMin ||
      parseFloat(deal.value) >= parseFloat(filters.valueMin);

    const matchesValueMax = !filters.valueMax ||
      parseFloat(deal.value) <= parseFloat(filters.valueMax);

    const matchesCompany = !filters.company || filters.company === "" || filters.company === "all" ||
      deal.companyId === filters.company;

    const matchesUser = !filters.assignedUser || filters.assignedUser === "" || filters.assignedUser === "all" ||
      deal.assignedUserId === filters.assignedUser;

    const matchesDateFrom = !filters.dateFrom ||
      new Date(deal.createdAt) >= new Date(filters.dateFrom);

    const matchesDateTo = !filters.dateTo ||
      new Date(deal.createdAt) <= new Date(filters.dateTo);

    const matchesStatus = filters.status === "all" ||
      deal.status === filters.status;

    return matchesSearch && matchesValueMin && matchesValueMax &&
           matchesCompany && matchesUser && matchesDateFrom &&
           matchesDateTo && matchesStatus;
  });

  // Debug: log dos deals filtrados
  console.log("🔍 FILTROS APLICADOS:", filters);
  console.log("📊 DEALS ANTES FILTRO:", deals.length);
  console.log("📊 DEALS APÓS FILTRO:", filteredDeals.length);

  // Função para limpar filtros
  const clearFilters = () => {
    setFilters({
      search: "",
      valueMin: "",
      valueMax: "",
      company: "",
      assignedUser: "",
      dateFrom: "",
      dateTo: "",
      status: ""
    });
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = Object.values(filters).some(value => value !== "");


  const updateDealMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      await apiRequest("PUT", `/api/deals/${id}`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", funnelId] });
      toast({
        title: "Deal atualizado",
        description: "O estágio do deal foi alterado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o deal.",
        variant: "destructive",
      });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", funnelId] });
      toast({
        title: "Deal excluído",
        description: "O deal foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o deal.",
        variant: "destructive",
      });
    },
  });

  // Buscar usuários para o filtro
  const { data: usersFromApi = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });


  const getDealsForStage = (stageId: string) => {
    if (!deals || !Array.isArray(deals)) return [];
    let filteredDeals = deals.filter((deal: DealWithClient) => deal.stageId === stageId);

    // Aplicar filtro por responsável se selecionado
    if (selectedUserId && selectedUserId !== "all") {
      filteredDeals = filteredDeals.filter((deal: DealWithClient) => deal.assignedTo === selectedUserId);
    }

    return filteredDeals;
  };

  const handleDragStart = (deal: DealWithClient) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stageId !== stageId) {
      updateDealMutation.mutate({ id: draggedDeal.id, stageId });
    }
    setDraggedDeal(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando deals...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Pipeline de Vendas</h3>
            <p className="text-gray-600">
              Gerencie seus negócios através do funil
              {hasActiveFilters && (
                <span className="ml-2 text-sm">
                  ({filteredDeals.length} de {deals.length} deals)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filtrar Deals</h4>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FilterX className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="search">Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="search"
                          placeholder="Título ou descrição..."
                          value={filters.search}
                          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="valueMin">Valor Mín.</Label>
                        <Input
                          id="valueMin"
                          type="number"
                          placeholder="0"
                          value={filters.valueMin}
                          onChange={(e) => setFilters(prev => ({ ...prev, valueMin: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="valueMax">Valor Máx.</Label>
                        <Input
                          id="valueMax"
                          type="number"
                          placeholder="999999"
                          value={filters.valueMax}
                          onChange={(e) => setFilters(prev => ({ ...prev, valueMax: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="company">Empresa</Label>
                      <Select
                        value={filters.company}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, company: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as empresas</SelectItem>
                          {companies.map((company: any) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="assignedUser">Responsável</Label>
                      <Select
                        value={filters.assignedUser}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, assignedUser: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os usuários" />
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

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os status</SelectItem>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="won">Ganho</SelectItem>
                          <SelectItem value="lost">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="dateFrom">Data Início</Label>
                        <Input
                          id="dateFrom"
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dateTo">Data Fim</Label>
                        <Input
                          id="dateTo"
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Deal
                </Button>
              </DialogTrigger>
              <DealFormModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                funnelId={funnelId}
              />
            </Dialog>
          </div>
        </div>

        <div
          className="grid gap-6 h-full"
          style={{
            gridTemplateColumns: `repeat(${funnel.stages?.length || 1}, 1fr)`,
          }}
        >
          {funnel.stages?.map((stage) => {
            const stageDeals = filteredDeals.filter((deal: any) => deal.stageId === stage.id);
            const totalValue = stageDeals.reduce((sum: number, deal: any) => sum + parseFloat(deal.value || "0"), 0);

            return (
              <div
                key={stage.id}
                className="bg-white rounded-lg card-shadow p-4 kanban-column"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </h3>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {stageDeals.map((deal: DealWithClient) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                      onClick={() => setSelectedDeal(deal)}
                      className="kanban-card bg-white border border-gray-200 rounded-lg p-4 card-shadow cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm leading-tight">
                          {deal.title}
                        </h4>
                        <div className="deal-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDeal(deal);
                            }}
                            className="deal-action-btn hover:bg-gray-100"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingDeal(deal);
                            }}
                            className="deal-action-btn hover:bg-red-100 text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Cliente:{" "}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(deal.client);
                            }}
                            className="text-wine-600 hover:text-wine-800 underline font-medium"
                          >
                            {deal.client?.name}
                          </button>
                        </p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(parseFloat(deal.value))}
                        </p>
                        {deal.notes && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {deal.notes}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDate(deal.createdAt.toString())}
                        </p>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Nenhum deal neste estágio</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingDeal && (
        <DealFormModal
          open={!!editingDeal}
          onOpenChange={(open) => !open && setEditingDeal(null)}
          deal={editingDeal}
          funnelId={funnelId}
        />
      )}

      {isCreateModalOpen && (
        <DealFormModal
          open={isCreateModalOpen}
          onOpenChange={(open) => !open && setIsCreateModalOpen(false)}
          funnelId={funnelId}
        />
      )}

      <ClientDetailsCard
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
        onEdit={(client) => {
          setSelectedClient(null);
          setEditingClient(client);
        }}
      />

      {editingClient && (
        <ClientFormModal
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          client={editingClient}
        />
      )}

      <DealDetailsModal
        deal={selectedDeal}
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onEdit={(deal) => {
          setSelectedDeal(null);
          setEditingDeal(deal);
        }}
        onDelete={(deal) => {
          setSelectedDeal(null);
          setDeletingDeal(deal);
        }}
        onClientClick={(client) => {
          setSelectedDeal(null);
          setSelectedClient(client);
        }}
      />

      <AlertDialog
        open={!!deletingDeal}
        onOpenChange={() => setDeletingDeal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o deal "{deletingDeal?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingDeal) {
                  deleteDealMutation.mutate(deletingDeal.id);
                  setDeletingDeal(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}