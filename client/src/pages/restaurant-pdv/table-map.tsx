import { useMemo, useState } from "react";
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
import { CheckCircle2, Clock, LayoutGrid, Users } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
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

type TableStatus = RestaurantTableWithStatus["status"];

const STATUS_CONFIG: Record<
  TableStatus,
  { label: string; icon: typeof CheckCircle2; card: string; dot: string }
> = {
  livre: {
    label: "Livre",
    icon: CheckCircle2,
    card: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  ocupada: {
    label: "Ocupada",
    icon: Users,
    card: "border-orange-300 bg-orange-50 text-orange-900 hover:border-orange-400 hover:shadow-md dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100",
    dot: "bg-orange-500",
  },
  aguardando_pagamento: {
    label: "Aguardando pagamento",
    icon: Clock,
    card: "border-blue-300 bg-blue-50 text-blue-900 hover:border-blue-400 hover:shadow-md dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
    dot: "bg-blue-500",
  },
};

const SEM_SECAO = "Sem seção";

function elapsedLabel(openedAt: string | null) {
  if (!openedAt) return null;
  return formatDistanceToNowStrict(new Date(openedAt), { locale: ptBR });
}

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

  const groupedTables = useMemo(() => {
    const groups = new Map<string, RestaurantTableWithStatus[]>();
    for (const table of tables) {
      const key = table.section?.trim() || SEM_SECAO;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(table);
    }
    return Array.from(groups.entries());
  }, [tables]);

  const showSectionHeadings = groupedTables.length > 1;

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
      // A mesa pode ter sido ocupada por outro garçom entre a listagem e a
      // confirmação — o backend é quem garante a regra, então sincronizamos
      // o mapa e fechamos o diálogo para refletir o estado real.
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setSelectedTable(null);
      toast({ title: "Não foi possível abrir a mesa", description: err.message, variant: "destructive" });
    },
  });

  const handleTableClick = (table: RestaurantTableWithStatus) => {
    if (table.status === "livre") {
      setPeopleCount("");
      setSelectedTable(table);
    } else if (table.orderId) {
      onOrderOpened(table.orderId);
    }
  };

  const handleConfirmOpenOrder = () => {
    if (!selectedTable) return;

    // Revalida contra o estado mais recente já carregado no cliente antes de
    // enviar — evita abrir uma segunda comanda numa mesa que só parecia
    // livre por causa do intervalo entre atualizações do mapa.
    const currentTable = tables.find((t) => t.id === selectedTable.id);
    if (!currentTable || currentTable.status !== "livre") {
      toast({
        title: "Esta mesa não está mais livre",
        description: "Escolha outra mesa disponível.",
        variant: "destructive",
      });
      setSelectedTable(null);
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      return;
    }

    openOrderMutation.mutate(currentTable.id);
  };

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
            <PageHeader.Title>Mapa de Mesas</PageHeader.Title>
            <PageHeader.Description>
              Selecione uma mesa livre para abrir uma nova comanda
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(STATUS_CONFIG) as TableStatus[]).map((status) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_CONFIG[status].dot)} />
                {STATUS_CONFIG[status].label}
              </div>
            ))}
          </div>
        </PageHeader.Actions>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando mesas...</p>
      ) : tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma mesa cadastrada. Peça a um administrador para cadastrar mesas na aba "Mesas".
        </p>
      ) : (
        <div className="space-y-6">
          {groupedTables.map(([section, sectionTables]) => (
            <div key={section} className="space-y-3">
              {showSectionHeadings && (
                <h2 className="text-sm font-semibold text-muted-foreground">{section}</h2>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {sectionTables.map((table) => {
                  const config = STATUS_CONFIG[table.status];
                  const elapsed = table.status !== "livre" ? elapsedLabel(table.openedAt) : null;

                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 text-center transition-all duration-150 hover:scale-[1.03] active:scale-[0.98]",
                        config.card,
                      )}
                    >
                      <config.icon className="h-4 w-4 opacity-70" />
                      <span className="text-2xl font-black leading-none">{table.number}</span>
                      <span className="text-xs font-medium">{config.label}</span>
                      {table.status !== "livre" && table.peopleCount && (
                        <span className="flex items-center gap-1 text-xs opacity-80">
                          <Users className="h-3 w-3" />
                          {table.peopleCount}
                        </span>
                      )}
                      {elapsed && <span className="text-[11px] opacity-70">há {elapsed}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!selectedTable}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTable(null);
            setPeopleCount("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Abrir Mesa {selectedTable?.number}</DialogTitle>
            {selectedTable && (
              <DialogDescription>
                Capacidade: {selectedTable.capacity} pessoa(s)
                {selectedTable.section ? ` · ${selectedTable.section}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          <form
            className="space-y-2 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmOpenOrder();
            }}
          >
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
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTable(null);
                  setPeopleCount("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  !peopleCount || Number(peopleCount) <= 0 || openOrderMutation.isPending
                }
              >
                {openOrderMutation.isPending ? "Abrindo..." : "Abrir Comanda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
