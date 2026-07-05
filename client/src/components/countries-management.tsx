import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Globe, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface Country {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export default function CountriesManagement() {
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const {
    data: countries = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["/api/tags/countries"],
  });

  const filteredCountries = (countries as Country[]).filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return await apiRequest("POST", "/api/countries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/countries"] });
      setShowCreateModal(false);
      setFormData({ name: "" });
      toast({ title: "Sucesso", description: "País cadastrado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao cadastrar país",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) => {
      return await apiRequest("PUT", `/api/countries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/countries"] });
      setEditingCountry(null);
      setFormData({ name: "" });
      toast({ title: "Sucesso", description: "País atualizado com sucesso" });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar país",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/countries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/countries"] });
      setCountryToDelete(null);
      toast({ title: "Sucesso", description: "País excluído com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao excluir país", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Nome do país é obrigatório", variant: "destructive" });
      return;
    }
    if (editingCountry) {
      updateMutation.mutate({ id: editingCountry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (country: Country) => {
    setEditingCountry(country);
    setFormData({ name: country.name });
  };

  const handleCloseModal = () => {
    setEditingCountry(null);
    setShowCreateModal(false);
    setFormData({ name: "" });
  };

  const isModalOpen = showCreateModal || editingCountry !== null;

  return (
    <>
      <div className="flex flex-col h-full">
        <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-blue-100 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-700 dark:to-cyan-700">
                    <Globe className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <span className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent font-bold">
                    Gestão de Países
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                  Gerencie os países disponíveis para seleção nos cadastros do sistema
                </CardDescription>
              </div>

              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo País
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-4 md:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar país por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-blue-400 focus:ring-blue-400 dark:border-slate-600 dark:focus:border-blue-500 bg-white dark:bg-slate-800"
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4 flex-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-40" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (countries as Country[]).length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 mb-6">
                  <Globe className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhum país cadastrado
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  Comece cadastrando os países que estarão disponíveis para seleção nos cadastros.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro País
                </Button>
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 mb-6">
                  <Search className="h-12 w-12 text-slate-500 dark:text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhum país encontrado
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Não encontramos países com o termo "{searchTerm}"
                </p>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Limpar filtro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                {filteredCountries.map((country: Country) => (
                  <div
                    key={country.id}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span
                          className="font-semibold text-slate-900 dark:text-slate-100 truncate"
                          title={country.name}
                        >
                          {country.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(country)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCountryToDelete(country)}
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-700 dark:to-cyan-700">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              </div>
              {editingCountry ? "Editar País" : "Novo País"}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {editingCountry
                ? "Atualize o nome do país selecionado."
                : "Cadastre um novo país para uso nos formulários do sistema."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nome do País
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Ex: Brasil, Argentina, Portugal..."
                className="border-slate-300 focus:border-blue-400 focus:ring-blue-400 dark:border-slate-600 dark:focus:border-blue-500 bg-white dark:bg-slate-800 mt-1"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                className="border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!countryToDelete} onOpenChange={() => setCountryToDelete(null)}>
        <AlertDialogContent className="bg-gradient-to-br from-white to-red-50 dark:from-slate-800 dark:to-red-900/20 border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Tem certeza que deseja excluir o país{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                "{countryToDelete?.name}"
              </span>
              ? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => countryToDelete && deleteMutation.mutate(countryToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
