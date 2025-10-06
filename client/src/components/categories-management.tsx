import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  Tag,
  Palette,
  Search,
  Loader2,
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

interface Category {
  id: string;
  name: string;
  color: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

// Função helper para gerar iniciais de cores
const getColorInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function CategoriesManagement() {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  );
  const [formData, setFormData] = useState({ name: "", color: "#8B5CF6" });
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const {
    data: categories = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Filtrar categorias com base no termo de busca
  const filteredCategories = (categories as Category[]).filter((category) =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setShowCreateModal(false);
      setFormData({ name: "", color: "#8B5CF6" });
      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error creating category:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao criar categoria",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; color: string };
    }) => {
      return await apiRequest("PUT", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditingCategory(null);
      setFormData({ name: "", color: "#8B5CF6" });
      toast({
        title: "Sucesso",
        description: "Categoria atualizada com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error updating category:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar categoria",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryToDelete(null);
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: formData,
      });
    } else {
      createCategoryMutation.mutate(formData);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, color: category.color });
  };

  const handleCloseModal = () => {
    setEditingCategory(null);
    setShowCreateModal(false);
    setFormData({ name: "", color: "#8B5CF6" });
  };

  const isModalOpen = showCreateModal || editingCategory !== null;

  // Removido - o loading será tratado no JSX principal

  return (
    <>
      <div className="flex flex-col h-full">
        <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-violet-100 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-200 to-purple-200 dark:from-violet-700 dark:to-purple-700">
                    <Tag className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                  </div>
                  <span className="bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent font-bold">
                    Gestão de Categorias
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                  Gerencie as categorias disponíveis para classificar seus
                  clientes de forma organizada
                </CardDescription>
              </div>

              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-4 md:p-6">
            {/* Campo de busca moderno */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar categoria por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-violet-400 focus:ring-violet-400 dark:border-slate-600 dark:focus:border-violet-500 bg-white dark:bg-slate-800"
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
                        <Skeleton className="h-5 w-32" />
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
            ) : (categories as Category[]).length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 mb-6">
                  <Palette className="h-12 w-12 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhuma categoria cadastrada
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  Comece criando sua primeira categoria para organizar e
                  classificar seus clientes de forma eficiente.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Categoria
                </Button>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 mb-6">
                  <Search className="h-12 w-12 text-slate-500 dark:text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhuma categoria encontrada
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Não encontramos categorias com o termo "{searchTerm}"
                </p>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Limpar filtro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                {filteredCategories.map((category: Category) => (
                  <div
                    key={category.id}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                          title={`Cor: ${category.color}`}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span
                            className="font-semibold text-slate-900 dark:text-slate-100 truncate"
                            title={category.name}
                          >
                            {category.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {category.color.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          title="Editar categoria"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCategoryToDelete(category)}
                          title="Excluir categoria"
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
            {/* {!isLoading && filteredCategories.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Mostrando{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {filteredCategories.length}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {(categories as Category[]).length}
                    </span>{" "}
                    categorias
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
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
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

      {/* Create/Edit Category Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-200 to-purple-200 dark:from-violet-700 dark:to-purple-700">
                <Tag className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              </div>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {editingCategory
                ? "Atualize as informações da categoria selecionada."
                : "Crie uma nova categoria para classificar e organizar seus clientes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Nome da Categoria
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: VIP, Interessado, Fidelizado..."
                  className="border-slate-300 focus:border-violet-400 focus:ring-violet-400 dark:border-slate-600 dark:focus:border-violet-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <Label
                  htmlFor="color"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cor da Categoria
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
                    placeholder="#8B5CF6"
                    className="flex-1 border-slate-300 focus:border-violet-400 focus:ring-violet-400 dark:border-slate-600 dark:focus:border-violet-500 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Escolha uma cor que represente visualmente esta categoria
                </p>
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
                  createCategoryMutation.isPending ||
                  updateCategoryMutation.isPending
                }
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createCategoryMutation.isPending ||
                updateCategoryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Categoria"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={() => setCategoryToDelete(null)}
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
              Tem certeza que deseja excluir a categoria{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                "{categoryToDelete?.name}"
              </span>
              ? Esta ação é irreversível e a categoria será removida
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                categoryToDelete &&
                deleteCategoryMutation.mutate(categoryToDelete.id)
              }
              disabled={deleteCategoryMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteCategoryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Categoria"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
