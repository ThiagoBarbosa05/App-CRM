import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { DealWithClient } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "./deal-form-modal";
import ClientDetailsCard from "./client-details-card";
import ClientFormModal from "./client-form-modal";
import DealDetailsModal from "./deal-details-modal";
import CompanyDetailsModal from "./company-details-modal";
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
  const [selectedCompany, setSelectedCompany] = useState<
    DealWithClient["company"] | null
  >(null);
  const [editingCompany, setEditingCompany] = useState<
    DealWithClient["company"] | null
  >(null);
  const [selectedDeal, setSelectedDeal] = useState<DealWithClient | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  // Estados dos filtros
  const [filters, setFilters] = useState({
    search: "",
    valueMin: "",
    valueMax: "",
    assignedUser: "",
    dateFrom: "",
    dateTo: "",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const {
    data: deals = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/deals", funnelId],
    queryFn: async () => {
      console.log("🚀 INICIANDO QUERY DEALS para funil:", funnelId);
      try {
        // Get user data from localStorage for the query
        const userData = localStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          console.log("👤 USER DATA:", user.id, user.role);
          const response = await apiRequest(
            "GET",
            `/api/deals?userId=${user.id}&userRole=${user.role}&funnelId=${funnelId}`,
          );
          const data = await response.json();
          console.log(
            "🎯 DEALS CARREGADOS (com user):",
            data.length,
            "deals para funil",
            funnelId,
          );
          return data;
        }
        console.log("⚠️ SEM USER DATA - usando query básica");
        const response = await apiRequest(
          "GET",
          `/api/deals?funnelId=${funnelId}`,
        );
        const data = await response.json();
        console.log(
          "🎯 DEALS CARREGADOS (sem user):",
          data.length,
          "deals para funil",
          funnelId,
        );
        return data;
      } catch (error) {
        console.error("❌ ERRO NA QUERY DEALS:", error);
        throw error;
      }
    },
  });

  console.log(deals);

  if (error) {
    console.error("❌ ERRO NA QUERY:", error);
  }

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: companiesResponse } = useQuery({
    queryKey: ["/api/companies"],
  });

  const companies = companiesResponse?.data || [];

  // Função para filtrar deals
  const filteredDeals = deals.filter((deal: any) => {
    const matchesSearch =
      !filters.search ||
      deal.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      deal.description?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesValueMin =
      !filters.valueMin ||
      parseFloat(deal.value) >= parseFloat(filters.valueMin);

    const matchesValueMax =
      !filters.valueMax ||
      parseFloat(deal.value) <= parseFloat(filters.valueMax);

    const matchesUser =
      !filters.assignedUser ||
      filters.assignedUser === "" ||
      filters.assignedUser === "all" ||
      deal.assignedTo === filters.assignedUser;

    const matchesDateFrom =
      !filters.dateFrom ||
      new Date(deal.createdAt) >= new Date(filters.dateFrom);

    const matchesDateTo =
      !filters.dateTo || new Date(deal.createdAt) <= new Date(filters.dateTo);

    return (
      matchesSearch &&
      matchesValueMin &&
      matchesValueMax &&
      matchesUser &&
      matchesDateFrom &&
      matchesDateTo
    );
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
      assignedUser: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

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
    let filteredDeals = deals.filter(
      (deal: DealWithClient) => deal.stageId === stageId,
    );

    // Aplicar filtro por responsável se selecionado
    if (selectedUserId && selectedUserId !== "all") {
      filteredDeals = filteredDeals.filter(
        (deal: DealWithClient) => deal.assignedTo === selectedUserId,
      );
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
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-950 dark:border-slate-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-blue-100 dark:bg-slate-800 flex-shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400  " />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">
                  Pipeline de Vendas
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                  <p className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm">
                    Gerencie seus negócios através do funil
                  </p>
                  {hasActiveFilters && (
                    <span className="text-xs bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full w-fit">
                      {filteredDeals.length} de {deals.length} deals
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative border-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-slate-700 hover:border-gray-400 transition-colors flex-1 sm:flex-none"
                  >
                    <Filter className="h-4 w-4 text-gray-600 sm:mr-2" />
                    <span className="hidden sm:inline">Filtros</span>
                    {hasActiveFilters && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 dark:border-slate-700"
                  align="end"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium dark:text-slate-100">
                        Filtrar Deals
                      </h4>
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
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-400" />
                          <Input
                            id="search"
                            placeholder="Título ou descrição..."
                            value={filters.search}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                search: e.target.value,
                              }))
                            }
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
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                valueMin: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="valueMax">Valor Máx.</Label>
                          <Input
                            id="valueMax"
                            type="number"
                            placeholder="999999"
                            value={filters.valueMax}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                valueMax: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="assignedUser">Responsável</Label>
                        <Select
                          value={filters.assignedUser}
                          onValueChange={(value) =>
                            setFilters((prev) => ({
                              ...prev,
                              assignedUser: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todos os usuários" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              Todos os usuários
                            </SelectItem>
                            {Array.isArray(users) &&
                              users.map((user: any) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name}
                                </SelectItem>
                              ))}
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
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                dateFrom: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="dateTo">Data Fim</Label>
                          <Input
                            id="dateTo"
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                dateTo: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Dialog
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none"
                  >
                    <Plus className="h-4 w-4 text-white sm:mr-2" />
                    <span className="hidden sm:inline">Novo Deal</span>
                    <span className="sm:hidden">Novo</span>
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

          <div className="overflow-x-auto pb-4 pt-4">
            <div
              className="flex gap-4 sm:gap-6 min-w-max"
              style={{
                minWidth: `${(funnel.stages?.length || 1) * 280}px`,
              }}
            >
              {funnel.stages?.map((stage) => {
                const stageDeals = filteredDeals.filter(
                  (deal: any) => deal.stageId === stage.id,
                );
                const totalValue = stageDeals.reduce(
                  (sum: number, deal: any) =>
                    sum + parseFloat(deal.value || "0"),
                  0,
                );

                console.log(
                  `🏁 ESTÁGIO "${stage.name}" (${stage.id}):`,
                  stageDeals.length,
                  "deals",
                );

                return (
                  <div
                    key={stage.id}
                    className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 kanban-column min-h-[500px] sm:min-h-[600px] w-72 sm:w-80 flex-shrink-0"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    <div className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 p-3 sm:p-4 rounded-t-lg sticky top-0 z-10">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-sm sm:text-base text-gray-900 dark:text-slate-100">
                            {stage.name}
                          </span>
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                            {stageDeals.length}
                          </span>
                          <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded-full font-medium hidden sm:inline">
                            {formatCurrency(totalValue)}
                          </span>
                        </div>
                      </div>
                      <div className="sm:hidden mt-2">
                        <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded-full font-medium">
                          {formatCurrency(totalValue)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="p-3 sm:p-4 overflow-y-auto"
                      style={{ maxHeight: "calc(100vh - 300px)" }}
                    >
                      <div className="space-y-3">
                        {stageDeals.map((deal: DealWithClient) => (
                          <div
                            key={deal.id}
                            draggable
                            onDragStart={() => handleDragStart(deal)}
                            onClick={() => setSelectedDeal(deal)}
                            className="kanban-card bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200 group active:scale-95"
                          >
                            <div className="flex items-start justify-between mb-3 gap-2">
                              <h4 className="font-semibold text-gray-900 dark:text-slate-100 text-sm leading-tight flex-1 min-w-0">
                                <span className="line-clamp-2">
                                  {deal.title}
                                </span>
                              </h4>
                              <div className="deal-actions flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDeal(deal);
                                  }}
                                  className="h-6 w-6 p-0 hover:bg-blue-100 rounded touch-manipulation"
                                >
                                  <Edit className="h-3 w-3 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingDeal(deal);
                                  }}
                                  className="h-6 w-6 p-0 hover:bg-red-100 text-red-600 rounded ml-1 touch-manipulation"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2 border-l-3 border-blue-400 dark:border-blue-600">
                                <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">
                                  Responsável:
                                </p>
                                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                  {deal.assignedUser?.name || "Não atribuído"}
                                </p>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(parseFloat(deal.value))}
                                </p>
                                <span className="text-xs text-gray-400 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full w-fit">
                                  {formatDate(deal.createdAt.toString())}
                                </span>
                              </div>

                              {deal.notes && (
                                <div className="bg-yellow-50 dark:bg-yellow-900 border-l-3 border-yellow-400 dark:border-yellow-600 p-2 rounded-r-lg">
                                  <p className="text-xs text-gray-700 dark:text-yellow-300 line-clamp-3 sm:line-clamp-2">
                                    {deal.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {stageDeals.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-2">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                              <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-slate-400" />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-1">
                              Nenhum deal
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-400 text-center leading-tight">
                              Arraste um deal ou <br className="sm:hidden" />
                              <span className="sm:inline">crie um novo</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>{" "}
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
        client={selectedClient || null}
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
      <CompanyDetailsModal
        company={selectedCompany || null}
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onEdit={(company) => {
          setSelectedCompany(null);
          setEditingCompany(company);
        }}
      />
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
        onCompanyClick={(company) => {
          setSelectedDeal(null);
          setSelectedCompany(company);
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
