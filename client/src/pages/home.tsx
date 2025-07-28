import { useState } from "react";
import Sidebar from "@/components/sidebar";
import ClientsTableWithSelection from "@/components/clients-table-with-selection";
import ClientFormModal from "@/components/client-form-modal";
import ClientFilters, { ClientFilters as ClientFiltersType } from "@/components/client-filters";
import FunnelsManagement from "@/components/funnels-management";

import ClientImportModal from "@/components/client-import-modal";
import SettingsManagement from "@/components/settings-management";
import { Button } from "@/components/ui/button";
import { Plus, Search, Download, LogOut, User, Wine, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel, formatClientDataForExport } from "@/lib/excel-export";

type Tab = "clientes" | "funis" | "configuracoes";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("clientes");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [clientFilters, setClientFilters] = useState<ClientFiltersType>({
    name: "",
    phone: "",
    cpf: "",
    email: "",
    responsavelId: "",
    categoria: "",
    origem: "",
    markers: "",
  });

  // Buscar dados dos clientes para exportação
  const { data: allClients } = useQuery({
    queryKey: ["/api/clients"],
    enabled: activeTab === "clientes", // Só busca quando está na aba de clientes
  });

  const clientsArray = Array.isArray(allClients) ? allClients : [];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "gerente": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "vendedor": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "gerente": return "Gerente";
      case "vendedor": return "Vendedor";
      default: return role;
    }
  };

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
      const fileName = `clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}_${new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-')}`;
      
      exportToExcel(formattedData, fileName, 'Clientes');
      
      toast({
        title: "Exportação realizada com sucesso",
        description: `${clientsArray.length} clientes foram exportados para Excel`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 h-16">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center space-x-4">
            <Wine className="h-8 w-8 text-wine-600" />
            <h1 className="text-xl font-bold text-gray-900">VinoCRM</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{user?.name}</span>
              </div>
              <Badge className={getRoleBadgeColor(user?.role || "")}>
                {getRoleLabel(user?.role || "")}
              </Badge>

            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="pt-16">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden pt-16">
        {activeTab === "clientes" ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
                  <p className="text-gray-600 mt-1">Gerencie seus clientes e informações de contato</p>
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
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Buscar clientes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
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
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exportando..." : "Exportar"}
                </Button>
              </div>
            </div>

            <ClientsTableWithSelection 
              clients={clientsArray} 
              searchQuery={searchQuery}
              filters={clientFilters}
            />
          </div>
        ) : activeTab === "funis" ? (
          <FunnelsManagement />
        ) : activeTab === "configuracoes" ? (
          <SettingsManagement />
        ) : null}
      </div>

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
