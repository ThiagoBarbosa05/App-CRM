import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, ShoppingCart, Loader2, Wine } from "lucide-react";
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
            Clientes sem compra há mais de {currentDays} dias são marcados como
            INATIVO
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
            <Button onClick={handleSave} disabled={mutation.isPending || !days}>
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

export function WinePriceTierSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });

  const [lowValue, setLowValue] = useState<string>("");
  const [midValue, setMidValue] = useState<string>("");

  const currentLow = settings?.wine_price_tier_low ?? "50";
  const currentMid = settings?.wine_price_tier_mid ?? "150";

  const saveLow = useMutation({
    mutationFn: async (value: string) =>
      apiRequest("PUT", "/api/system-settings/wine_price_tier_low", {
        value,
        description: "Limite superior da faixa Econômica de vinhos (R$)",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: "Configuração salva",
        description: "Limite econômico atualizado.",
      });
      setLowValue("");
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar.",
        variant: "destructive",
      });
    },
  });

  const saveMid = useMutation({
    mutationFn: async (value: string) =>
      apiRequest("PUT", "/api/system-settings/wine_price_tier_mid", {
        value,
        description: "Limite superior da faixa Intermediária de vinhos (R$)",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: "Configuração salva",
        description: "Limite intermediário atualizado.",
      });
      setMidValue("");
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar.",
        variant: "destructive",
      });
    },
  });

  const handleSaveLow = () => {
    const parsed = parseFloat(lowValue);
    const parsedMid = parseFloat(midValue || currentMid);
    if (isNaN(parsed) || parsed <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }
    if (parsed >= parsedMid) {
      toast({
        title: "Valor inválido",
        description: "O limite econômico deve ser menor que o intermediário.",
        variant: "destructive",
      });
      return;
    }
    saveLow.mutate(lowValue);
  };

  const handleSaveMid = () => {
    const parsed = parseFloat(midValue);
    const parsedLow = parseFloat(lowValue || currentLow);
    if (isNaN(parsed) || parsed <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }
    if (parsed <= parsedLow) {
      toast({
        title: "Valor inválido",
        description: "O limite intermediário deve ser maior que o econômico.",
        variant: "destructive",
      });
      return;
    }
    saveMid.mutate(midValue);
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
          <Wine className="h-5 w-5 text-wine-600" />
          Faixas de Preço de Vinhos
        </CardTitle>
        <CardDescription>
          Configure os limites de preço por unidade que definem cada faixa de
          vinho. Usado no dashboard para mostrar o perfil de vendas por
          vendedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Econômico
            </p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
              até R$ {currentLow}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Intermediário
            </p>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">
              R$ {currentLow} – R$ {currentMid}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              Premium
            </p>
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">
              acima de R$ {currentMid}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="wine-tier-low" className="text-sm font-medium">
              Limite Econômico (R$)
            </Label>
            <div className="flex gap-2">
              <Input
                id="wine-tier-low"
                type="number"
                min="1"
                placeholder={`Ex: ${currentLow}`}
                value={lowValue}
                onChange={(e) => setLowValue(e.target.value)}
                className="w-32"
              />
              <Button
                onClick={handleSaveLow}
                disabled={saveLow.isPending || !lowValue}
              >
                {saveLow.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wine-tier-mid" className="text-sm font-medium">
              Limite Intermediário (R$)
            </Label>
            <div className="flex gap-2">
              <Input
                id="wine-tier-mid"
                type="number"
                min="1"
                placeholder={`Ex: ${currentMid}`}
                value={midValue}
                onChange={(e) => setMidValue(e.target.value)}
                className="w-32"
              />
              <Button
                onClick={handleSaveMid}
                disabled={saveMid.isPending || !midValue}
              >
                {saveMid.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsManagement() {
  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-wine-600 shrink-0" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gerencie as configurações do sistema</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <div className="overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full grid grid-cols-8 sm:w-full">
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-3">Usuários</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm px-2 sm:px-3">Categorias</TabsTrigger>
            <TabsTrigger value="markers" className="text-xs sm:text-sm px-2 sm:px-3">Marcadores</TabsTrigger>
            <TabsTrigger value="origins" className="text-xs sm:text-sm px-2 sm:px-3">Origens</TabsTrigger>
            <TabsTrigger value="sectors" className="text-xs sm:text-sm px-2 sm:px-3">Setores</TabsTrigger>
            <TabsTrigger value="learning-images" className="text-xs sm:text-sm px-2 sm:px-3">Imagens</TabsTrigger>
            <TabsTrigger value="purchase-status" className="text-xs sm:text-sm px-1.5 sm:px-3">Compra</TabsTrigger>
            <TabsTrigger value="wine-price-tiers" className="text-xs sm:text-sm px-1.5 sm:px-3">Preços</TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="wine-price-tiers">
          <WinePriceTierSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
