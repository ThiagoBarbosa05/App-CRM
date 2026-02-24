import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import FunnelKanbanBoard from "@/components/funnel-kanban-board";
import FunnelStagesManager from "@/components/funnel-stages-manager";
import { UpdateFunnelForm } from "./update-funnel-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

// Extracted Components
import { FunnelsHeader } from "./funnels/funnels-header";
import { FunnelsGrid } from "./funnels/funnels-grid";

export interface SalesFunnel {
  id: string;
  name: string;
  description?: string;
  isActive: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stages: FunnelStage[];
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

interface FunnelStage {
  id: string;
  funnelId: string;
  name: string;
  order: number;
  color: string;
  createdAt: Date;
}

export default function FunnelsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [newFunnelDescription, setNewFunnelDescription] = useState("");
  const [selectedFunnel, setSelectedFunnel] = useState<SalesFunnel | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "stages">(
    "list",
  );
  const [editingFunnel, setEditingFunnel] = useState<SalesFunnel | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [funnelToDelete, setFunnelToDelete] = useState<SalesFunnel | null>(null);

  const { data: funnels, isLoading } = useQuery({
    queryKey: ["/api/funnels"],
  });

  const createFunnelMutation = useMutation({
    mutationFn: async (funnelData: {
      name: string;
      description?: string;
      createdBy: string;
    }) => {
      const response = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(funnelData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar funil");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Funil criado com sucesso",
        description: "O novo funil de vendas foi criado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      setIsCreateModalOpen(false);
      setNewFunnelName("");
      setNewFunnelDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFunnelMutation = useMutation({
    mutationFn: async (funnelId: string) => {
      const response = await fetch(`/api/funnels/${funnelId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao deletar funil");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Funil deletado com sucesso",
        description: "O funil de vendas foi deletado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      setFunnelToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateFunnel = () => {
    if (!newFunnelName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do funil",
        variant: "destructive",
      });
      return;
    }

    createFunnelMutation.mutate({
      name: newFunnelName,
      description: newFunnelDescription,
      createdBy: user?.id || "",
    });
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedFunnel(null);
    setEditingFunnel(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="h-10 w-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        <div className="text-slate-500 font-medium">Carregando funis...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FunnelsHeader
        viewMode={viewMode}
        selectedFunnelName={selectedFunnel?.name || editingFunnel?.name}
        isActive={(selectedFunnel || editingFunnel)?.isActive === "true"}
        onBackToList={handleBackToList}
        onNewFunnelClick={() => setIsCreateModalOpen(true)}
      />

      {viewMode === "list" && (
        <FunnelsGrid
          funnels={funnels || []}
          currentUser={user}
          onViewBoard={(funnel) => {
            setSelectedFunnel(funnel);
            setViewMode("kanban");
          }}
          onManageStages={(funnel) => {
            setEditingFunnel(funnel);
            setViewMode("stages");
          }}
          onEdit={(funnel) => {
            setEditingFunnel(funnel);
            setIsUpdateModalOpen(true);
          }}
          onDelete={(funnel) => setFunnelToDelete(funnel)}
          onNewFunnelClick={() => setIsCreateModalOpen(true)}
        />
      )}

      {viewMode === "kanban" && selectedFunnel && (
        <FunnelKanbanBoard
          funnelId={selectedFunnel.id}
          funnel={selectedFunnel}
        />
      )}

      {viewMode === "stages" && editingFunnel && (
        <FunnelStagesManager funnel={editingFunnel as any} />
      )}

      {/* Modals */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px] gap-6 rounded-3xl border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-2xl">Novo Funil de Vendas</DialogTitle>
            <DialogDescription className="text-slate-500">
              Crie um novo pipeline para gerenciar suas oportunidades de negócio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nome do Funil
              </Label>
              <Input
                id="name"
                value={newFunnelName}
                onChange={(e) => setNewFunnelName(e.target.value)}
                placeholder="Ex: Novos Leads, Vendas B2B..."
                className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Descrição
              </Label>
              <Textarea
                id="description"
                value={newFunnelDescription}
                onChange={(e) => setNewFunnelDescription(e.target.value)}
                placeholder="Descreva brevemente o propósito deste funil..."
                className="min-h-[100px] rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-6 h-11 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateFunnel}
              disabled={createFunnelMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-8 h-11 rounded-xl"
            >
              {createFunnelMutation.isPending ? "Criando..." : "Criar Funil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="sm:max-w-[500px] gap-6 rounded-3xl border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-2xl">Editar Funil</DialogTitle>
            <DialogDescription className="text-slate-500">
              Atualize as informações do seu pipeline de vendas.
            </DialogDescription>
          </DialogHeader>
          {editingFunnel && (
            <UpdateFunnelForm
              openUpdateModal={setIsUpdateModalOpen}
              funnel={editingFunnel}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!funnelToDelete}
        onOpenChange={(open) => !open && setFunnelToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 leading-relaxed">
              Você está prestes a excluir o funil <strong className="text-slate-900 dark:text-white">"{funnelToDelete?.name}"</strong>.
              Todas as etapas deste funil serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl border-slate-200 dark:border-slate-800 px-6 h-11">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => funnelToDelete && deleteFunnelMutation.mutate(funnelToDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 px-6 h-11 rounded-xl"
              disabled={deleteFunnelMutation.isPending}
            >
              {deleteFunnelMutation.isPending ? "Excluindo..." : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
