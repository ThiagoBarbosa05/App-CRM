import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Eye, Settings, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SalesFunnel } from "../funnels-management";

interface FunnelCardProps {
  funnel: SalesFunnel;
  currentUser: { id: string; role: string } | null;
  onViewBoard: (funnel: SalesFunnel) => void;
  onManageStages: (funnel: SalesFunnel) => void;
  onEdit: (funnel: SalesFunnel) => void;
  onDelete: (funnel: SalesFunnel) => void;
}

export function FunnelCard({
  funnel,
  currentUser,
  onViewBoard,
  onManageStages,
  onEdit,
  onDelete,
}: FunnelCardProps) {
  const canEdit = currentUser?.role === "admin" || currentUser?.id === funnel.createdBy;
  const isActive = funnel.isActive === "true";

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="h-full hover:shadow-xl transition-all duration-300 border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden bg-white dark:bg-slate-900 group">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform">
                <GitBranch className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {funnel.name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0 ${
                      isActive
                        ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300"
                        : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            </div>

            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-200 dark:border-slate-800">
                  <DropdownMenuItem onClick={() => onEdit(funnel)} className="gap-2 cursor-pointer rounded-lg">
                    <Edit className="h-4 w-4" />
                    <span>Editar Infomações</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onManageStages(funnel)} className="gap-2 cursor-pointer rounded-lg">
                    <Settings className="h-4 w-4" />
                    <span>Gerenciar Etapas</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(funnel)} className="gap-2 text-red-600 dark:text-red-400 cursor-pointer rounded-lg focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                    <span>Excluir Funil</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <CardDescription className="text-slate-500 dark:text-slate-400 mt-3 line-clamp-2 h-10 leading-relaxed">
            {funnel.description || "Sem descrição disponível"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-2 flex-grow">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Pipeline
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {funnel.stages?.length || 0} etapas
              </span>
            </div>

            <div className="flex items-center -space-x-2 overflow-hidden">
              {funnel.stages?.slice(0, 5).map((stage, idx) => (
                <div
                  key={stage.id}
                  className="h-8 flex-grow border-r border-white dark:border-slate-900 first:rounded-l-lg last:rounded-r-lg"
                  style={{ backgroundColor: stage.color, opacity: 1 - idx * 0.15 }}
                  title={stage.name}
                />
              ))}
              {(!funnel.stages || funnel.stages.length === 0) && (
                <div className="h-8 flex-grow bg-slate-100 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                  <span className="text-[10px] text-slate-400">Nenhuma etapa configurada</span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-auto">
              <Button
                variant="outline"
                className="w-full border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 rounded-xl group/btn transition-all py-5"
                onClick={() => onViewBoard(funnel)}
              >
                <Eye className="h-4 w-4 mr-2 group/btn-hover:scale-110" />
                Abrir Board Kanban
              </Button>
            </div>
          </div>
        </CardContent>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 truncate max-w-[140px]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            Por {funnel.creator?.name || "Desconhecido"}
          </span>
          <span>{new Date(funnel.createdAt).toLocaleDateString("pt-BR")}</span>
        </div>
      </Card>
    </motion.div>
  );
}
