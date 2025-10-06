import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  Bookmark,
  Search,
  Loader2,
  BookmarkPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const {
    data: markers = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["/api/markers"],
  });

  // Filtrar marcadores com base no termo de busca
  const filteredMarkers = (markers as Marker[]).filter((marker) =>
    marker.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMarkerMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest("POST", "/api/markers", data);
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
    onError: (error) => {
      console.error("Error creating marker:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao criar marcador",
        variant: "destructive",
      });
    },
  });

  const updateMarkerMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; color: string };
    }) => {
      return await apiRequest("PUT", `/api/markers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markers"] });
      // Invalidate marker stats cache since marker name changes can affect goal calculations
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/marker-stats"),
      });
      setEditingMarker(null);
      setFormData({ name: "", color: "#10B981" });
      toast({
        title: "Sucesso",
        description: "Marcador atualizado com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error updating marker:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao atualizar marcador",
        variant: "destructive",
      });
    },
  });

  const deleteMarkerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/markers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markers"] });
      // Invalidate marker stats cache since deleting a marker affects goal calculations
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/marker-stats"),
      });
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
        data: formData,
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

  // Removido - o loading será tratado no JSX principal

  return (
    <>
      <div className="flex flex-col h-full">
        <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-emerald-100 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-200 to-green-200 dark:from-emerald-700 dark:to-green-700">
                    <Bookmark className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <span className="bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-400 dark:to-green-400 bg-clip-text text-transparent font-bold">
                    Gestão de Marcadores
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                  Gerencie os marcadores disponíveis para etiquetar e organizar
                  seus clientes
                </CardDescription>
              </div>

              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Novo Marcador
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-4 md:p-6">
            {/* Campo de busca moderno */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar marcador por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-emerald-400 focus:ring-emerald-400 dark:border-slate-600 dark:focus:border-emerald-500 bg-white dark:bg-slate-800"
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="space-y-4 flex-1">
                {/* Skeleton Items */}
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Skeleton Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Skeleton className="h-5 w-32" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </div>
            ) : (markers as Marker[]).length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20 mb-6">
                  <BookmarkPlus className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhum marcador cadastrado
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  Comece criando seu primeiro marcador para etiquetar e
                  organizar seus clientes de forma eficiente.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                >
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Criar Primeiro Marcador
                </Button>
              </div>
            ) : filteredMarkers.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 mb-6">
                  <Search className="h-12 w-12 text-slate-500 dark:text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhum marcador encontrado
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Não encontramos marcadores com o termo "{searchTerm}"
                </p>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Limpar filtro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                {filteredMarkers.map((marker: Marker) => (
                  <div
                    key={marker.id}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: marker.color }}
                          title={`Cor: ${marker.color}`}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <Badge
                            variant="secondary"
                            className="w-fit text-xs font-medium"
                            style={{
                              backgroundColor: marker.color + "15",
                              color: marker.color,
                              border: `1px solid ${marker.color}30`,
                            }}
                          >
                            {marker.name}
                          </Badge>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {marker.color.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(marker)}
                          title="Editar marcador"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMarkerToDelete(marker)}
                          title="Excluir marcador"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paginação moderna */}
            {/* {!isLoading && filteredMarkers.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Mostrando{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {filteredMarkers.length}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {(markers as Marker[]).length}
                    </span>{" "}
                    marcadores
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      Anterior
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                      >
                        1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500"
                      >
                        2
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              </div>
            )} */}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Marker Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-200 to-green-200 dark:from-emerald-700 dark:to-green-700">
                <Bookmark className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              </div>
              {editingMarker ? "Editar Marcador" : "Novo Marcador"}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {editingMarker
                ? "Atualize as informações do marcador selecionado."
                : "Crie um novo marcador para etiquetar e organizar seus clientes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Nome do Marcador
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Urgente, Follow-up, Proposta Enviada..."
                  className="border-slate-300 focus:border-emerald-400 focus:ring-emerald-400 dark:border-slate-600 dark:focus:border-emerald-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <Label
                  htmlFor="color"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cor do Marcador
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      id="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-12 h-10 border-2 border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-transparent"
                    />
                    <div
                      className="absolute inset-1 rounded-md pointer-events-none border"
                      style={{ backgroundColor: formData.color }}
                    />
                  </div>
                  <Input
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    placeholder="#10B981"
                    className="flex-1 border-slate-300 focus:border-emerald-400 focus:ring-emerald-400 dark:border-slate-600 dark:focus:border-emerald-500 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Escolha uma cor que identifique visualmente este marcador
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createMarkerMutation.isPending || updateMarkerMutation.isPending
              }
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMarkerMutation.isPending ||
              updateMarkerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Marcador"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!markerToDelete}
        onOpenChange={() => setMarkerToDelete(null)}
      >
        <AlertDialogContent className="bg-gradient-to-br from-white to-red-50 dark:from-slate-800 dark:to-red-900/20 border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Tem certeza que deseja excluir o marcador{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                "{markerToDelete?.name}"
              </span>
              ? Esta ação é irreversível e o marcador será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                markerToDelete && deleteMarkerMutation.mutate(markerToDelete.id)
              }
              disabled={deleteMarkerMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMarkerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Marcador"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
