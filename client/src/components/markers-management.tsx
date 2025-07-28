import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Marker {
  id: string;
  name: string;
  color: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export default function MarkersManagement() {
  const [editingMarker, setEditingMarker] = useState<Marker | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [markerToDelete, setMarkerToDelete] = useState<Marker | null>(null);
  const [formData, setFormData] = useState({ name: "", color: "#10B981" });
  const { toast } = useToast();

  const { data: markers = [], isLoading } = useQuery({
    queryKey: ["/api/markers"],
  });

  const createMarkerMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest("/api/markers", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markers"] });
      setShowCreateModal(false);
      setFormData({ name: "", color: "#10B981" });
      toast({
        title: "Sucesso",
        description: "Marcador criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar marcador",
        variant: "destructive",
      });
    },
  });

  const updateMarkerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; color: string } }) => {
      return await apiRequest(`/api/markers/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markers"] });
      setEditingMarker(null);
      setFormData({ name: "", color: "#10B981" });
      toast({
        title: "Sucesso",
        description: "Marcador atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar marcador",
        variant: "destructive",
      });
    },
  });

  const deleteMarkerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/markers/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markers"] });
      setMarkerToDelete(null);
      toast({
        title: "Sucesso",
        description: "Marcador excluído com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir marcador",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do marcador é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (editingMarker) {
      updateMarkerMutation.mutate({ 
        id: editingMarker.id, 
        data: formData 
      });
    } else {
      createMarkerMutation.mutate(formData);
    }
  };

  const handleEdit = (marker: Marker) => {
    setEditingMarker(marker);
    setFormData({ name: marker.name, color: marker.color });
  };

  const handleCloseModal = () => {
    setEditingMarker(null);
    setShowCreateModal(false);
    setFormData({ name: "", color: "#10B981" });
  };

  const isModalOpen = showCreateModal || editingMarker !== null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Marcadores
          </CardTitle>
          <CardDescription>
            Carregando marcadores...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              Marcadores
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Marcador
            </Button>
          </CardTitle>
          <CardDescription>
            Gerencie os marcadores disponíveis para etiquetar seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!markers || (markers as Marker[]).length === 0 ? (
            <div className="text-center py-8">
              <Bookmark className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum marcador cadastrado</h3>
              <p className="text-gray-500 mb-4">Comece criando seu primeiro marcador para etiquetar os clientes.</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Marcador
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {(markers as Marker[]).map((marker: Marker) => (
                <div
                  key={marker.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: marker.color }}
                    />
                    <Badge variant="secondary" style={{ backgroundColor: marker.color + '20', color: marker.color }}>
                      {marker.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(marker)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMarkerToDelete(marker)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Marker Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMarker ? "Editar Marcador" : "Novo Marcador"}
            </DialogTitle>
            <DialogDescription>
              {editingMarker 
                ? "Edite as informações do marcador." 
                : "Crie um novo marcador para etiquetar seus clientes."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Marcador</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Urgente, Follow-up, Proposta Enviada..."
              />
            </div>
            <div>
              <Label htmlFor="color">Cor</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 border rounded cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#10B981"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMarkerMutation.isPending || updateMarkerMutation.isPending}
            >
              {createMarkerMutation.isPending || updateMarkerMutation.isPending 
                ? "Salvando..." 
                : "Salvar"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!markerToDelete} onOpenChange={() => setMarkerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o marcador "{markerToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => markerToDelete && deleteMarkerMutation.mutate(markerToDelete.id)}
              disabled={deleteMarkerMutation.isPending}
            >
              {deleteMarkerMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}