import { useCallback, useState, useEffect, useMemo } from "react";
import ClientsTableWithSelection from "@/components/clients-table-with-selection";
import ClientFormModal from "@/components/client-form-modal";
import ClientFilters, {
  ClientFilters as ClientFiltersType,
} from "@/components/client-filters";
import ClientImportModal from "@/components/client-import-modal";
import ClientExportModal from "@/components/client-export-modal";
import BulkDealCreationModalForClients from "@/components/bulk-deal-creation-modal-for-clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Loader2,
  Briefcase,
  Users,
  Building2,
  Phone,
  MapPin,
  ExternalLink,
  BarChart3,
  TrendingUp,
  CalendarIcon,
  ChevronDown,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ClientsHeader } from "@/components/clients/clients-header";
import { ClientsActions } from "@/components/clients/clients-actions";
import { type Client } from "@shared/schema";
import { useLocation } from "wouter";
import { useClientReports } from "@/hooks/useReports";
import { ClientReportsGrid } from "@/components/reports/client-reports-grid";
import { ClientCommercialGrid } from "@/components/reports/client-commercial-grid";

// Hook customizado para debouncing de valores, útil para campos de busca.
const useDebounce = (value: any, delay: number): any => {
  const [debouncedValue, setDebouncedValue] = useState<any>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function Clients() {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "gerente" ||
    user?.role === "administrador";
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBulkDealModalOpen, setIsBulkDealModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<Client[]>([]); // Tipagem melhorada
  const [clientFilters, setClientFilters] = useState<ClientFiltersType>({
    name: "",
    phone: "",
    cpf: "",
    responsavelId: "all",
    categoria: "",
    origem: "",
    markers: "",
    purchaseStatus: "all",
  });

  const { data: systemSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });
  const purchaseStatusDays = parseInt(systemSettings?.purchase_status_days ?? "60", 10);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, clientFilters]);

  const handleFiltersChange = useCallback((filters: ClientFiltersType) => {
    setClientFilters(filters);
  }, []);

  const { data: clientsResponse, isFetching } = useQuery({
    queryKey: [
      "/api/clients",
      user?.id,
      user?.role,
      debouncedSearchQuery,
      clientFilters,
      currentPage,
      purchaseStatusDays,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.role !== "admin") {
        if (user?.id) params.append("userId", user.id);
        if (user?.role) params.append("userRole", user.role);
      }
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);

      Object.entries(clientFilters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });

      if (clientFilters.purchaseStatus && clientFilters.purchaseStatus !== "all") {
        params.append("purchaseStatusDays", purchaseStatusDays.toString());
      }

      params.append("page", currentPage.toString());
      params.append("pageSize", itemsPerPage.toString());

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: !!user,
  });

  const { clientsArray, totalPages, hasNextPage, totalItems } = useMemo(() => {
    const data = clientsResponse?.data || [];
    return {
      clientsArray: data,
      totalPages: clientsResponse?.totalPages || null,
      hasNextPage: clientsResponse?.hasNextPage ?? data.length === itemsPerPage,
      totalItems: clientsResponse?.totalItems || 0,
    };
  }, [clientsResponse]);

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const usersArray = useMemo(
    () => (Array.isArray(users) ? users : []),
    [users],
  );

  const selectedResponsavel = clientFilters.responsavelId !== "all" ? clientFilters.responsavelId : null;

  const { data: companiesData, isFetching: isFetchingCompanies } = useQuery({
    queryKey: ["/api/companies", selectedResponsavel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedResponsavel) params.append("responsavelId", selectedResponsavel);
      const response = await fetch(`/api/companies?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch companies");
      const result = await response.json();
      return Array.isArray(result) ? result : result.data || result.companies || [];
    },
    enabled: !!selectedResponsavel,
  });

  const companiesArray = useMemo(() => companiesData || [], [companiesData]);

  const [, navigate] = useLocation();
  const { data: clientReports } = useClientReports();

  // ── Retrátil + Date range para setor de análises ──────────────────────────
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const startDate = useMemo(
    () => dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : format(startOfMonth(new Date()), "yyyy-MM-dd"),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate,
    [dateRange?.to, startDate],
  );

  const { data: allClientsForExport, isFetching: isFetchingAllForExport } =
    useQuery({
      queryKey: [
        "/api/clients/all",
        user?.id,
        user?.role,
        debouncedSearchQuery,
        clientFilters,
      ],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (user?.role !== "admin") {
          if (user?.id) params.append("userId", user.id);
          if (user?.role) params.append("userRole", user.role);
        }
        if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
        Object.entries(clientFilters).forEach(([key, value]) => {
          if (value && value !== "all") params.append(key, value);
        });

        const response = await fetch(`/api/clients?${params.toString()}`);
        if (!response.ok)
          throw new Error("Failed to fetch all clients for export");
        const result = await response.json();
        return Array.isArray(result) ? result : result.data || [];
      },
      enabled: isExportModalOpen && selectedClients.length === 0,
    });

  const handleSelectionChange = useCallback(
    (selectedIds: string[], selectedClientsData: Client[]) => {
      setSelectedClientIds(selectedIds);
      setSelectedClients(selectedClientsData);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedClientIds([]);
    setSelectedClients([]);
  }, []);

  const clientsForExport = useMemo(() => {
    return selectedClients.length > 0
      ? selectedClients
      : allClientsForExport || [];
  }, [selectedClients, allClientsForExport]);

  return (
    <div className="bg-slate-100 dark:bg-slate-900">
      <div className="space-y-6">
        <ClientsHeader
          totalItems={totalItems}
          onImportClick={() => setIsImportModalOpen(true)}
          onNewClientClick={() => setIsClientModalOpen(true)}
        />

        {/* Análise de Clientes + Análise Comercial — retrátil + abas */}
        <div className="space-y-4">
          {/* Cabeçalho retrátil */}
          <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 px-4 py-3 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => setAnalyticsOpen((v) => !v)}
              className="flex-1 flex items-center gap-3 text-left"
            >
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Análises
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Segmentação e performance comercial dos clientes
                </p>
              </div>
              <ChevronDown className={`ml-auto h-5 w-5 text-slate-400 transition-transform duration-200 ${analyticsOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Date picker */}
            {analyticsOpen && (
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="shrink-0 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium h-9 px-3"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <span>{format(dateRange.from, "dd/MM/yy")} — {format(dateRange.to, "dd/MM/yy")}</span>
                      ) : format(dateRange.from, "dd/MM/yy")
                    ) : <span>Período</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      if (range?.from && range?.to) setIsCalendarOpen(false);
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Conteúdo expansível com abas */}
          {analyticsOpen && (
            <Tabs defaultValue="analise-clientes" className="space-y-4">
              <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md">
                <TabsList className="grid w-full grid-cols-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <TabsTrigger
                    value="analise-clientes"
                    className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-emerald-200 dark:data-[state=active]:border-emerald-800
                      hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
                  >
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    <span className="truncate">Análise de Clientes</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="analise-comercial"
                    className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200
                      data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800
                      hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 border border-transparent"
                  >
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="truncate">Análise Comercial</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="analise-clientes" className="m-0 outline-none">
                <ClientReportsGrid
                  clientsByCategory={clientReports?.clientsByCategory ?? []}
                  clientsByOrigin={clientReports?.clientsByOrigin ?? []}
                  clientsByUser={clientReports?.clientsByUser ?? []}
                  clientsByMarkers={clientReports?.clientsByMarkers ?? []}
                  totalClients={clientReports?.totalClients ?? 0}
                  clientsWithEmail={clientReports?.clientsWithEmail ?? 0}
                  clientsWithPhone={clientReports?.clientsWithPhone ?? 0}
                  clientsWithCPF={clientReports?.clientsWithCPF ?? 0}
                  clientsWithAddress={clientReports?.clientsWithAddress ?? 0}
                />
              </TabsContent>

              <TabsContent value="analise-comercial" className="m-0 outline-none">
                <ClientCommercialGrid startDate={startDate} endDate={endDate} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <ClientsActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          clientFilters={clientFilters}
          onFiltersChange={handleFiltersChange}
          selectedCount={selectedClients.length}
          onClearSelection={clearSelection}
          onBulkDealClick={() => setIsBulkDealModalOpen(true)}
          onExportClick={() => setIsExportModalOpen(true)}
          isExporting={
            isExportModalOpen &&
            selectedClients.length === 0 &&
            isFetchingAllForExport
          }
          isAdmin={isAdmin}
          users={usersArray.filter((u: any) => u.isActive === "true").sort((a: any, b: any) => a.name.localeCompare(b.name))}
        />

        {/* Clients Table */}
        <div className="bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Header da tabela com informações de paginação */}
          <div className="bg-gradient-to-r from-slate-50  to-slate-100 dark:from-slate-900 dark:to-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-lg">
                    Lista de Clientes
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    Mostrando {clientsArray.length} de {itemsPerPage} clientes
                    por página
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Badge de status da busca */}
                {(debouncedSearchQuery ||
                  Object.values(clientFilters).some(
                    (value) => value && value !== "all",
                  )) && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-3 py-2 rounded-lg">
                    <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Filtros ativos
                    </span>
                  </div>
                )}

                {/* Informação de paginação */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Página {currentPage}
                    {totalPages && (
                      <span className="text-gray-500 dark:text-slate-400">
                        {" "}
                        de {totalPages}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Container da tabela com loading overlay */}
          <div className="relative min-h-[400px]">
            <ClientsTableWithSelection
              clients={clientsArray}
              onSelectionChange={handleSelectionChange}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              hasNextPage={hasNextPage}
            />

            {/* Loading overlay aprimorado */}
            {isFetching && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-8 mx-4">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                      <Loader2 className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-1">
                        Carregando clientes...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Aguarde enquanto buscamos os dados
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state quando não há clientes */}
            {!isFetching && clientsArray.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="bg-gray-50 dark:bg-slate-800 rounded-full w-20 h-20 flex items-center justify-center mb-6">
                  <Users className="h-10 w-10 text-gray-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                  Nenhum cliente encontrado
                </h3>
                <p className="text-gray-500 dark:text-slate-400 text-center max-w-md mb-6">
                  {debouncedSearchQuery ||
                  Object.values(clientFilters).some(
                    (value) => value && value !== "all",
                  )
                    ? "Tente ajustar os filtros ou termos de busca para encontrar clientes."
                    : "Comece adicionando seu primeiro cliente ao sistema."}
                </p>
                {!debouncedSearchQuery &&
                  !Object.values(clientFilters).some(
                    (value) => value && value !== "all",
                  ) && (
                    <Button
                      onClick={() => setIsClientModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Primeiro Cliente
                    </Button>
                  )}
              </div>
            )}
          </div>

          {/* Footer da tabela com resumo */}
          {!isFetching && clientsArray.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-900 px-6 py-4 border-t border-gray-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    {clientsArray.length} cliente(s) carregado(s) nesta página
                  </span>
                </div>

                {hasNextPage && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <span>Há mais clientes disponíveis</span>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Seção de Empresas - aparece quando filtro por responsável está ativo */}
      {selectedResponsavel && (
        <div className="bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 px-6 py-4 border-b border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                  <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-lg">
                    Empresas do Vendedor
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    {isFetchingCompanies
                      ? "Carregando empresas..."
                      : `${companiesArray.length} empresa(s) vinculada(s) ao vendedor selecionado`}
                  </p>
                </div>
              </div>
              {companiesArray.length > 0 && (
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                  {companiesArray.length} empresa{companiesArray.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>

          {isFetchingCompanies ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Buscando empresas...</p>
              </div>
            </div>
          ) : companiesArray.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-purple-400 dark:text-purple-500" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Nenhuma empresa encontrada
              </h4>
              <p className="text-sm text-gray-500 dark:text-slate-400 text-center">
                Este vendedor não possui empresas vinculadas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-slate-300">Nome / Razão Social</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-slate-300">CNPJ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        Telefone
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        Localização
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-slate-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesArray.map((company: any, index: number) => (
                    <tr
                      key={company.id}
                      className={`border-b border-gray-100 dark:border-slate-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors ${
                        index % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-purple-50/20 dark:bg-purple-900/5"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-slate-100">
                            {company.nomeFantasia || company.razaoSocial}
                          </p>
                          {company.nomeFantasia && company.razaoSocial && company.nomeFantasia !== company.razaoSocial && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                              {company.razaoSocial}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400 font-mono text-xs">
                        {company.cnpj || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {company.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {[company.city, company.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                          onClick={() => navigate(`/empresas`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      <ClientFormModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
      />

      <ClientImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
      />

      <ClientExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        clients={clientsForExport}
        selectedClients={selectedClients}
        users={usersArray}
      />

      <BulkDealCreationModalForClients
        open={isBulkDealModalOpen}
        onOpenChange={setIsBulkDealModalOpen}
        clients={selectedClients}
      />
    </div>
  );
}
