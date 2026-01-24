import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  GitBranch,
  Edit,
  Trash2,
  Eye,
  ArrowLeft,
  Settings,
} from "lucide-react";
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
  AlertDialogTrigger,
} from "./ui/alert-dialog";

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
  const [updateFunnelModal, setUpdateFunnelModal] = useState<boolean>(false);

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

      const result = await response.json();
      console.log("response: ", result);
      return result;
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

      const result = await response.json();
      console.log("response: ", result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Funil deletado com sucesso",
        description: "O funil de vendas foi deletado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      setIsCreateModalOpen(false);
      setNewFunnelName("");
      setNewFunnelDescription("");
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

  if (isLoading) {
    return (
      <div className="flex items-center dark:text-slate-400 justify-center h-64">
        <div className="text-lg">Carregando funis...</div>
      </div>
    );
  }

  // Show kanban board for selected funnel
  if (viewMode === "kanban" && selectedFunnel) {
    return (
      <div>
        <div className="mb-6">
          <div className="border-b border-gray-100 dark:border-slate-700 d dark:bg-slate-900 bg-gray-50 -m-6 mb-6 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewMode("list");
                    setSelectedFunnel(null);
                  }}
                  className="border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-400 dark:hover:border-slate-600 transition-colors w-full sm:w-auto"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 dark:bg-slate-800 mr-2">
                    <ArrowLeft className="h-3 w-3 text-gray-600 dark:text-slate-400" />
                  </div>
                  <span className="hidden xs:inline">Voltar aos Funis</span>
                  <span className="xs:hidden">Voltar</span>
                </Button>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-blue-100 dark:bg-slate-800 flex-shrink-0">
                    <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">
                      {selectedFunnel.name}
                    </h2>
                    <p className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm mt-1 truncate">
                      Board Kanban - Gerencie seus deals e oportunidades
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Badge
                  variant={
                    selectedFunnel.isActive === "true" ? "default" : "secondary"
                  }
                  className={
                    selectedFunnel.isActive === "true"
                      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-400 dark:border-green-700"
                      : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  }
                >
                  {selectedFunnel.isActive === "true" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <FunnelKanbanBoard
          funnelId={selectedFunnel.id}
          funnel={selectedFunnel}
        />
      </div>
    );
  }

  // Show stages manager for selected funnel
  if (viewMode === "stages" && editingFunnel) {
    return (
      <div>
        <div className="mb-6">
          <div className="border-b border-gray-100 bg-gray-50 -m-6 mb-6 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewMode("list");
                    setSelectedFunnel(null);
                  }}
                  className="border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors w-full sm:w-auto"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 mr-2">
                    <ArrowLeft className="h-3 w-3 text-gray-600" />
                  </div>
                  <span className="hidden xs:inline">Voltar aos Funis</span>
                  <span className="xs:hidden">Voltar</span>
                </Button>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-orange-100 flex-shrink-0">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                      {editingFunnel.name}
                    </h2>
                    <p className="text-gray-600 text-xs sm:text-sm mt-1 truncate">
                      Gerencie etapas do funil de vendas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <FunnelStagesManager funnel={editingFunnel as any} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="bg-white dark:bg-slate-950 border-b w-full border-gray-200 dark:border-slate-700 dark:border px-6 py-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-4">
              <GitBranch className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  Funis de Vendas
                </h2>
                <p className="text-gray-600 dark:text-slate-400 mt-1">
                  Configure e gerencie seus funis de vendas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Dialog
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary-dark text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Funil
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Funil</DialogTitle>
                    <DialogDescription>
                      Configure um novo funil de vendas para sua equipe
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nome do Funil</Label>
                      <Input
                        id="name"
                        value={newFunnelName}
                        onChange={(e) => setNewFunnelName(e.target.value)}
                        placeholder="Ex: Vendas Online"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Descrição (opcional)</Label>
                      <Textarea
                        id="description"
                        value={newFunnelDescription}
                        onChange={(e) =>
                          setNewFunnelDescription(e.target.value)
                        }
                        placeholder="Descreva o objetivo deste funil de vendas"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateModalOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateFunnel}
                      disabled={createFunnelMutation.isPending}
                    >
                      {createFunnelMutation.isPending
                        ? "Criando..."
                        : "Criar Funil"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {(funnels as SalesFunnel[])?.map((funnel: SalesFunnel) => (
          <Card
            key={funnel.id}
            className="hover:shadow-lg flex flex-col transition-all duration-200 border dark:border-slate-700 dark:hover:border-slate-600 border-gray-200 hover:border-gray-300"
          >
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                    <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">
                    {funnel.name}
                  </CardTitle>
                </div>
                <Badge
                  variant={funnel.isActive === "true" ? "default" : "secondary"}
                  className={
                    funnel.isActive === "true"
                      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700"
                      : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  }
                >
                  {funnel.isActive === "true" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription className="text-sm text-gray-600 dark:text-slate-400 mt-2 line-clamp-2">
                {funnel.description || "Sem descrição"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="flex flex-col gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-400">
                      Estágios
                    </p>
                    <span className="text-sm text-gray-500 bg-gray-100 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 rounded-full">
                      {funnel.stages?.length || 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {funnel.stages?.slice(0, 3).map((stage) => (
                      <Badge
                        key={stage.id}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: stage.color, color: stage.color }}
                      >
                        {stage.name}
                      </Badge>
                    ))}
                    {funnel.stages && funnel.stages.length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-xs text-gray-500 dark:text-slate-400"
                      >
                        +{funnel.stages.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-slate-700 pt-3">
                  <span className="truncate">
                    Criado por: {funnel.creator?.name || "N/A"}
                  </span>
                  <span className="text-right sm:text-left">
                    {new Date(funnel.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="flex  items-center gap-2"
                    size="sm"
                    onClick={() => {
                      setSelectedFunnel(funnel);
                      setViewMode("kanban");
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    Ver Board
                  </Button>
                  {(user?.role === "admin" ||
                    user?.id === funnel.createdBy) && (
                    <>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        size="sm"
                        onClick={() => {
                          setEditingFunnel(funnel);
                          setViewMode("stages");
                        }}
                      >
                        <Settings className="h-4 w-4" />
                        Etapas
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            className="flex items-center gap-2"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingFunnel(funnel)}
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Funil</DialogTitle>
                            <DialogDescription>
                              Atualize as informações do funil
                            </DialogDescription>
                          </DialogHeader>

                          <UpdateFunnelForm
                            openUpdateModal={setUpdateFunnelModal}
                            funnel={funnel}
                          />
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-800 flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4 " />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Confirmar exclusão
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o funil "
                              {funnel.name}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={deleteFunnelMutation.isPending}
                              onClick={() =>
                                deleteFunnelMutation.mutate(funnel.id)
                              }
                            >
                              {deleteFunnelMutation.isPending
                                ? "Excluindo..."
                                : "Excluir"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!funnels || (funnels as SalesFunnel[]).length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-gray-400 dark:text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                Nenhum funil encontrado
              </h3>
              <p className="text-gray-500 d ark:text-slate-400 mb-4">
                Crie seu primeiro funil de vendas para começar
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Funil
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
