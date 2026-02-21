import { Button } from "@/components/ui/button";
import { UmblerContactDialog } from "@/components/umbler-contact-dialog";
import { Users, Send } from "lucide-react";
import { useLocation } from "wouter";

interface UmblerContactsHeaderProps {
  totalContacts: number;
  isLoading: boolean;
}

export function UmblerContactsHeader({
  totalContacts,
  isLoading,
}: UmblerContactsHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Header Profile & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner border border-blue-200/50 dark:border-blue-800/50">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Contatos Umbler
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Gerencie todos os seus contatos sincronizados do Umbler uTalk
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setLocation("/umbler/campaigns/create")}
              variant="outline"
              className="gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Send className="h-4 w-4 text-slate-500" />
              Criar Campanha
            </Button>
            <UmblerContactDialog />
          </div>
        </div>
      </div>

      {/* Stats Cards Row (can be expanded later) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm group hover:border-blue-300 dark:hover:border-blue-700/50 transition-all duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Total de Contatos
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {isLoading ? (
                    <span className="animate-pulse bg-slate-200 dark:bg-slate-700 h-8 w-16 rounded inline-block" />
                  ) : (
                    totalContacts
                  )}
                </h3>
              </div>
            </div>
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-all duration-300">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        {/* Placeholder for future stats to balance the UI */}
        <div className="hidden sm:block lg:col-span-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm border-dashed opacity-70 flex items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center">Mais métricas de engajamento em breve</p>
        </div>
      </div>
    </div>
  );
}
