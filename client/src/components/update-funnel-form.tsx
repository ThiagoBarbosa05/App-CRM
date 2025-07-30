import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { DialogClose } from "./ui/dialog";
import { useForm } from "react-hook-form";
import { InsertSalesFunnel, insertSalesFunnelSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { SalesFunnel } from "./funnels-management";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useRef } from "react";

interface UpdateFunnelFormProps {
  funnel: SalesFunnel;
  openUpdateModal: (open: boolean) => void;
}

export function UpdateFunnelForm({
  funnel,
  openUpdateModal,
}: UpdateFunnelFormProps) {
  const {
    register,
    handleSubmit,

    formState: { errors },
  } = useForm<InsertSalesFunnel>({
    resolver: zodResolver(insertSalesFunnelSchema),
    defaultValues: {
      name: funnel.name,
      description: funnel.description,
      createdBy: funnel.createdBy,
    },
  });

  const closeRef = useRef<HTMLButtonElement>(null);

  const updateFunnelMutation = useMutation({
    mutationFn: async (funnelData: {
      name: string;
      description?: string;
      funnelId: string;
    }) => {
      const response = await fetch(`/api/funnels/${funnelData.funnelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: funnelData.name,
          description: funnelData.description,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar funil");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Funil atualizado com sucesso",
        description: "O funil foi atualizado com novos dados.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      closeRef.current?.click();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: InsertSalesFunnel) {
    updateFunnelMutation.mutateAsync({
      funnelId: funnel.id,
      name: data.name,
      description: data.description ?? funnel.description,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome do Funil</Label>
          <Input
            id="name"
            placeholder="Ex: Vendas Online"
            {...register("name")}
          />
          <input
            type="hidden"
            {...register("createdBy")}
            value={funnel.createdBy}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            placeholder="Descreva o objetivo deste funil de vendas"
            {...register("description")}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button ref={closeRef} type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button disabled={updateFunnelMutation.isPending} type="submit">
          {updateFunnelMutation.isPending ? "Atualizando..." : "Editar Funil"}
        </Button>
      </div>
    </form>
  );
}
