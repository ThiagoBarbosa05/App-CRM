import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2, GripVertical, Palette } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SalesFunnel {
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
  createdAt: string;
}

interface FunnelStagesManagerProps {
  funnel: SalesFunnel;
}

const defaultColors = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#6b7280",
  "#374151",
  "#1f2937",
];

export default function FunnelStagesManager({
  funnel,
}: FunnelStagesManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);
  const [deletingStage, setDeletingStage] = useState<FunnelStage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState(defaultColors[0]);

  const { data: funnelStages = [], isLoading } = useQuery<FunnelStage[]>({
    queryKey: [`/api/funnels/${funnel.id}/stages`, funnel.id],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/funnels/${funnel.id}/stages`,
        "GET",
      );
      return response.json();
    },
    enabled: !!funnel.id,
  });

  console.log(funnelStages);

  const createStageMutation = useMutation({
    mutationFn: async (stageData: {
      name: string;
      color: string;
      funnelId: string;
      order: number;
    }) => {
      return await apiRequest(
        `/api/funnel-stages/${funnel.id}`,
        "POST",
        stageData,
      );
    },
    onSuccess: () => {
      toast({
        title: "Etapa criada",
        description: "A nova etapa foi criada com sucesso.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/funnel-stages", funnel.id],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/funnels/${funnel.id}/stages`, funnel.id],
      });
      setIsCreateModalOpen(false);
      setStageName("");
      setStageColor(defaultColors[0]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a etapa.",
        variant: "destructive",
      });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; color: string };
    }) => {
      return await apiRequest(`/api/funnel-stages/${id}`, "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Etapa atualizada",
        description: "A etapa foi atualizada com sucesso.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/funnel-stages", funnel.id],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      setEditingStage(null);
      setStageName("");
      setStageColor(defaultColors[0]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a etapa.",
        variant: "destructive",
      });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/funnel-stages/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Etapa excluída",
        description: "A etapa foi excluída com sucesso.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/funnel-stages", funnel.id],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      setDeletingStage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a etapa.",
        variant: "destructive",
      });
    },
  });

  const handleCreateStage = () => {
    if (!stageName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome da etapa.",
        variant: "destructive",
      });
      return;
    }

    const nextOrder = (funnelStages.length || 0) + 1;
    createStageMutation.mutate({
      name: stageName,
      color: stageColor,
      funnelId: funnel.id,
      order: nextOrder,
    });
  };

  const handleEditStage = () => {
    if (!editingStage || !stageName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome da etapa.",
        variant: "destructive",
      });
      return;
    }

    updateStageMutation.mutate({
      id: editingStage.id,
      data: {
        name: stageName,
        color: stageColor,
      },
    });
  };

  const openEditModal = (stage: FunnelStage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageColor(stage.color);
  };

  const closeEditModal = () => {
    setEditingStage(null);
    setStageName("");
    setStageColor(defaultColors[0]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando etapas...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Etapas do Funil</h3>
            <p className="text-gray-600">
              Configure as etapas do seu funil de vendas
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Etapa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Etapa</DialogTitle>
                <DialogDescription>
                  Adicione uma nova etapa ao funil de vendas
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="stage-name">Nome da Etapa</Label>
                  <Input
                    id="stage-name"
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    placeholder="Ex: Prospecção"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cor da Etapa</Label>
                  <div className="grid grid-cols-10 gap-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 ${
                          stageColor === color
                            ? "border-gray-900"
                            : "border-gray-300"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setStageColor(color)}
                      />
                    ))}
                  </div>
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
                  onClick={handleCreateStage}
                  disabled={createStageMutation.isPending}
                >
                  {createStageMutation.isPending ? "Criando..." : "Criar Etapa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {funnelStages.map((stage: FunnelStage, index: number) => (
            <Card key={stage.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <div>
                      <CardTitle className="text-base">{stage.name}</CardTitle>
                      <CardDescription>Posição: {stage.order}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(stage)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingStage(stage)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          {funnelStages.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Palette className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma etapa encontrada
                </h3>
                <p className="text-gray-500 mb-4">
                  Crie a primeira etapa do seu funil
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Etapa
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog
        open={!!editingStage}
        onOpenChange={(open) => !open && closeEditModal()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Etapa</DialogTitle>
            <DialogDescription>
              Modifique as informações da etapa
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-stage-name">Nome da Etapa</Label>
              <Input
                id="edit-stage-name"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ex: Prospecção"
              />
            </div>
            <div className="grid gap-2">
              <Label>Cor da Etapa</Label>
              <div className="grid grid-cols-10 gap-2">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      stageColor === color
                        ? "border-gray-900"
                        : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setStageColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditStage}
              disabled={updateStageMutation.isPending}
            >
              {updateStageMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingStage}
        onOpenChange={() => setDeletingStage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etapa "{deletingStage?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingStage) {
                  deleteStageMutation.mutate(deletingStage.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
