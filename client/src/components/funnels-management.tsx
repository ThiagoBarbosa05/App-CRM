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
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando funis...</div>
      </div>
    );
  }

  // Show kanban board for selected funnel
  if (viewMode === "kanban" && selectedFunnel) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setViewMode("list");
                setSelectedFunnel(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar aos Funis
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedFunnel.name}
              </h2>
              <p className="text-gray-600 mt-1">
                Board Kanban - Gerencie seus deals
              </p>
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setViewMode("list");
                setEditingFunnel(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar aos Funis
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {editingFunnel.name}
              </h2>
              <p className="text-gray-600 mt-1">Gerenciar Etapas do Funil</p>
            </div>
          </div>
        </div>
        <FunnelStagesManager funnel={editingFunnel as any} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center flex-wrap gap-4 justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Funis de Vendas</h2>
          <p className="text-gray-600 mt-1">
            Configure e gerencie seus funis de vendas
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
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
                  onChange={(e) => setNewFunnelDescription(e.target.value)}
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
                {createFunnelMutation.isPending ? "Criando..." : "Criar Funil"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(funnels as SalesFunnel[])?.map((funnel: SalesFunnel) => (
          <Card
            key={funnel.id}
            className="hover:shadow-lg min-w-[248px] flex flex-col transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GitBranch className="h-5 w-5 text-wine-600" />
                  <CardTitle className="text-lg">{funnel.name}</CardTitle>
                </div>
                <Badge
                  variant={funnel.isActive === "true" ? "default" : "secondary"}
                >
                  {funnel.isActive === "true" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription>
                {funnel.description || "Sem descrição"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 w-full flex">
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    Estágios ({funnel.stages?.length || 0}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {funnel.stages?.map((stage) => (
                      <Badge
                        key={stage.id}
                        variant="outline"
                        style={{ borderColor: stage.color, color: stage.color }}
                      >
                        {stage.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Criado por: {funnel.creator?.name}</span>
                  <span>
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
              <GitBranch className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum funil encontrado
              </h3>
              <p className="text-gray-500 mb-4">
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
