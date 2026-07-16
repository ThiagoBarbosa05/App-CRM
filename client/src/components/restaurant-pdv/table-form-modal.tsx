import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { RestaurantTable } from "@shared/schema";

const tableSchema = z.object({
  number: z.coerce.number().int().positive("Número inválido"),
  capacity: z.coerce.number().int().positive("Capacidade inválida"),
  section: z.string().optional(),
});

type TableFormData = z.infer<typeof tableSchema>;

export function TableFormModal({
  open,
  onOpenChange,
  table,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: RestaurantTable | null;
}) {
  const isEditing = !!table;
  const form = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: { number: 1, capacity: 4, section: "" },
  });

  useEffect(() => {
    if (table) {
      form.reset({
        number: table.number,
        capacity: table.capacity,
        section: table.section ?? "",
      });
    } else {
      form.reset({ number: 1, capacity: 4, section: "" });
    }
  }, [table, form]);

  const mutation = useMutation({
    mutationFn: async (data: TableFormData) => {
      const url = isEditing
        ? `/api/restaurant-pdv/tables/${table.id}`
        : "/api/restaurant-pdv/tables";
      await apiRequest(isEditing ? "PUT" : "POST", url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      toast({ title: isEditing ? "Mesa atualizada" : "Mesa criada" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar mesa", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Mesa" : "Nova Mesa"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da mesa</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade (pessoas)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="section"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seção (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Salão, Varanda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
