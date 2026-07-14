import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users } from "lucide-react";
import type { RestaurantOrder } from "@shared/schema";

export interface RestaurantTableWithStatus {
  id: string;
  number: number;
  capacity: number;
  section: string | null;
  isActive: boolean;
  status: "livre" | "ocupada" | "aguardando_pagamento";
  orderId: string | null;
  peopleCount: number | null;
  openedAt: string | null;
  waiterId: string | null;
}

const STATUS_STYLES: Record<RestaurantTableWithStatus["status"], string> = {
  livre: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  ocupada: "border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100",
  aguardando_pagamento: "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
};

const STATUS_LABELS: Record<RestaurantTableWithStatus["status"], string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  aguardando_pagamento: "Aguardando pagamento",
};

interface TableMapGridProps {
  onOrderOpened: (orderId: string) => void;
}

export function TableMapGrid({ onOrderOpened }: TableMapGridProps) {
  const [selectedTable, setSelectedTable] = useState<RestaurantTableWithStatus | null>(null);
  const [peopleCount, setPeopleCount] = useState("");

  const { data: tables = [], isLoading } = useQuery<RestaurantTableWithStatus[]>({
    queryKey: ["/api/restaurant-pdv/tables/map"],
    refetchInterval: 15000,
  });

  const openOrderMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/orders", {
        tableId,
        peopleCount: Number(peopleCount),
      });
      return res.json() as Promise<RestaurantOrder>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setSelectedTable(null);
      setPeopleCount("");
      onOrderOpened(created.id);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao abrir mesa", description: err.message, variant: "destructive" });
    },
  });

  const handleTableClick = (table: RestaurantTableWithStatus) => {
    if (table.status === "livre") {
      setSelectedTable(table);
    } else if (table.orderId) {
      onOrderOpened(table.orderId);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-xl font-bold">Mapa de Mesas</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando mesas...</p>
      ) : tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma mesa cadastrada. Peça a um administrador para cadastrar mesas na aba "Mesas".
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 text-center transition-colors",
                STATUS_STYLES[table.status],
              )}
            >
              <span className="text-2xl font-black">{table.number}</span>
              <span className="text-xs font-medium">{STATUS_LABELS[table.status]}</span>
              {table.status !== "livre" && table.peopleCount && (
                <span className="flex items-center gap-1 text-xs opacity-80">
                  <Users className="h-3 w-3" />
                  {table.peopleCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Abrir Mesa {selectedTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="people-count">Número de Pessoas</Label>
            <Input
              id="people-count"
              type="number"
              min="1"
              value={peopleCount}
              onChange={(e) => setPeopleCount(e.target.value)}
              placeholder="Ex: 4"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTable(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !peopleCount || Number(peopleCount) <= 0 || openOrderMutation.isPending
              }
              onClick={() => selectedTable && openOrderMutation.mutate(selectedTable.id)}
            >
              Abrir Comanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
