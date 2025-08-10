import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Settings } from "lucide-react";

export default function CashbackSettingsManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    percentageRate: "",
    minimumPurchase: "",
    maximumCashback: "",
    validUntil: "",
    expirationDays: "28",
    isActive: "true",
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["/api/cashback-settings"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/cashback-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          createdBy: "b314722c-8fd6-4592-a9de-9ee551ec35be", // ID do usuário admin
        }),
      });
      if (!response.ok) throw new Error("Erro ao criar configuração");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-settings"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/cashback-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao atualizar configuração");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-settings"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cashback-settings/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Erro ao deletar configuração");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração deletada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      percentageRate: "",
      minimumPurchase: "",
      maximumCashback: "",
      validUntil: "",
      expirationDays: "28",
      isActive: "true",
    });
    setEditingSetting(null);
    setDialogOpen(false);
  };

  const handleEdit = (setting: any) => {
    setEditingSetting(setting);
    setFormData({
      name: setting.name,
      description: setting.description || "",
      percentageRate: setting.percentageRate,
      minimumPurchase: setting.minimumPurchase || "",
      maximumCashback: setting.maximumCashback || "",
      validUntil: setting.validUntil
        ? new Date(setting.validUntil).toISOString().split("T")[0]
        : "",
      expirationDays: setting.expirationDays?.toString() || "28",
      isActive: setting.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      percentageRate: formData.percentageRate,
      minimumPurchase:
        formData.minimumPurchase && formData.minimumPurchase.trim() !== ""
          ? formData.minimumPurchase
          : "0.00",
      maximumCashback:
        formData.maximumCashback && formData.maximumCashback.trim() !== ""
          ? formData.maximumCashback
          : null,
      validUntil:
        formData.validUntil && formData.validUntil.trim() !== ""
          ? formData.validUntil
          : null,
      expirationDays: parseInt(formData.expirationDays) || 28,
    };

    if (editingSetting) {
      updateMutation.mutate({ id: editingSetting.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const formatCurrency = (value: string | number) => {
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numericValue);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-xl font-semibold">Configurações de Cashback</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setEditingSetting(null)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Configuração
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSetting ? "Editar Configuração" : "Nova Configuração"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Regra</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Cashback Padrão"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição da regra..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="percentageRate">Taxa (%)</Label>
                  <Input
                    id="percentageRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.percentageRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        percentageRate: e.target.value,
                      })
                    }
                    placeholder="2.5"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumPurchase">Compra Mínima (R$)</Label>
                  <Input
                    id="minimumPurchase"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minimumPurchase}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minimumPurchase: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maximumCashback">Cashback Máximo (R$)</Label>
                <Input
                  id="maximumCashback"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.maximumCashback}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maximumCashback: e.target.value,
                    })
                  }
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationDays">
                  Dias para Vencimento do Cashback
                </Label>
                <Input
                  id="expirationDays"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.expirationDays}
                  onChange={(e) =>
                    setFormData({ ...formData, expirationDays: e.target.value })
                  }
                  placeholder="28"
                  required
                />
                <p className="text-xs text-gray-500">
                  Quantos dias o cashback será válido após ser gerado (padrão:
                  28 dias)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">Válido até</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) =>
                    setFormData({ ...formData, validUntil: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive === "true"}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isActive: checked ? "true" : "false",
                    })
                  }
                />
                <Label htmlFor="isActive">Ativa</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {editingSetting ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {settings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma configuração
              </h3>
              <p className="text-gray-500 mb-4">
                Crie suas primeiras regras de cashback para começar.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Configuração
              </Button>
            </CardContent>
          </Card>
        ) : (
          settings.map((setting: any) => (
            <Card key={setting.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start w-full gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {setting.name}
                      <Badge
                        variant={
                          setting.isActive === "true" ? "default" : "secondary"
                        }
                      >
                        {setting.isActive === "true" ? "Ativa" : "Inativa"}
                      </Badge>
                    </CardTitle>
                    {setting.description && (
                      <CardDescription>{setting.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(setting.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Taxa</p>
                    <p className="font-medium">{setting.percentageRate}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Compra Mínima</p>
                    <p className="font-medium">
                      {setting.minimumPurchase
                        ? formatCurrency(setting.minimumPurchase)
                        : "Sem mínimo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cashback Máximo</p>
                    <p className="font-medium">
                      {setting.maximumCashback
                        ? formatCurrency(setting.maximumCashback)
                        : "Ilimitado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Válido até</p>
                    <p className="font-medium">
                      {setting.validUntil
                        ? new Date(setting.validUntil).toLocaleDateString(
                            "pt-BR",
                          )
                        : "Sem data"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
