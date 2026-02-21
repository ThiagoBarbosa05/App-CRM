import { Button } from "@/components/ui/button";
import {
  Plus,
  Download,
  Upload,
  Building2,
  Edit2,
  Trash,
} from "lucide-react";

interface CompaniesHeaderProps {
  onImportClick: () => void;
  onExportClick: () => void;
  onNewCompanyClick: () => void;
  onBulkEditClick: () => void;
  onBulkDealClick: () => void;
  onBulkDeleteClick: () => void;
  isExportPending: boolean;
  isBulkDeletePending: boolean;
  selectedCount: number;
}

export function CompaniesHeader({
  onImportClick,
  onExportClick,
  onNewCompanyClick,
  onBulkEditClick,
  onBulkDealClick,
  onBulkDeleteClick,
  isExportPending,
  isBulkDeletePending,
  selectedCount,
}: CompaniesHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center border border-blue-100 dark:border-slate-700 shadow-inner shrink-0">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              Empresas
            </h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Gerencie as empresas cadastradas no sistema
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {selectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-950/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 w-full md:w-auto animate-in fade-in slide-in-from-right-2 duration-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkEditClick}
                className="h-9 px-3 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 transition-all rounded-lg"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Edição</span>
                <span className="sm:hidden">Edit</span> ({selectedCount})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkDealClick}
                className="h-9 px-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-all rounded-lg font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Negócios
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkDeleteClick}
                disabled={isBulkDeletePending}
                className="h-9 px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all rounded-lg"
              >
                <Trash className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onImportClick}
                className="h-10 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl grow sm:grow-0"
              >
                <Upload className="mr-2 h-4 w-4 text-slate-500" />
                Importar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportClick}
                disabled={isExportPending}
                className="h-10 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl grow sm:grow-0"
              >
                <Download className="mr-2 h-4 w-4 text-slate-500" />
                {isExportPending ? "Gerando..." : "Exportar"}
              </Button>
              <Button
                onClick={onNewCompanyClick}
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all rounded-xl w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Empresa
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
