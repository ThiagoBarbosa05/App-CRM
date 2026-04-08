import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, ShoppingCart, Loader2 } from "lucide-react";
import UsersManagement from "./users-management";
import CategoriesManagement from "./categories-management";
import MarkersManagement from "./markers-management";
import OriginsManagement from "./origins-management";
import SectorsManagement from "./sectors-management";
import LearningImagesManagement from "./learning-images-management";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function PurchaseStatusSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });

  const [days, setDays] = useState<string>("");

  const currentDays = settings?.purchase_status_days ?? "60";

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      return apiRequest("PUT", "/api/system-settings/purchase_status_days", {
        value,
        description: "Dias sem compra para considerar cliente INATIVO",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: "Configuração salva",
        description: "Limiar de status de compra atualizado com sucesso.",
      });
      setDays("");
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um número de dias maior que zero.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(days);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-wine-600" />
          Status de Compra
        </CardTitle>
        <CardDescription>
          Configure após quantos dias sem compra um cliente passa a ser
          considerado <strong>INATIVO</strong>. Clientes que compraram dentro
          desse período são considerados <strong>ATIVOS</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Configuração atual:
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {currentDays} dias
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            Clientes sem compra há mais de {currentDays} dias são marcados como INATIVO
          </p>
        </div>

        <div className="space-y-3 max-w-sm">
          <Label htmlFor="purchase-status-days" className="text-sm font-medium">
            Novo valor (em dias)
          </Label>
          <div className="flex gap-2">
            <Input
              id="purchase-status-days"
              type="number"
              min="1"
              placeholder={`Ex: ${currentDays}`}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-32"
            />
            <Button
              onClick={handleSave}
              disabled={mutation.isPending || !days}
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Recomendado: 60 dias (padrão do sistema)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsManagement() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-wine-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie as configurações do sistema</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="markers">Marcadores</TabsTrigger>
          <TabsTrigger value="origins">Origens</TabsTrigger>
          <TabsTrigger value="sectors">Setores</TabsTrigger>
          <TabsTrigger value="learning-images">Imagens</TabsTrigger>
          <TabsTrigger value="purchase-status">Status Compra</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="markers">
          <MarkersManagement />
        </TabsContent>

        <TabsContent value="origins">
          <OriginsManagement />
        </TabsContent>

        <TabsContent value="sectors">
          <SectorsManagement />
        </TabsContent>

        <TabsContent value="learning-images">
          <LearningImagesManagement />
        </TabsContent>

        <TabsContent value="purchase-status">
          <PurchaseStatusSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
