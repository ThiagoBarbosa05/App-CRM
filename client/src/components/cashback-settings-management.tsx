import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  Search,
  Filter,
  Coins,
  Percent,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Schema para validação no formulário (frontend)
const cashbackSettingsSchema = z.object({
  name: z.string().min(1, "O nome da regra é obrigatório."),
  description: z.string().optional(),
  percentageRate: z.coerce
    .number()
    .min(0, "A taxa deve ser positiva.")
    .max(100, "A taxa não pode ser maior que 100."),
  minimumPurchase: z.coerce
    .number()
    .min(0, "O valor deve ser positivo.")
    .nullable()
    .optional(),
  maximumCashback: z.coerce
    .number()
    .min(0, "O valor deve ser positivo.")
    .nullable()
    .optional(),
  validUntil: z.string().nullable().optional(),
  expirationDays: z.coerce
    .number()
    .int()
    .min(1, "A expiração deve ser de no mínimo 1 dia.")
    .default(28),
  isActive: z.boolean().default(true),
});

type CashbackSettingsForm = z.infer<typeof cashbackSettingsSchema>;

// Funções de máscara de moeda
const formatBRL = (value: number | null | undefined) => {
  if (value === null || value === undefined || isNaN(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const parseBRL = (value: string): number | null => {
  if (!value) return null;
  const numberValue = Number(value.replace(/\D/g, "")) / 100;
  return isNaN(numberValue) ? null : numberValue;
};

const newFormDefaultValues: CashbackSettingsForm = {
  name: "",
  description: "",
  percentageRate: 0,
  minimumPurchase: null,
  maximumCashback: null,
  validUntil: "",
  expirationDays: 28,
  isActive: true,
};

export default function CashbackSettingsManagement() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<any>(null);

  // Estados para pesquisa e filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CashbackSettingsForm>({
    resolver: zodResolver(cashbackSettingsSchema),
    defaultValues: newFormDefaultValues,
  });

  const {
    data: settings = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["/api/cashback-settings"],
    queryFn: async () => {
      const response = await fetch("/api/cashback-settings");
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    },
  });

  const mutationOptions = {
    onSuccess: (action: string) => {
      toast({ title: `Configuração ${action} com sucesso` });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-settings"],
      });
      closeDialog();
    },
    onError: (error: any, action: string) => {
      toast({
        title: `Erro ao ${action} configuração`,
        description: error.message,
        variant: "destructive",
      });
    },
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/cashback-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, createdBy: user?.id }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => mutationOptions.onSuccess("criada"),
    onError: (error: any) => mutationOptions.onError(error, "criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/cashback-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => mutationOptions.onSuccess("atualizada"),
    onError: (error: any) => mutationOptions.onError(error, "atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cashback-settings/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração deletada com sucesso" });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-settings"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSetting(null);
    reset(newFormDefaultValues);
  };

  const handleEdit = (setting: any) => {
    setEditingSetting(setting);
    reset({
      ...setting,
      percentageRate: parseFloat(setting.percentageRate),
      minimumPurchase: setting.minimumPurchase
        ? parseFloat(setting.minimumPurchase)
        : null,
      maximumCashback: setting.maximumCashback
        ? parseFloat(setting.maximumCashback)
        : null,
      validUntil: setting.validUntil
        ? new Date(setting.validUntil).toISOString().split("T")[0]
        : "",
      isActive: setting.isActive === "true" || setting.isActive === true,
    });
    setDialogOpen(true);
  };

  const handleOpenNew = () => {
    setEditingSetting(null);
    reset(newFormDefaultValues);
    setDialogOpen(true);
  };

  const onSubmit = (data: CashbackSettingsForm) => {
    // Transforma os dados para o formato esperado pelo backend
    const submitData = {
      ...data,
      percentageRate: String(data.percentageRate),
      minimumPurchase: data.minimumPurchase
        ? String(data.minimumPurchase)
        : "0.00",
      maximumCashback: data.maximumCashback
        ? String(data.maximumCashback)
        : null,
      isActive: String(data.isActive),
      validUntil: data.validUntil || null,
    };

    if (editingSetting) {
      updateMutation.mutate({ id: editingSetting.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const displayCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "Ilimitado";
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numericValue)) return "Ilimitado";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numericValue);
  };

  // Função para filtrar configurações
  const filteredSettings = settings.filter((setting: any) => {
    const matchesSearch =
      searchTerm === "" ||
      setting.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (setting.description &&
        setting.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" &&
        (setting.isActive === "true" || setting.isActive === true)) ||
      (filterStatus === "inactive" &&
        (setting.isActive === "false" || setting.isActive === false));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-900 dark:to-slate-800">
      <div className="p-4 lg:p-6">
        {/* Header com gradiente purple/violet */}
        <div className="bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <Coins className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                Configurações de Cashback
              </h1>
              <p className="text-purple-100 text-sm lg:text-base">
                Gerencie as regras e configurações do sistema de cashback
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleOpenNew}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Configuração
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* Barra de pesquisa e filtros */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar configurações de cashback..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500"
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
                </div>
              )}
            </div>
            <div className="sm:w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 dark:focus:border-purple-500"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Apenas Ativos</option>
                <option value="inactive">Apenas Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="space-y-6">
          {/* Skeleton Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Conteúdo Real */}
          {!isLoading && (
            <>
              {filteredSettings.length === 0 && settings.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Coins className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Nenhuma configuração encontrada
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                      Crie suas primeiras regras de cashback para começar.
                    </p>
                    <Button
                      onClick={handleOpenNew}
                      className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Configuração
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredSettings.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Search className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Nenhuma configuração encontrada
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      Tente ajustar os filtros ou o termo de busca.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredSettings.map((setting: any) => (
                    <Card
                      key={setting.id}
                      className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start w-full gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                              <div className="p-1.5 bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 rounded-lg">
                                <Percent className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="truncate">{setting.name}</span>
                              <Badge
                                className={
                                  setting.isActive === "true" ||
                                  setting.isActive === true
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                }
                              >
                                {setting.isActive === "true" ||
                                setting.isActive === true
                                  ? "Ativa"
                                  : "Inativa"}
                              </Badge>
                            </CardTitle>
                            {setting.description && (
                              <CardDescription className="mt-1 text-slate-600 dark:text-slate-400 line-clamp-2">
                                {setting.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(setting)}
                              className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(setting.id)}
                              disabled={deleteMutation.isPending}
                              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">
                              Taxa
                            </p>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-lg">
                              {setting.percentageRate}%
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">
                              Compra Mínima
                            </p>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {setting.minimumPurchase &&
                              parseFloat(setting.minimumPurchase) > 0
                                ? displayCurrency(setting.minimumPurchase)
                                : "Sem mínimo"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">
                              Cashback Máximo
                            </p>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {displayCurrency(setting.maximumCashback)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">
                              Válido até
                            </p>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {setting.validUntil
                                ? new Date(
                                    setting.validUntil,
                                  ).toLocaleDateString("pt-BR", {
                                    timeZone: "UTC",
                                  })
                                : "Sem data"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 rounded-lg">
                <Coins className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              {editingSetting ? "Editar Configuração" : "Nova Configuração"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Nome da Regra
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Ex: Cashback Padrão"
                className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Descrição
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Descrição da regra..."
                rows={2}
                className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="percentageRate"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Taxa (%)
                </Label>
                <Input
                  id="percentageRate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  {...register("percentageRate")}
                  placeholder="2.5"
                  className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800"
                />
                {errors.percentageRate && (
                  <p className="text-sm text-red-500">
                    {errors.percentageRate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="minimumPurchase"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Compra Mínima (R$)
                </Label>
                <Controller
                  name="minimumPurchase"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="R$ 0,00"
                      value={formatBRL(field.value)}
                      onChange={(e) => field.onChange(parseBRL(e.target.value))}
                      className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800"
                    />
                  )}
                />
                {errors.minimumPurchase && (
                  <p className="text-sm text-red-500">
                    {errors.minimumPurchase.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="maximumCashback"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cashback Máximo (R$)
              </Label>
              <Controller
                name="maximumCashback"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="Deixe vazio para ilimitado"
                    value={formatBRL(field.value)}
                    onChange={(e) => field.onChange(parseBRL(e.target.value))}
                    className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800"
                  />
                )}
              />
              {errors.maximumCashback && (
                <p className="text-sm text-red-500">
                  {errors.maximumCashback.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="expirationDays"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Dias para Vencimento do Cashback
              </Label>
              <Input
                id="expirationDays"
                type="number"
                min="1"
                max="365"
                {...register("expirationDays")}
                placeholder="28"
                className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800"
              />
              {errors.expirationDays && (
                <p className="text-sm text-red-500">
                  {errors.expirationDays.message}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quantos dias o cashback será válido após ser gerado (padrão: 28
                dias)
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="validUntil"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Válido até
              </Label>
              <Input
                id="validUntil"
                type="date"
                {...register("validUntil")}
                className="border-slate-300 focus:border-purple-400 focus:ring-purple-400 dark:border-slate-600 dark:focus:border-purple-500 bg-white dark:bg-slate-800"
              />
              {errors.validUntil && (
                <p className="text-sm text-red-500">
                  {errors.validUntil.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="isActive"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-purple-600"
                  />
                )}
              />
              <Label
                htmlFor="isActive"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Configuração Ativa
              </Label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ||
                createMutation.isPending ||
                updateMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Salvando...
                  </div>
                ) : editingSetting ? (
                  "Atualizar"
                ) : (
                  "Criar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
