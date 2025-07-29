import { useState } from "react";
import Sidebar from "@/components/sidebar";
import ClientsTableWithSelection from "@/components/clients-table-with-selection";
import ClientFormModal from "@/components/client-form-modal";
import ClientFilters, {
  ClientFilters as ClientFiltersType,
} from "@/components/client-filters";
import ClientImportModal from "@/components/client-import-modal";
import { Button } from "@/components/ui/button";
import { Plus, Search, Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel, formatClientDataForExport } from "@/lib/excel-export";

export default function Clients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clientes");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
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

  const clientsArray = Array.isArray(allClients) ? allClients : [];

  const handleExportClients = async () => {
    if (!clientsArray || clientsArray.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há clientes cadastrados para exportar",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const formattedData = formatClientDataForExport(clientsArray);
      await exportToExcel(formattedData, "clientes");

      toast({
        title: "Exportação concluída",
        description: `${clientsArray.length} clientes foram exportados com sucesso`,
      });
    } catch (error) {
      console.error("Erro na exportação:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados dos clientes",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
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
              <div className="grid grid-cols-1 sm:grid-cols space-x-4">
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
                <ClientFilters
                  currentFilters={clientFilters}
                  onFiltersChange={setClientFilters}
                />
                <Button
                  variant="outline"
                  onClick={handleExportClients}
                  disabled={isExporting}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exportando..." : "Exportar"}
                </Button>
              </div>
            </div>

            {/* Clients Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <ClientsTableWithSelection
                clients={clientsArray}
                searchQuery={searchQuery}
                filters={clientFilters}
              />
            </div>
          </div>
        </div>
      </main>

      <ClientFormModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
      />

      <ClientImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
      />
    </div>
  );
}
