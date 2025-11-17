import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Tag,
  Search,
  Loader2,
  MapPin,
  Navigation,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const originSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  color: z.string().min(4, "Cor é obrigatória"),
});

type OriginFormData = z.infer<typeof originSchema>;

interface Origin {
  id: string;
  name: string;
  color: string;
  type: string;
  createdAt: string;
}

export default function OriginsManagement() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState<Origin | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: origins = [],
    isLoading,
    isFetching,
  } = useQuery<Origin[]>({
    queryKey: ["/api/tags/origins"],
  });

  // Filtrar origens com base no termo de busca
  const filteredOrigins = origins.filter((origin) =>
    origin.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const form = useForm<OriginFormData>({
    resolver: zodResolver(originSchema),
    defaultValues: {
      name: "",
      color: "#6B7280",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: OriginFormData) => {
      const response = await apiRequest("POST", "/api/origins", {
        ...data,
        type: "origem",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/origins"] });
      toast({
        title: "Origem criada",
        description: "Origem foi criada com sucesso.",
      });
      setIsCreateModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a origem.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: OriginFormData & { id: string }) => {
      const response = await apiRequest("PUT", `/api/origins/${data.id}`, {
        name: data.name,
        color: data.color,
        type: "origem",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/origins"] });
      toast({
        title: "Origem atualizada",
        description: "Origem foi atualizada com sucesso.",
      });
      setEditingOrigin(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a origem.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/origins/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/origins"] });
      toast({
        title: "Origem excluída",
        description: "Origem foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a origem.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: OriginFormData) => {
    if (editingOrigin) {
      updateMutation.mutate({ ...data, id: editingOrigin.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEditOrigin = (origin: Origin) => {
    setEditingOrigin(origin);
    form.setValue("name", origin.name);
    form.setValue("color", origin.color);
  };

  const handleCancelEdit = () => {
    setEditingOrigin(null);
    form.reset();
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-blue-100 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-700 dark:to-cyan-700">
                    <Tag className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <span className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent font-bold">
                    Gestão de Origens
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                  Gerencie as origens disponíveis para classificar a procedência
                  dos seus clientes
                </CardDescription>
              </div>
              <Dialog
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200">
                    <Tag className="h-4 w-4 mr-2" />
                    Nova Origem
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-700 dark:to-cyan-700">
                        <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                      </div>
                      Criar Nova Origem
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(handleSubmit)}
                      className="space-y-6"
                    >
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Nome da Origem
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: Site, Instagram, Facebook..."
                                {...field}
                                className="border-slate-300 focus:border-blue-400 focus:ring-blue-400 dark:border-slate-600 dark:focus:border-blue-500 bg-white dark:bg-slate-800"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Cor da Origem
                            </FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <Input
                                    type="color"
                                    {...field}
                                    className="w-12 h-10 border-2 border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-transparent"
                                  />
                                  <div
                                    className="absolute inset-1 rounded-md pointer-events-none border"
                                    style={{ backgroundColor: field.value }}
                                  />
                                </div>
                                <Input
                                  placeholder="#6B7280"
                                  {...field}
                                  className="flex-1 border-slate-300 focus:border-blue-400 focus:ring-blue-400 dark:border-slate-600 dark:focus:border-blue-500 bg-white dark:bg-slate-800 font-mono"
                                />
                              </div>
                            </FormControl>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Escolha uma cor que identifique visualmente esta
                              origem
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateModalOpen(false)}
                          className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {createMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            "Criar Origem"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 min-h-0 gap-6 p-4 md:p-6">
            {/* Campo de busca moderno */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar origem por nome..."
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
                {/* Skeleton Items */}
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-4 w-32" />
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
            ) : origins.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 mb-6">
                  <Tag className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhuma origem cadastrada
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  Comece criando sua primeira origem para classificar a
                  procedência dos seus clientes.
                </p>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Criar Primeira Origem
                </Button>
              </div>
            ) : filteredOrigins.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 mb-6">
                  <Search className="h-12 w-12 text-slate-500 dark:text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhuma origem encontrada
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Não encontramos origens com o termo "{searchTerm}"
                </p>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Limpar filtro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                {filteredOrigins.map((origin) => (
                  <div
                    key={origin.id}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <Badge
                          variant="secondary"
                          className="w-fit text-xs font-medium"
                          style={{
                            backgroundColor: origin.color,
                            color: "white",
                            border: `1px solid ${origin.color}`,
                          }}
                        >
                          {origin.name}
                        </Badge>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Criada em{" "}
                            {new Date(origin.createdAt).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                          <span className="font-mono">
                            {origin.color.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOrigin(origin)}
                          title="Editar origem"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(origin.id)}
                          disabled={deleteMutation.isPending}
                          title="Excluir origem"
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
            {/* {!isLoading && filteredOrigins.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Mostrando{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {filteredOrigins.length}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {origins.length}
                    </span>{" "}
                    origens
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
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
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

      {/* Modal de Edição */}
      {editingOrigin && (
        <Dialog open={!!editingOrigin} onOpenChange={() => handleCancelEdit()}>
          <DialogContent className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-700 dark:to-cyan-700">
                  <Edit className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                </div>
                Editar Origem
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Nome da Origem
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Site, Instagram, Facebook..."
                          {...field}
                          className="border-slate-300 focus:border-blue-400 focus:ring-blue-400 dark:border-slate-600 dark:focus:border-blue-500 bg-white dark:bg-slate-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Cor da Origem
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Input
                              type="color"
                              {...field}
                              className="w-12 h-10 border-2 border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-transparent"
                            />
                            <div
                              className="absolute inset-1 rounded-md pointer-events-none border"
                              style={{ backgroundColor: field.value }}
                            />
                          </div>
                          <Input
                            placeholder="#6B7280"
                            {...field}
                            className="flex-1 border-slate-300 focus:border-blue-400 focus:ring-blue-400 dark:border-slate-600 dark:focus:border-blue-500 bg-white dark:bg-slate-800 font-mono"
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Escolha uma cor que identifique visualmente esta origem
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Origem"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
