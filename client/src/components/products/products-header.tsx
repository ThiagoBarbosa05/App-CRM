import { Button } from "@/components/ui/button";
import { Download, Upload, Plus, Wine } from "lucide-react";
import { motion } from "framer-motion";

interface ProductsHeaderProps {
  onImportClick: () => void;
  onExportClick: () => void;
  onNewProductClick: () => void;
  isExportPending: boolean;
  productsCount: number;
}

export function ProductsHeader({
  onImportClick,
  onExportClick,
  onNewProductClick,
  isExportPending,
  productsCount,
}: ProductsHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center border border-blue-100 dark:border-slate-700 shadow-inner shrink-0">
            <Wine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              Catálogo de Produtos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Gerencie e explore o catálogo de vinhos e produtos
            </p>
          </div>
        </div>

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
            onClick={onNewProductClick}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all rounded-xl w-full sm:w-auto font-medium"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>
    </div>
  );
}
