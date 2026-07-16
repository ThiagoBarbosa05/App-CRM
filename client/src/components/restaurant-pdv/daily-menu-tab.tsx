import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { RestaurantMenuItem } from "@shared/schema";

function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

export function DailyMenuTab() {
  const [date, setDate] = useState(todayIso());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: allItems = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items"],
  });

  const { data: dailyMenuItems, isLoading } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/daily-menu", date],
    queryFn: async () => {
      const res = await fetch(
        `/api/restaurant-pdv/daily-menu?date=${date}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Erro ao buscar cardápio do dia");
      return res.json();
    },
  });

  useEffect(() => {
    if (dailyMenuItems) {
      setSelectedIds(new Set(dailyMenuItems.map((item) => item.id)));
    }
  }, [dailyMenuItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/restaurant-pdv/daily-menu", {
        date,
        menuItemIds: Array.from(selectedIds),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/restaurant-pdv/daily-menu", date],
      });
      toast({ title: "Cardápio do dia salvo" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao salvar cardápio do dia",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Cardápio do Dia</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="daily-menu-date" className="text-xs text-muted-foreground">
            Data
          </Label>
          <Input
            id="daily-menu-date"
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Marque os itens do cardápio mestre que estarão disponíveis para venda
          nesta data. A comanda oferecerá apenas os itens marcados aqui.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {allItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(item.price)}
                </span>
              </label>
            ))}
            {allItems.length === 0 && (
              <p className="col-span-2 text-sm text-muted-foreground">
                Nenhum item ativo no cardápio mestre.
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar cardápio do dia"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
