import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import type { DealWithClient, SalesFunnelWithStages, User } from "@shared/schema";

/** Máximo de cards carregados por coluna; os totais vêm agregados do banco. */
const DEALS_PER_STAGE_LIMIT = 100;

interface DealsStageSummary {
  stageId: string;
  count: number;
  totalValue: string;
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Users, Phone, ArrowLeft, GitBranch } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import DealFormModal from "./deal-form-modal";
import ClientFormModal from "./client-form-modal";
import DealDetailsModal from "./deal-details-modal";
import CompanyDetailsModal from "./company-details-modal";
import InteractionFormModal from "./interaction-form-modal";
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

interface FunnelKanbanBoardProps {
  funnelId: string;
  funnel: SalesFunnelWithStages;
  initialDealId?: string | null;
  onInitialDealHandled?: () => void;
  onBack?: () => void;
}

export default function FunnelKanbanBoard({
  funnelId,
  funnel,
  initialDealId,
  onInitialDealHandled,
  onBack,
}: FunnelKanbanBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingDeal, setEditingDeal] = useState<DealWithClient | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<DealWithClient | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<DealWithClient | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [, navigate] = useLocation();
  const [selectedCompany, setSelectedCompany] = useState<
    DealWithClient["company"] | null
  >(null);
  const [editingCompany, setEditingCompany] = useState<
    DealWithClient["company"] | null
  >(null);
  const [selectedDeal, setSelectedDeal] = useState<DealWithClient | null>(null);
  const [interactionDeal, setInteractionDeal] = useState<DealWithClient | null>(
    null
  );

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

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    let d = phone.replace(/\D/g, "");
    if ((d.length === 13 || d.length === 12) && d.startsWith("55")) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return phone;
  };

  const handleCallClient = (e: React.MouseEvent, deal: DealWithClient) => {
    e.stopPropagation();
    if (!deal.client?.phone) return;
    navigate(
      `/telemarketing?tab=dialer&clientId=${deal.client.id}&phone=${encodeURIComponent(
        deal.client.phone,
      )}&clientName=${encodeURIComponent(deal.client.name)}`,
    );
  };

  const handleWhatsAppClient = (e: React.MouseEvent, deal: DealWithClient) => {
    e.stopPropagation();
    if (!deal.client) return;
    navigate(`/clientes/${deal.client.id}?tab=whatsapp`);
  };

  // Filtros vão para o backend (com debounce para não disparar uma requisição
  // por tecla). O controle de acesso por responsável sai do token — não
  // adianta (nem é aceito) mandar userId/userRole na query string.
  const debouncedFilters = useDebounce(filters, 400);

  const dealsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      funnelId,
      perStageLimit: String(DEALS_PER_STAGE_LIMIT),
    });
    if (debouncedFilters.search) params.set("search", debouncedFilters.search);
    if (debouncedFilters.valueMin)
      params.set("valueMin", debouncedFilters.valueMin);
    if (debouncedFilters.valueMax)
      params.set("valueMax", debouncedFilters.valueMax);
    if (debouncedFilters.assignedUser && debouncedFilters.assignedUser !== "all")
      params.set("assignedTo", debouncedFilters.assignedUser);
    if (debouncedFilters.dateFrom)
      params.set("dateFrom", debouncedFilters.dateFrom);
    if (debouncedFilters.dateTo) params.set("dateTo", debouncedFilters.dateTo);
    return params.toString();
  }, [funnelId, debouncedFilters]);

  const dealsQueryKey = ["/api/deals", dealsQueryString];

  const {
    data: deals = [],
    isLoading,
    error,
  } = useQuery<DealWithClient[]>({
    queryKey: dealsQueryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/deals?${dealsQueryString}`);
      return response.json();
    },
  });

  // Contagem e soma por coluna vêm agregadas do banco: o cabeçalho continua
  // correto mesmo quando a lista de cards é truncada pelo limite por estágio.
  const { data: stageSummaries = [] } = useQuery<DealsStageSummary[]>({
    queryKey: ["/api/deals/summary", dealsQueryString],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/deals/summary?${dealsQueryString}`,
      );
      return response.json();
    },
  });

  const summaryByStage = useMemo(() => {
    const map = new Map<string, DealsStageSummary>();
    for (const summary of stageSummaries) map.set(summary.stageId, summary);
    return map;
  }, [stageSummaries]);

  const totalDeals = useMemo(
    () => stageSummaries.reduce((sum, summary) => sum + summary.count, 0),
    [stageSummaries],
  );

  // Busca diretamente o negócio indicado por initialDealId (ex.: vindo do
  // perfil do cliente). Usa o endpoint de deal único, que não aplica o
  // filtro por responsável da listagem do board — assim o modal abre com
  // o negócio certo mesmo que ele não seja atribuído ao usuário logado.
  const { data: initialDeal } = useQuery<DealWithClient>({
    queryKey: ["/api/deals", "byId", initialDealId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/deals/${initialDealId}`);
      return response.json();
    },
    enabled: !!initialDealId,
  });

  useEffect(() => {
    if (!initialDealId || !initialDeal) return;
    setSelectedDeal(initialDeal);
    onInitialDealHandled?.();
  }, [initialDealId, initialDeal, onInitialDealHandled]);

  if (error) {
    console.error("❌ ERRO NA QUERY:", error);
  }

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

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

  // Verificar se há filtros ativos ("all" no responsável equivale a sem filtro)
  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) =>
      value !== "" && !(key === "assignedUser" && value === "all"),
  );

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      await apiRequest("PUT", `/api/deals/${id}`, { stageId });
    },
    // Move o card na hora do drop e desfaz se o backend recusar — sem isso
    // o negócio só troca de coluna depois do round-trip da API.
    onMutate: async ({ id, stageId }) => {
      await queryClient.cancelQueries({ queryKey: dealsQueryKey });
      const previousDeals =
        queryClient.getQueryData<DealWithClient[]>(dealsQueryKey);

      queryClient.setQueryData<DealWithClient[]>(dealsQueryKey, (old) =>
        (old ?? []).map((deal) =>
          deal.id === id ? { ...deal, stageId } : deal,
        ),
      );

      return { previousDeals };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDeals) {
        queryClient.setQueryData(dealsQueryKey, context.previousDeals);
      }
      toast({
        title: "Erro",
        description: "Não foi possível mover o negócio. A alteração foi desfeita.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dealsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/deals/summary"] });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/deals/summary"] });
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
      <div className="flex items-center justify-center dark:text-slate-300 h-64">
        <div className="text-lg">Carregando deals...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header — fora do scroll horizontal para não expandir com as colunas */}
        <div className="bg-card border border-border rounded-2xl shadow-sm relative overflow-hidden">
          {/* Bloco superior: identidade do funil (unificado com a navegação) */}
          <div className="px-5 sm:px-6 py-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0 w-full flex-1">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="h-10 w-10 text-slate-500 hover:text-primary hover:bg-accent rounded-xl flex-shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary flex-shrink-0 shadow-inner">
                  <GitBranch className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                    {funnel.name}
                    <Badge
                      variant={funnel.isActive === "true" ? "default" : "secondary"}
                      className={`ml-3 align-middle ${
                        funnel.isActive === "true"
                          ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {funnel.isActive === "true" ? "Ativo" : "Inativo"}
                    </Badge>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 line-clamp-2">
                    Board Kanban - Gerencie seus deals e oportunidades
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bloco inferior: contagem + ações (filtros / novo deal) */}
          <div className="border-t border-border px-5 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {hasActiveFilters && (
                <span className="text-xs bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full w-fit">
                  {totalDeals} {totalDeals === 1 ? "negócio" : "negócios"}{" "}
                  encontrados
                </span>
              )}
              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
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
                            {users.map((user) => (
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
          </div>
        </div>

        {/* Colunas Kanban com scroll horizontal próprio */}
        <div className="overflow-x-auto pb-4">
          <div
            className="flex gap-4 sm:gap-6 min-w-max"
            style={{
              minWidth: `${(funnel.stages?.length || 1) * 280}px`,
            }}
          >
            {funnel.stages?.map((stage) => {
              const stageDeals = deals.filter(
                (deal) => deal.stageId === stage.id,
              );
              // Totais agregados no banco; o fallback cobre o intervalo em que
              // o resumo ainda não chegou.
              const summary = summaryByStage.get(stage.id);
              const stageCount = summary?.count ?? stageDeals.length;
              const totalValue = summary
                ? parseFloat(summary.totalValue)
                : stageDeals.reduce(
                    (sum, deal) => sum + parseFloat(deal.value || "0"),
                    0,
                  );
              const hasHiddenDeals = stageCount > stageDeals.length;

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
                          {stageCount}
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
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={() => handleDragStart(deal)}
                          onClick={() => setSelectedDeal(deal)}
                          className="kanban-card bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200 group active:scale-95"
                        >
                          <div className="flex items-start justify-between mb-3 gap-2">
                            <h4 className="font-semibold text-gray-900 dark:text-slate-100 text-sm leading-tight flex-1 min-w-0">
                              <span className="line-clamp-2">{deal.title}</span>
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
                            {(deal.client || deal.company) && (
                              <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2 border-l-3 border-green-400 dark:border-green-600">
                                <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">
                                  Cliente:
                                </p>
                                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                  {deal.client?.name || deal.company?.nomeFantasia}
                                </p>
                                {deal.client?.phone && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Phone className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                                    <button
                                      type="button"
                                      onClick={(e) => handleCallClient(e, deal)}
                                      title="Ligar pelo Telemarketing"
                                      className="text-xs text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate transition-colors"
                                    >
                                      {formatPhone(deal.client.phone)}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleWhatsAppClient(e, deal)}
                                      title="Abrir conversa no WhatsApp"
                                      className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 hover:bg-green-600 transition-colors flex-shrink-0"
                                    >
                                      <FaWhatsapp className="h-2.5 w-2.5 text-white" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

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

                      {hasHiddenDeals && (
                        <p className="text-xs text-gray-400 dark:text-slate-400 text-center pt-1">
                          Mostrando {stageDeals.length} de {stageCount} — refine
                          os filtros para ver os demais
                        </p>
                      )}

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
          if (client) navigate(`/clientes/${client.id}`);
        }}
        onCompanyClick={(company) => {
          setSelectedDeal(null);
          setSelectedCompany(company);
        }}
        onAddInteraction={(deal) => setInteractionDeal(deal)}
      />
      {interactionDeal && (
        <InteractionFormModal
          open={!!interactionDeal}
          onOpenChange={(open) => {
            if (!open) setInteractionDeal(null);
          }}
          target={
            interactionDeal.clientId
              ? { id: interactionDeal.clientId, type: "client" }
              : { id: interactionDeal.companyId as string, type: "company" }
          }
        />
      )}
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
