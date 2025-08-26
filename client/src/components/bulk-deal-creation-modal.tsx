import { useState } from "react";
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Label } from "./ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Company, FunnelStage } from "@shared/schema";
import { Checkbox } from "./ui/checkbox";

interface BulkDealCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
}

const bulkDealSchema = z.object({
  selectedCompanies: z.array(z.string()).min(1, "Selecione pelo menos uma empresa"),
  funnelId: z.string().min(1, "Funil é obrigatório"),
  stageId: z.string().min(1, "Estágio é obrigatório"),
  value: z.string().min(1, "Valor é obrigatório"),
  assignedTo: z.string().min(1, "Responsável é obrigatório"),
  notes: z.string().optional(),
  title: z.string().optional(),
});

type BulkDealSchema = z.infer<typeof bulkDealSchema>;

export default function BulkDealCreationModal({
  open,
  onOpenChange,
  companies,
}: BulkDealCreationModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const form = useForm<BulkDealSchema>({
    resolver: zodResolver(bulkDealSchema),
    defaultValues: {
      selectedCompanies: [],
      value: "",
      assignedTo: "",
      notes: "",
      title: "",
    },
  });

  // Atualizar assignedTo quando o usuário for carregado
  React.useEffect(() => {
    if (user?.id && !form.getValues("assignedTo")) {
      form.setValue("assignedTo", user.id);
    }
  }, [user?.id, form]);

  // Buscar funis
  const { data: funnels = [] } = useQuery({
    queryKey: ["/api/funnels"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/funnels");
      return response.json();
    },
  });

  // Buscar usuários
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      return response.json();
    },
  });

  // Buscar estágios do funil selecionado
  const selectedFunnelId = form.watch("funnelId");
  const { data: funnelStages = [] } = useQuery<FunnelStage[]>({
    queryKey: [`/api/funnels/${selectedFunnelId}/stages`, selectedFunnelId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/funnels/${selectedFunnelId}/stages`);
      return response.json();
    },
    enabled: !!selectedFunnelId,
  });

  const selectedCompanies = form.watch("selectedCompanies");

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      form.setValue("selectedCompanies", companies.map(c => c.id));
    } else {
      form.setValue("selectedCompanies", []);
    }
  };

  const handleCompanyToggle = (companyId: string, checked: boolean) => {
    const currentSelected = form.getValues("selectedCompanies");
    if (checked) {
      form.setValue("selectedCompanies", [...currentSelected, companyId]);
    } else {
      form.setValue("selectedCompanies", currentSelected.filter(id => id !== companyId));
      setSelectAll(false);
    }
  };

  const createBulkDealsMutation = useMutation({
    mutationFn: async (data: BulkDealSchema) => {
      console.log("Dados para criação em lote:", data);

      if (!data.selectedCompanies || data.selectedCompanies.length === 0) {
        throw new Error("Nenhuma empresa selecionada");
      }

      if (!data.funnelId || !data.stageId) {
        throw new Error("Funil e estágio são obrigatórios");
      }

      if (!data.value || data.value.trim() === "0,00") {
        throw new Error("Valor deve ser maior que zero");
      }

      if (!data.assignedTo) {
        throw new Error("Responsável é obrigatório");
      }

      // Validar se o usuário está autenticado
      if (!user?.id) {
        throw new Error("Usuário não autenticado");
      }

      // Preparar dados no formato que o backend espera
      const bulkData = {
        companies: data.selectedCompanies,
        funnelId: data.funnelId,
        stageId: data.stageId,
        value: data.value.replace(/[^\d,]/g, "").replace(",", "."),
        assignedTo: data.assignedTo,
        notes: data.notes || "",
        title: data.title || "",
      };

      console.log("Dados do formulário:", data);
      console.log("Usuário logado:", user);
      console.log("Dados preparados para envio:", bulkData);

      try {
        const response = await apiRequest("POST", "/api/deals/bulk", bulkData);

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Erro na criação dos negócios");
          } else {
            // Se não é JSON, provavelmente é uma página de erro HTML
            const errorText = await response.text();
            console.error("Resposta não-JSON do servidor:", errorText);
            throw new Error("Erro interno do servidor");
          }
        }

        return response.json();
      } catch (error) {
        console.error("Erro na requisição:", error);
        if (error instanceof TypeError && error.message.includes("JSON")) {
          throw new Error("Erro de comunicação com o servidor");
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      console.log("Resultado da criação em lote:", result);
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });

      if (result.errors > 0) {
        console.warn("Erros na criação:", result.errorDetails);
        toast({
          title: "Negócios criados com avisos",
          description: `${result.created} negócios criados, ${result.errors} falharam. Verifique o console para detalhes.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Negócios criados",
          description: `${result.created} negócios foram criados com sucesso.`,
        });
      }

      onOpenChange(false);
      form.reset();
      setSelectAll(false);
    },
    onError: (error: any) => {
      console.error("Erro na criação em lote:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar os negócios.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BulkDealSchema) => {
    setIsSubmitting(true);
    try {
      await createBulkDealsMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Criar Negócios em Lote</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Seleção de empresas */}
          <div>
            <Label className="text-base font-medium">Empresas *</Label>
            <div className="mt-2 border rounded-md p-4 max-h-60 overflow-y-auto">
              <div className="flex items-center space-x-2 mb-3 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-medium">
                  Selecionar todas ({companies.length})
                </Label>
              </div>

              <div className="space-y-2">
                {companies.map((company) => (
                  <div key={company.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={company.id}
                      checked={selectedCompanies.includes(company.id)}
                      onCheckedChange={(checked) =>
                        handleCompanyToggle(company.id, checked as boolean)
                      }
                    />
                    <Label htmlFor={company.id} className="text-sm">
                      {company.nomeFantasia || company.razaoSocial}
                      {company.city && ` - ${company.city}`}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            {form.formState.errors.selectedCompanies && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.selectedCompanies.message}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {selectedCompanies.length} empresa(s) selecionada(s)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Funil */}
            <div>
              <Label>Funil *</Label>
              <Controller
                name="funnelId"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funnels.map((funnel: any) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          {funnel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.funnelId && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.funnelId.message}
                </p>
              )}
            </div>

            {/* Estágio */}
            <div>
              <Label>Estágio *</Label>
              <Controller
                name="stageId"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estágio..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funnelStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.stageId && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.stageId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável */}
            <div>
              <Label>Responsável *</Label>
              <Controller
                name="assignedTo"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{user.name}</span>
                            <span className="text-xs text-gray-500">
                              ({user.role === "admin" ? "Admin" :
                               user.role === "gerente" ? "Gerente" : "Vendedor"})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.assignedTo && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.assignedTo.message}
                </p>
              )}
            </div>

            {/* Valor */}
            <div>
              <Label>Valor (R$) *</Label>
              <Controller
                name="value"
                control={form.control}
                render={({ field }) => (
                  <Input
                    placeholder="0,00"
                    value={field.value}
                    onChange={(e) => {
                      let rawValue = e.target.value.replace(/\D/g, "");
                      if (rawValue === "") rawValue = "0";

                      const numericValue = parseInt(rawValue, 10);
                      const formattedValue = (numericValue / 100).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });

                      field.onChange(formattedValue);
                    }}
                  />
                )}
              />
              {form.formState.errors.value && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.value.message}
                </p>
              )}
            </div>
          </div>

          {/* Título (opcional) */}
          <div>
            <Label>Título Base (opcional)</Label>
            <Controller
              name="title"
              control={form.control}
              render={({ field }) => (
                <Input
                  placeholder="Deixe vazio para usar nome da empresa"
                  {...field}
                />
              )}
            />
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Controller
              name="notes"
              control={form.control}
              render={({ field }) => (
                <Textarea
                  placeholder="Observações que serão aplicadas a todos os negócios..."
                  rows={3}
                  {...field}
                />
              )}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedCompanies.length === 0}
              className="bg-primary hover:bg-primary-dark text-white"
            >
              {isSubmitting
                ? "Criando..."
                : `Criar ${selectedCompanies.length} Negócio(s)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}