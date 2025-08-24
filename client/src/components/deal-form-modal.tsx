import { useState } from "react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { DealWithClient, Client, FunnelStage } from "@shared/schema";
import { dealValidationSchema } from "@/lib/validations";
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
import { X } from "lucide-react";
import { Label } from "./ui/label";
import z from "zod";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

interface DealFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: DealWithClient;
  funnelId?: string;
  initialClientId?: string;
  initialTitle?: string;
}

const createDealSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  funnelId: z.string().min(1, "Funil é obrigatório"),
  stageId: z.string().min(1, "Estágio é obrigatório"),
  value: z.string().min(1, "Valor é obrigatório"),
  notes: z.string().optional().nullable(),
});

type CreateDealSchema = z.infer<typeof createDealSchema>;

export default function DealFormModal({
  open,
  onOpenChange,
  deal,
  funnelId,
  initialClientId,
  initialTitle,
}: DealFormModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Buscar etapas do funil
  const { data: funnelStages = [] } = useQuery<FunnelStage[]>({
    queryKey: [`/api/funnels/${funnelId}/stages`, funnelId],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/funnels/${funnelId}/stages`,
        "GET",
      );
      return response.json();
    },
    enabled: !!funnelId,
  });

  // Provide default empty array if clients is undefined
  const clientsList = clients || [];

  const form = useForm<CreateDealSchema>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      title: deal?.title || initialTitle || "",
      clientId: deal?.clientId || initialClientId || "",
      value: deal?.value || "",
      stageId: deal?.stageId || "",
      notes: deal?.notes || "",
      funnelId: deal?.funnelId || funnelId || "",
    },
  });

  // Atualizar o formulário quando os dados mudarem
  React.useEffect(() => {
    if (deal) {
      form.reset({
        title: deal.title || "",
        clientId: deal.clientId || "",
        value: deal.value || "",
        stageId: deal.stageId || funnelStages[0]?.id || "",
        notes: deal.notes || "",
        funnelId: deal.funnelId || funnelId || "",
      });
    } else if (funnelId) {
      form.setValue("funnelId", funnelId);
      if (funnelStages.length > 0 && !form.getValues("stageId")) {
        form.setValue("stageId", funnelStages[0].id);
      }
    }
  }, [deal, funnelId, funnelStages, form]);

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/deals", "POST", {
        ...data,
        assignedTo: user?.id,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Negócio criado",
        description: "Negócio foi adicionado com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o negócio.",
        variant: "destructive",
      });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/deals/${deal!.id}`, "PUT", {
        ...data,
        assignedTo: user?.id,
        createdBy: user?.id,
      });

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Negócio atualizado",
        description: "Negócio foi atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o negócio.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // Convert value to number format for API
      const formattedData = {
        ...data,
        value: data.value
          .toString()
          .replace(/[^\d,]/g, "")
          .replace(",", "."),
      };

      if (deal) {
        await updateDealMutation.mutateAsync(data);
      } else {
        await createDealMutation.mutateAsync(formattedData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg mx-4">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {deal ? "Editar Negócio" : "Novo Negócio"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          action=""
        >
          <div>
            <Label>Título do negócio *</Label>
            <Input placeholder="Digite o título" {...form.register("title")} />
            {form.formState.errors.title && (
              <span className="text-sm text-red-500">
                {form.formState.errors.title.message}
              </span>
            )}
          </div>

          <div>
            <Label>Cliente *</Label>
            <Controller
              name="clientId"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(clientsList) && clientsList.length > 0 ? (
                      clientsList.map((client: Client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Nenhum cliente encontrado" disabled>
                        Nenhum cliente encontrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.clientId && (
              <span className="text-sm text-red-500">
                {form.formState.errors.clientId.message}
              </span>
            )}
          </div>

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
                    let rawValue = e.target.value.replace(/\D/g, ""); // remove tudo que não é número
                    if (rawValue === "") rawValue = "0";

                    const numericValue = parseInt(rawValue, 10);
                    const formattedValue = (numericValue / 100).toLocaleString(
                      "pt-BR",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    );

                    field.onChange(formattedValue);
                  }}
                />
              )}
            />
            {form.formState.errors.value && (
              <span className="text-sm text-red-500">
                {form.formState.errors.value.message}
              </span>
            )}
          </div>

          <div>
            <Label>Estágio *</Label>
            <Controller
              name="stageId"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {funnelStages.length > 0 ? (
                      funnelStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Nenhuma etapa selecionada" disabled>
                        Nenhuma etapa configurada para este funil
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.stageId && (
              <span className="text-sm text-red-500">
                {form.formState.errors.stageId.message}
              </span>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              placeholder="Adicione observações sobre o negócio..."
              rows={3}
              {...form.register("notes")}
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
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-dark text-white"
            >
              {isSubmitting
                ? "Salvando..."
                : deal
                  ? "Atualizar Negócio"
                  : "Criar Negócio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
