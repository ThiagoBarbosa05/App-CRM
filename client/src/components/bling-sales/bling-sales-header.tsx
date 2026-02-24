import { HandCoins, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface BlingSalesHeaderProps {
  onExport: () => void;
  isExporting: boolean;
  disabled: boolean;
}

export function BlingSalesHeader({ onExport, isExporting, disabled }: BlingSalesHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 dark:bg-green-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0 shadow-inner">
            <HandCoins className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              Vendas Bling
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 truncate">
              Acompanhe e analise o desempenho comercial integrado ao Bling ERP
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-wrap items-center gap-3 w-full md:w-auto"
        >
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Página em Desenvolvimento
            </span>
          </div>

          <Button 
            onClick={onExport} 
            disabled={disabled || isExporting}
            className="gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl h-11 px-5 font-bold transition-all shadow-sm"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Exportar Excel</span>
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
