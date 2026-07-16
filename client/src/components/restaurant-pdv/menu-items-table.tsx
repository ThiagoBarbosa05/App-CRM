import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type { RestaurantMenuItem } from "@shared/schema";

interface MenuItemsTableProps {
  items: RestaurantMenuItem[];
  onEditItem: (item: RestaurantMenuItem) => void;
  onNewItem: () => void;
}

export function MenuItemsTable({ items, onEditItem, onNewItem }: MenuItemsTableProps) {
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

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cardápio</CardTitle>
          <p className="text-xs text-muted-foreground">{activeCount} item(ns) ativo(s)</p>
        </div>
        <Button size="sm" onClick={onNewItem}>
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
                  onClick={() => onEditItem(item)}
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
    </Card>
  );
}
