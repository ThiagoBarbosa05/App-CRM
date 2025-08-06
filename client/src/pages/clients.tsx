import { useCallback, useState } from "react";
import Sidebar from "@/components/sidebar";
import ClientsTableWithSelection from "@/components/clients-table-with-selection";
import ClientFormModal from "@/components/client-form-modal";
import ClientFilters, {
  ClientFilters as ClientFiltersType,
} from "@/components/client-filters";
import ClientImportModal from "@/components/client-import-modal";
import ClientExportModal from "@/components/client-export-modal";
import { Button } from "@/components/ui/button";
import { Plus, Search, Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Clients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clientes");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<any[]>([]);
  const [clientFilters, setClientFilters] = useState<ClientFiltersType>({
    name: "",
    phone: "",
    cpf: "",
    responsavelId: "all",
    categoria: "",
    origem: "",
    markers: "",
  });

  // Buscar dados dos clientes para exportação
  const { data: allClients } = useQuery({
    queryKey: ["/api/clients", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(
        user?.role === "admin"
          ? "/api/clients"
          : `/api/clients?userId=${user?.id}&userRole=${user?.role}`,
      );
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: !!user,
  });

  // Buscar dados dos usuários para mapear responsáveis
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const clientsArray = Array.isArray(allClients) ? allClients : [];
  const usersArray = Array.isArray(users) ? users : [];

  const handleSelectionChange = useCallback(
    (selectedIds: string[], selectedClientsData: any[]) => {
      setSelectedClientIds(selectedIds);
      setSelectedClients(selectedClientsData);
    },
    [],
  );

  return (
    <div className=" bg-gray-50 dark:bg-gray-900">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
              <p className="text-gray-600 mt-1">
                Gerencie seus clientes e informações de contato
              </p>
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
                onFiltersChange={setClientFilters}
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
                      onClick={() => {
                        setSelectedClientIds([]);
                        setSelectedClients([]);
                      }}
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {selectedClients.length > 0
                    ? `Exportar ${selectedClients.length} Selecionados`
                    : "Exportar Todos"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-lg">
          <ClientsTableWithSelection
            clients={clientsArray}
            searchQuery={searchQuery}
            filters={clientFilters}
            onSelectionChange={handleSelectionChange}
          />
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
        clients={clientsArray}
        selectedClients={selectedClients}
        users={usersArray}
      />
    </div>
  );
}
