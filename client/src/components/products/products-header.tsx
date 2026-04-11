import { Button } from "@/components/ui/button";
import { Download, Upload, Plus, Wine, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface ProductsHeaderProps {
  onImportClick: () => void;
  onExportClick: () => void;
  onNewProductClick: () => void;
  onBlingSync: () => void;
  isExportPending: boolean;
  productsCount: number;
}

export function ProductsHeader({
  onImportClick,
  onExportClick,
  onNewProductClick,
  onBlingSync,
  isExportPending,
  productsCount,
}: ProductsHeaderProps) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 px-6 py-6 rounded-3xl shadow-sm relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/10 dark:bg-purple-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5 min-w-0 w-full xl:w-auto">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-blue-100/50 dark:border-slate-700 shadow-inner shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
            <Wine className="h-7 w-7 text-blue-600 dark:text-blue-400 relative z-10" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 truncate tracking-tight">
              Catálogo de Produtos
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>Gerencie e explore seu portfólio de vinhos</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {productsCount} itens
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onBlingSync}
            className="h-11 px-5 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl grow sm:grow-0 text-slate-600 dark:text-slate-300 font-medium hover:border-blue-200 dark:hover:border-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 group"
          >
            <RefreshCw className="mr-2.5 h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            Sincronizar Bling
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onImportClick}
            className="h-11 px-5 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl grow sm:grow-0 text-slate-600 dark:text-slate-300 font-medium hover:border-blue-200 dark:hover:border-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 group"
          >
            <Upload className="mr-2.5 h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            Importar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportClick}
            disabled={isExportPending}
            className="h-11 px-5 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl grow sm:grow-0 text-slate-600 dark:text-slate-300 font-medium hover:border-blue-200 dark:hover:border-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 group disabled:opacity-50"
          >
            <Download className="mr-2.5 h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            {isExportPending ? "Exportando..." : "Exportar"}
          </Button>
          <Button
            onClick={onNewProductClick}
            className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-md shadow-blue-500/20 transition-all rounded-xl w-full sm:w-auto font-semibold tracking-wide"
          >
            <Plus className="mr-2.5 h-4.5 w-4.5" />
            Novo Produto
          </Button>
        </div>
      </div>
    </div>
  );
}
