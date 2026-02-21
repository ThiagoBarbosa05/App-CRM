import { ClipboardList, AlertCircle } from "lucide-react";

interface AcompanhamentoHeaderProps {
  totalPendentes: number;
}

export function AcompanhamentoHeader({ totalPendentes }: AcompanhamentoHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center border border-blue-100 dark:border-slate-700 shadow-inner shrink-0">
            <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              Acompanhamento
            </h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Clientes que precisam ser contactados nesta semana
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 self-stretch md:self-auto bg-slate-50 dark:bg-slate-950/50 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800 w-full md:w-auto mt-2 md:mt-0">
          <div className="flex-1 text-right md:text-left">
            <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 leading-none">
              {totalPendentes}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1 whitespace-nowrap">
              Clientes pendentes
            </div>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 shadow-sm border border-orange-200 dark:border-orange-800/50">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
