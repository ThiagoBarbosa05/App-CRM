import { Users, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClientsHeaderProps {
  totalItems: number;
  onImportClick: () => void;
  onNewClientClick: () => void;
}

export function ClientsHeader({
  totalItems,
  onImportClick,
  onNewClientClick,
}: ClientsHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-950 border-b dark:border border-gray-200 dark:border-slate-700 px-6 py-4 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-4">
          <Users className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Clientes
              </h2>
              {totalItems > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  {totalItems} {totalItems === 1 ? "cliente" : "clientes"}
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Gerencie seus clientes e informações de contato
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onImportClick}
            className="text-wine-600 dark:text-purple-400 border-wine-600 dark:border-purple-600 hover:bg-wine-50 dark:hover:bg-purple-900/30"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button
            onClick={onNewClientClick}
            className="bg-primary hover:bg-primary-dark dark:bg-purple-600 dark:hover:bg-purple-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>
    </div>
  );
}
