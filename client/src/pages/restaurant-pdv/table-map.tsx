import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, LayoutGrid, Lock, Plus, Trash2, Users } from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import type { RestaurantOrder } from "@shared/schema";
import { OpenTableDialog } from "@/components/restaurant-pdv/open-table-dialog";

// Tipo exportado — usado também por transfer-items-dialog e merge-tables-dialog
export interface RestaurantTableWithStatus {
  /** Identidade da linha = a comanda aberta. */
  id: string;
  tableId: string | null;
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
  const { user } = useAuth();
  const [, navigate] = useLocation();
  // Espelha o requireGestor do backend. Havia um terceiro valor,
  // "administrador", que não existe no enum de roles — condição morta.
  const isGestor = user?.role === "admin" || user?.role === "gerente";

  const [dialogOpen, setDialogOpen] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteNumber, setConfirmDeleteNumber] = useState<number | null>(null);

  const { data: tables = [], isLoading } = useQuery<RestaurantTableWithStatus[]>({
    queryKey: ["/api/restaurant-pdv/tables/map"],
    refetchInterval: 15000,
  });

  // Sem caixa aberto o backend recusa abrir mesa (409). O garçom consulta o
  // estado mesmo sem poder operar o caixa, para a tela explicar o bloqueio em
  // vez de deixá-lo preencher o diálogo e falhar no final.
  const { data: cashData } = useQuery<{ session: { id: string } | null }>({
    queryKey: ["/api/restaurant-pdv/cash-sessions/current"],
    refetchInterval: 30000,
  });
  const cashSessionOpen = !!cashData?.session;

  const openOrderMutation = useMutation({
    mutationFn: async (data: {
      tableNumber: string;
      peopleCount: string;
      clientId: string | null;
      clientName: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/orders", {
        tableNumber: Number(data.tableNumber),
        peopleCount: Number(data.peopleCount),
        clientId: data.clientId,
        clientName: data.clientName,
      });
      return res.json() as Promise<RestaurantOrder>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setDialogOpen(false);
      onOrderOpened(created.id);
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível abrir a mesa", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("DELETE", `/api/restaurant-pdv/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setConfirmDeleteId(null);
      setConfirmDeleteNumber(null);
      toast({ title: "Mesa excluída com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível excluir a mesa", description: err.message, variant: "destructive" });
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
            disabled={!cashSessionOpen}
            title={!cashSessionOpen ? "Abra o caixa para liberar o PDV" : undefined}
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Mesa
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {!cashSessionOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              Caixa fechado
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {isGestor
                ? "Abra o caixa para liberar a abertura de mesas."
                : "Peça a um gerente para abrir o caixa — não é possível abrir mesas até lá."}
            </p>
          </div>
          {isGestor && (
            <Button size="sm" onClick={() => navigate("/pdv-restaurante/caixa")}>
              Abrir caixa
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando mesas...</p>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma mesa aberta.</p>
          <Button
            size="sm"
            disabled={!cashSessionOpen}
            title={!cashSessionOpen ? "Abra o caixa para liberar o PDV" : undefined}
            onClick={() => setDialogOpen(true)}
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
              <div key={table.id} className="group relative">
                <button
                  onClick={() => table.orderId && onOrderOpened(table.orderId)}
                  className={cn(
                    "w-full flex flex-col rounded-xl border-2 p-4 text-left transition-all duration-150 hover:shadow-md active:scale-95",
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

                {isGestor && table.orderId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(table.orderId);
                      setConfirmDeleteNumber(table.number);
                    }}
                    className="absolute top-2 right-2 rounded-md p-1 text-red-500 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-700 group-hover:opacity-100 dark:hover:bg-red-900/30"
                    title="Excluir mesa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <OpenTableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPending={openOrderMutation.isPending}
        onConfirm={(data) => openOrderMutation.mutate(data)}
      />

      {/* Dialog — confirmar exclusão */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeleteId(null);
            setConfirmDeleteNumber(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Excluir Mesa {confirmDeleteNumber}?</DialogTitle>
            <DialogDescription>
              Esta ação cancela a comanda e remove a mesa do mapa. Itens e
              pagamentos registrados serão descartados. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDeleteId(null);
                setConfirmDeleteNumber(null);
              }}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
