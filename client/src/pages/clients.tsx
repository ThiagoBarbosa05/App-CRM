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
import {
  Plus,
  Search,
  Download,
  Upload,
  Loader2,
  Briefcase,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

// Definição de tipo para cliente para melhorar a segurança de tipo.
interface Client {
  id: string;
  [key: string]: any; // Permite outras propriedades não estritamente tipadas por enquanto.
}

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
      totalItems: clientsResponse?.totalItems ?? null,
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
    [users]
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
    []
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
    <div className=" bg-gray-50">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-4">
              <Users className="size-6 shrink-0 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
                <p className="text-gray-600 mt-1">
                  Gerencie seus clientes e informações de contato
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsImportModalOpen(true)}
                className="text-wine-600 border-wine-600 hover:bg-wine-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button
                onClick={() => setIsClientModalOpen(true)}
                className="bg-primary hover:bg-primary-dark text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-gray-200 px-6 py-4 rounded-lg shadow-sm">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <ClientFilters
                currentFilters={clientFilters}
                onFiltersChange={handleFiltersChange}
              />
              <div className="flex items-center gap-2">
                {selectedClients.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-lg">
                    <span className="text-sm font-medium text-blue-800">
                      {selectedClients.length} selecionados
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </Button>
                  </div>
                )}
                {selectedClients.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkDealModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    data-testid="button-bulk-deals"
                  >
                    <Briefcase className="h-4 w-4 mr-2" />
                    Criar Negócios em Lote ({selectedClients.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full"
                  disabled={
                    isExportModalOpen &&
                    selectedClients.length === 0 &&
                    isFetchingAllForExport
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isFetchingAllForExport && selectedClients.length === 0
                    ? "Preparando..."
                    : selectedClients.length > 0
                    ? `Exportar ${selectedClients.length} Selecionados`
                    : "Exportar Todos"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header da tabela com informações de paginação */}
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    Lista de Clientes
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {totalItems !== null ? (
                      <>
                        Mostrando {clientsArray.length} de {totalItems} clientes
                        {totalItems > itemsPerPage && ` (página ${currentPage} de ${totalPages})`}
                      </>
                    ) : (
                      <>
                        Mostrando {clientsArray.length} clientes (página {currentPage})
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Badge de status da busca */}
                {(debouncedSearchQuery ||
                  Object.values(clientFilters).some(
                    (value) => value && value !== "all"
                  )) && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                    <Search className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      Filtros ativos
                    </span>
                  </div>
                )}

                {/* Informação de paginação */}
                <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-gray-700">
                    Página {currentPage}
                    {totalPages && (
                      <span className="text-gray-500"> de {totalPages}</span>
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
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mx-4">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-200 rounded-full"></div>
                      <Loader2 className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-900 mb-1">
                        Carregando clientes...
                      </p>
                      <p className="text-sm text-gray-500">
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
                <div className="bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center mb-6">
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhum cliente encontrado
                </h3>
                <p className="text-gray-500 text-center max-w-md mb-6">
                  {debouncedSearchQuery ||
                  Object.values(clientFilters).some(
                    (value) => value && value !== "all"
                  )
                    ? "Tente ajustar os filtros ou termos de busca para encontrar clientes."
                    : "Comece adicionando seu primeiro cliente ao sistema."}
                </p>
                {!debouncedSearchQuery &&
                  !Object.values(clientFilters).some(
                    (value) => value && value !== "all"
                  ) && (
                    <Button
                      onClick={() => setIsClientModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
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
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    {clientsArray.length} cliente(s) carregado(s) nesta página
                  </span>
                </div>

                {hasNextPage && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
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
        filters={clientFilters}
        searchQuery={debouncedSearchQuery}
        userId={user?.id}
        userRole={user?.role}
      />

      <BulkDealCreationModalForClients
        open={isBulkDealModalOpen}
        onOpenChange={setIsBulkDealModalOpen}
        clients={selectedClients}
      />
    </div>
  );
}
