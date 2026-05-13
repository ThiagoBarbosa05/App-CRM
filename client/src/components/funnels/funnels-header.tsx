import { Button } from "@/components/ui/button";
import { Plus, GitBranch, ArrowLeft, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface FunnelsHeaderProps {
  viewMode: "list" | "kanban" | "stages";
  selectedFunnelName?: string;
  isActive?: boolean;
  onBackToList: () => void;
  onNewFunnelClick: () => void;
}

export function FunnelsHeader({
  viewMode,
  selectedFunnelName,
  isActive,
  onBackToList,
  onNewFunnelClick,
}: FunnelsHeaderProps) {
  const isListView = viewMode === "list";

  return (
    <div className="bg-card border border-border px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative">
      {/* Decorative gradient blur — overflow isolado para não clipar conteúdo no mobile */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 w-full flex-1">
          {!isListView && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToList}
              className="h-10 w-10 text-slate-500 hover:text-primary hover:bg-accent rounded-xl flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary flex-shrink-0 shadow-inner">
            {viewMode === "stages" ? (
              <Settings className="h-6 w-6" />
            ) : (
              <GitBranch className="h-6 w-6" />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {isListView ? "Funis de Vendas" : selectedFunnelName}
              {!isListView && isActive !== undefined && (
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className={`ml-3 align-middle ${
                    isActive
                      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800"
                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  }`}
                >
                  {isActive ? "Ativo" : "Inativo"}
                </Badge>
              )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 line-clamp-2">
              {isListView
                ? "Configure e gerencie seus funis de vendas e pipelines"
                : viewMode === "kanban"
                  ? "Board Kanban - Gerencie seus deals e oportunidades"
                  : "Gerencie etapas do funil de vendas"}
            </p>
          </div>
        </div>

        {isListView && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 w-full md:w-auto"
          >
            <Button
              onClick={onNewFunnelClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-6 h-11 rounded-xl flex-1 md:flex-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Funil
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
