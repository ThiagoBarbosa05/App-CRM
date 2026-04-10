import { Search, Briefcase, Download, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ClientFilters, { ClientFilters as ClientFiltersType } from "@/components/client-filters";

interface ClientsActionsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  clientFilters: ClientFiltersType;
  onFiltersChange: (filters: ClientFiltersType) => void;
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDealClick: () => void;
  onExportClick: () => void;
  isExporting: boolean;
  isAdmin?: boolean;
  users?: { id: string; name: string }[];
}

export function ClientsActions({
  searchQuery,
  onSearchChange,
  clientFilters,
  onFiltersChange,
  selectedCount,
  onClearSelection,
  onBulkDealClick,
  onExportClick,
  isExporting,
  isAdmin,
  users = [],
}: ClientsActionsProps) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 px-6 py-4 rounded-lg shadow-sm">
      <div className="flex flex-col lg:flex-row gap-2">
        {/* Seletor de vendedor — admin/gerente */}
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Users className="h-4 w-4 text-slate-400" />
            <Select
              value={clientFilters.responsavelId}
              onValueChange={(val) =>
                onFiltersChange({ ...clientFilters, responsavelId: val })
              }
            >
              <SelectTrigger className="w-48 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-semibold">
                  Todos os vendedores
                </SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 h-4 w-4" />
          <Input
            type="text"
            placeholder="Buscar clientes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <ClientFilters
            currentFilters={clientFilters}
            onFiltersChange={onFiltersChange}
          />
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {selectedCount} selecionados
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  ×
                </Button>
              </div>
            )}
            {selectedCount > 0 && (
              <Button
                variant="outline"
                onClick={onBulkDealClick}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white border-blue-600 dark:border-blue-700"
                data-testid="button-bulk-deals"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Criar Negócios em Lote ({selectedCount})
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onExportClick}
              className="w-full"
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Preparando..." : selectedCount > 0 ? `Exportar ${selectedCount} Selecionados` : "Exportar Todos"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
