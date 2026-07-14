import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Trash2 } from "lucide-react";
import type { RestaurantTable } from "@shared/schema";

const tableSchema = z.object({
  number: z.coerce.number().int().positive("Número inválido"),
  capacity: z.coerce.number().int().positive("Capacidade inválida"),
  section: z.string().optional(),
});

type TableFormData = z.infer<typeof tableSchema>;

function TableFormModal({
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

export default function RestaurantTablesManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  const { data: tables = [] } = useQuery<RestaurantTable[]>({
    queryKey: ["/api/restaurant-pdv/tables", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/restaurant-pdv/tables?includeInactive=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar mesas");
      return res.json();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/restaurant-pdv/tables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      toast({ title: "Mesa desativada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desativar mesa", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mesas</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingTable(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Mesa
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Seção</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell
                    className="cursor-pointer font-medium"
                    onClick={() => {
                      setEditingTable(table);
                      setModalOpen(true);
                    }}
                  >
                    Mesa {table.number}
                  </TableCell>
                  <TableCell>{table.capacity}</TableCell>
                  <TableCell>{table.section ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={table.isActive ? "default" : "outline"}>
                      {table.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {table.isActive && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deactivateMutation.mutate(table.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma mesa cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <TableFormModal open={modalOpen} onOpenChange={setModalOpen} table={editingTable} />
      </Card>
    </div>
  );
}
