import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Users, Edit, Trash, MoreHorizontal } from "lucide-react";

interface UmblerContactActionsProps {
  contact: any;
  onViewDetails: (contact: any) => void;
  onEdit: (contact: any) => void;
  onDeleteClick: (contactId: string) => void;
}

export function UmblerContactActions({
  contact,
  onViewDetails,
  onEdit,
  onDeleteClick,
}: UmblerContactActionsProps) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 border-slate-200 dark:border-slate-800 shadow-lg">
          <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-2">
            Ações
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
          <DropdownMenuItem
            onClick={() => onViewDetails(contact)}
            className="cursor-pointer gap-3 text-slate-700 dark:text-slate-300 focus:bg-slate-100 dark:focus:bg-slate-800 py-2.5"
          >
            <Users className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Ver Detalhes</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEdit(contact)}
            className="cursor-pointer gap-3 text-slate-700 dark:text-slate-300 focus:bg-slate-100 dark:focus:bg-slate-800 py-2.5"
          >
            <Edit className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">Editar Contato</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
          <DropdownMenuItem
            onClick={() => onDeleteClick(contact.id)}
            className="cursor-pointer gap-3 text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-700 py-2.5"
          >
            <Trash className="h-4 w-4" />
            <span className="font-medium">Excluir</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
