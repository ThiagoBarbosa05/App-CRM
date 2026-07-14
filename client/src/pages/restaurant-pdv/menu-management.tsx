import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import type { RestaurantMenuItem } from "@shared/schema";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

const BLING_CONNECTION_SETTING_KEY = "restaurant_pdv_bling_connection_id";

const menuItemSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  price: z.string().min(1, "Preço é obrigatório"),
  category: z.string().optional(),
});

type MenuItemFormData = z.infer<typeof menuItemSchema>;

function MenuItemFormModal({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: RestaurantMenuItem | null;
}) {
  const isEditing = !!item;
  const form = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: { name: "", price: "", category: "" },
  });

  useEffect(() => {
    if (item) {
      form.reset({ name: item.name, price: item.price, category: item.category ?? "" });
    } else {
      form.reset({ name: "", price: "", category: "" });
    }
  }, [item, form]);

  const mutation = useMutation({
    mutationFn: async (data: MenuItemFormData) => {
      const url = isEditing
        ? `/api/restaurant-pdv/menu-items/${item.id}`
        : "/api/restaurant-pdv/menu-items";
      await apiRequest(isEditing ? "PUT" : "POST", url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/menu-items"] });
      toast({ title: isEditing ? "Item atualizado" : "Item criado" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar item", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Item" : "Novo Item"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Água com gás" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Bebidas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" {...field} />
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

function BlingIntegrationCard() {
  const { data: accounts = [] } = useBlingAccounts();
  const connectedAccounts = accounts.filter((a) => a.status === "connected");

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });
  const connectionId = settings?.[BLING_CONNECTION_SETTING_KEY] ?? "";

  const saveConnectionMutation = useMutation({
    mutationFn: async (value: string) =>
      apiRequest("PUT", `/api/system-settings/${BLING_CONNECTION_SETTING_KEY}`, {
        value,
        description: "Conexão Bling usada para sincronizar o cardápio do PDV Restaurante",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({ title: "Conexão Bling salva" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar conexão", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/menu-items/sync-bling", {
        connectionId: connectionId || undefined,
      });
      return res.json() as Promise<{ created: number; updated: number; skipped: number; total: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/menu-items"] });
      toast({
        title: "Sincronização concluída",
        description: `${result.created} criados, ${result.updated} atualizados, ${result.skipped} ignorados`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integração com Bling</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px] space-y-2">
          <Label>Conexão Bling do restaurante</Label>
          <Select value={connectionId} onValueChange={(value) => saveConnectionMutation.mutate(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conexão conectada" />
            </SelectTrigger>
            <SelectContent>
              {connectedAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.blingAccountName ?? account.name}
                </SelectItem>
              ))}
              {connectedAccounts.length === 0 && (
                <SelectItem value="none" disabled>
                  Nenhuma conexão conectada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={!connectionId || syncMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar com Bling"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RestaurantMenuManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RestaurantMenuItem | null>(null);

  const { data: items = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/restaurant-pdv/menu-items?includeInactive=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar cardápio");
      return res.json();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/restaurant-pdv/menu-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/menu-items"] });
      toast({ title: "Item desativado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desativar item", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <BlingIntegrationCard />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cardápio</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Item
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell
                    className="cursor-pointer font-medium"
                    onClick={() => {
                      setEditingItem(item);
                      setModalOpen(true);
                    }}
                  >
                    {item.name}
                  </TableCell>
                  <TableCell>{item.category ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(item.price)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.blingProductId ? "Bling" : "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "outline"}>
                      {item.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.isActive && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deactivateMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum item cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <MenuItemFormModal open={modalOpen} onOpenChange={setModalOpen} item={editingItem} />
      </Card>
    </div>
  );
}
