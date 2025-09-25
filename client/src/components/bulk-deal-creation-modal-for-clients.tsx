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
import { Client, FunnelStage } from "@shared/schema";
import { Checkbox } from "./ui/checkbox";

interface BulkDealCreationModalForClientsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}

const bulkDealClientSchema = z.object({
  selectedClients: z.array(z.string()).min(1, "Selecione pelo menos um cliente"),
  funnelId: z.string().min(1, "Funil é obrigatório"),
  stageId: z.string().min(1, "Estágio é obrigatório"),
  value: z.string().min(1, "Valor é obrigatório"),
  assignedTo: z.string().min(1, "Responsável é obrigatório"),
  notes: z.string().optional(),
  title: z.string().optional(),
});

type BulkDealClientSchema = z.infer<typeof bulkDealClientSchema>;

export default function BulkDealCreationModalForClients({
  open,
  onOpenChange,
  clients,
}: BulkDealCreationModalForClientsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const form = useForm<BulkDealClientSchema>({
    resolver: zodResolver(bulkDealClientSchema),
    defaultValues: {
      selectedClients: [],
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

  const selectedClients = form.watch("selectedClients");

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      form.setValue("selectedClients", clients.map(c => c.id));
    } else {
      form.setValue("selectedClients", []);
    }
  };

  const handleClientToggle = (clientId: string, checked: boolean) => {
    const currentSelected = form.getValues("selectedClients");
    if (checked) {
      form.setValue("selectedClients", [...currentSelected, clientId]);
    } else {
      form.setValue("selectedClients", currentSelected.filter(id => id !== clientId));
      setSelectAll(false);
    }
  };

  const createBulkDealsMutation = useMutation({
    mutationFn: async (data: BulkDealClientSchema) => {
      console.log("Dados para criação em lote (clientes):", data);

      if (!data.selectedClients || data.selectedClients.length === 0) {
        throw new Error("Nenhum cliente selecionado");
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
        clients: data.selectedClients,
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
        const response = await apiRequest("POST", "/api/deals/bulk-clients", bulkData);

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
      console.log("Resultado da criação em lote (clientes):", result);
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
      console.error("Erro na criação em lote (clientes):", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar os negócios.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BulkDealClientSchema) => {
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
          {/* Seleção de clientes */}
          <div>
            <Label className="text-base font-medium">Clientes *</Label>
            <div className="mt-2 border rounded-md p-4 max-h-60 overflow-y-auto">
              <div className="flex items-center space-x-2 mb-3 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-medium">
                  Selecionar todos ({clients.length})
                </Label>
              </div>

              <div className="space-y-2">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={client.id}
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={(checked) =>
                        handleClientToggle(client.id, checked as boolean)
                      }
                    />
                    <Label htmlFor={client.id} className="text-sm">
                      {client.name}
                      {client.phone && ` - ${client.phone}`}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            {form.formState.errors.selectedClients && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.selectedClients.message}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {selectedClients.length} cliente(s) selecionado(s)
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
                  placeholder="Deixe vazio para usar nome do cliente"
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
              disabled={isSubmitting || selectedClients.length === 0}
              className="bg-primary hover:bg-primary-dark text-white"
            >
              {isSubmitting
                ? "Criando..."
                : `Criar ${selectedClients.length} Negócio(s)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}