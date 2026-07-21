import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, LayoutGrid, Plus, Users } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RestaurantOrder } from "@shared/schema";

// Tipo exportado — usado também por transfer-items-dialog e merge-tables-dialog
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

function elapsedLabel(openedAt: string | null) {
  if (!openedAt) return null;
  return formatDistanceToNowStrict(new Date(openedAt), { locale: ptBR });
}

interface TableMapGridProps {
  onOrderOpened: (orderId: string) => void;
}

export function TableMapGrid({ onOrderOpened }: TableMapGridProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [peopleCount, setPeopleCount] = useState("");

  const { data: tables = [], isLoading } = useQuery<RestaurantTableWithStatus[]>({
    queryKey: ["/api/restaurant-pdv/tables/map"],
    refetchInterval: 15000,
  });

  const openOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/orders", {
        tableNumber: Number(tableNumber),
        peopleCount: Number(peopleCount),
      });
      return res.json() as Promise<RestaurantOrder>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setDialogOpen(false);
      setTableNumber("");
      setPeopleCount("");
      onOrderOpened(created.id);
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível abrir a mesa", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="w-full space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={LayoutGrid}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Mesas</PageHeader.Title>
            <PageHeader.Description>
              {tables.length === 0
                ? "Nenhuma mesa aberta no momento"
                : `${tables.length} mesa(s) aberta(s)`}
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button
            size="sm"
            onClick={() => {
              setTableNumber("");
              setPeopleCount("");
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Mesa
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando mesas...</p>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma mesa aberta.</p>
          <Button
            size="sm"
            onClick={() => {
              setTableNumber("");
              setPeopleCount("");
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Abrir primeira mesa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map((table) => {
            const isAguardando = table.status === "aguardando_pagamento";
            return (
              <button
                key={table.id}
                onClick={() => table.orderId && onOrderOpened(table.orderId)}
                className={cn(
                  "group relative flex flex-col rounded-xl border-2 p-4 text-left transition-all duration-150 hover:shadow-md active:scale-95",
                  isAguardando
                    ? "border-blue-300 bg-blue-50 text-blue-900 hover:border-blue-400 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
                    : "border-orange-300 bg-orange-50 text-orange-900 hover:border-orange-400 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100",
                )}
              >
                <span className="text-2xl font-bold leading-none">
                  {table.number}
                </span>
                <span className="mt-0.5 text-xs font-medium opacity-70">
                  Mesa
                </span>

                <div className="mt-3 space-y-1">
                  {table.peopleCount != null && (
                    <div className="flex items-center gap-1 text-xs opacity-80">
                      <Users className="h-3 w-3" />
                      {table.peopleCount} pessoa(s)
                    </div>
                  )}
                  {table.openedAt && (
                    <div className="flex items-center gap-1 text-xs opacity-70">
                      <Clock className="h-3 w-3" />
                      {elapsedLabel(table.openedAt)}
                    </div>
                  )}
                </div>

                {isAguardando && (
                  <span className="mt-2 self-start rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Pagar
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setTableNumber("");
            setPeopleCount("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Nova Mesa</DialogTitle>
            <DialogDescription>
              Informe o número da mesa e a quantidade de pessoas.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              openOrderMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="table-number">Número da Mesa</Label>
              <Input
                id="table-number"
                type="number"
                min="1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ex: 10"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="people-count">Número de Pessoas</Label>
              <Input
                id="people-count"
                type="number"
                min="1"
                value={peopleCount}
                onChange={(e) => setPeopleCount(e.target.value)}
                placeholder="Ex: 4"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setTableNumber("");
                  setPeopleCount("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  !tableNumber ||
                  Number(tableNumber) <= 0 ||
                  !peopleCount ||
                  Number(peopleCount) <= 0 ||
                  openOrderMutation.isPending
                }
              >
                {openOrderMutation.isPending ? "Abrindo..." : "Abrir Mesa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
