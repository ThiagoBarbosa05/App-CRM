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
import { Plus, Search, Download, Upload, Loader2, Briefcase, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ClientsHeader } from "@/components/clients/clients-header";
import { ClientsActions } from "@/components/clients/clients-actions";
import { type Client } from "@shared/schema";

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
  });
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
    <div className="bg-gray-50 dark:bg-slate-900">
      <div className="space-y-6">
        <ClientsHeader
          totalItems={totalItems}
          onImportClick={() => setIsImportModalOpen(true)}
          onNewClientClick={() => setIsClientModalOpen(true)}
        />

        <ClientsActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          clientFilters={clientFilters}
          onFiltersChange={handleFiltersChange}
          selectedCount={selectedClients.length}
          onClearSelection={clearSelection}
          onBulkDealClick={() => setIsBulkDealModalOpen(true)}
          onExportClick={() => setIsExportModalOpen(true)}
          isExporting={isExportModalOpen && selectedClients.length === 0 && isFetchingAllForExport}
        />

        {/* Clients Table */}
        <div className="bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Header da tabela com informações de paginação */}
          <div className="bg-gradient-to-r from-gray-50  to-slate-50 dark:from-slate-900 dark:to-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-800">
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
