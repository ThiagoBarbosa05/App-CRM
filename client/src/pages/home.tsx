import { useState } from "react";
import Sidebar from "@/components/sidebar";
import ClientsTable from "@/components/clients-table";
import KanbanBoard from "@/components/kanban-board";
import ClientFormModal from "@/components/client-form-modal";
import DealFormModal from "@/components/deal-form-modal";
import ClientFilters, { ClientFilters as ClientFiltersType } from "@/components/client-filters";
import { Button } from "@/components/ui/button";
import { Plus, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

type Tab = "clientes" | "negocios";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("clientes");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilters, setClientFilters] = useState<ClientFiltersType>({
    name: "",
    phone: "",
    cpf: "",
    email: "",
    responsible: "",
    categoria: "",
    origem: "",
    markers: "",
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "clientes" ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
                  <p className="text-gray-600 mt-1">Gerencie seus clientes e informações de contato</p>
                </div>
                <Button 
                  onClick={() => setIsClientModalOpen(true)}
                  className="bg-primary hover:bg-primary-dark text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Button>
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
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>

            <ClientsTable searchQuery={searchQuery} filters={clientFilters} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Negócios</h2>
                  <p className="text-gray-600 mt-1">Gerencie seus negócios em andamento</p>
                </div>
                <Button 
                  onClick={() => setIsDealModalOpen(true)}
                  className="bg-primary hover:bg-primary-dark text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Negócio
                </Button>
              </div>
            </div>

            <KanbanBoard />
          </div>
        )}
      </div>

      <ClientFormModal 
        open={isClientModalOpen} 
        onOpenChange={setIsClientModalOpen} 
      />
      
      <DealFormModal 
        open={isDealModalOpen} 
        onOpenChange={setIsDealModalOpen} 
      />
    </div>
  );
}
