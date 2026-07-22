import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { setPdvCurrentUnitId } from "@/lib/pdv-unit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Clock,
  ExternalLink,
  RefreshCw,
  ShoppingCart,
  Table2,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";

interface OpenOrder {
  id: string;
  tableNumber: number;
  tableId: string | null;
  peopleCount: number;
  clientName: string | null;
  openedAt: string;
  paymentRequestedAt: string | null;
  waiterId: string;
  waiterName: string | null;
  itemCount: number;
  subtotal: number;
}

interface UnitOverview {
  unit: { id: string; name: string; cnpj: string | null };
  cashSession: { id: string; openedAt: string; status: string } | null;
  openOrders: OpenOrder[];
  stats: { totalTables: number; occupiedTables: number; cashStatus: "aberto" | "fechado" };
}

interface CancelDialogState {
  order: OpenOrder;
  unitName: string;
}

function OrderRow({
  order,
  onOpen,
  onCancel,
}: {
  order: OpenOrder;
  onOpen: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 hover:bg-accent/30 transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 font-bold text-sm">
        {order.tableNumber}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">Mesa {order.tableNumber}</span>
          {order.clientName && (
            <span className="text-xs text-muted-foreground truncate">— {order.clientName}</span>
          )}
          {order.paymentRequestedAt && (
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
              Aguardando pagamento
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {order.peopleCount}p
          </span>
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-3 w-3" />
            {order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNowStrict(new Date(order.openedAt), { locale: ptBR })}
          </span>
          {order.waiterName && (
            <span className="truncate hidden sm:inline">Garçom: {order.waiterName}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(order.subtotal)}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onCancel}>
            <Trash2 className="h-3 w-3 mr-1 text-destructive" />
            Cancelar
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onOpen}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnitCard({
  overview,
  onOpenOrder,
  onCancelOrder,
}: {
  overview: UnitOverview;
  onOpenOrder: (unitId: string, orderId: string) => void;
  onCancelOrder: (order: OpenOrder, unitName: string) => void;
}) {
  const { unit, cashSession, openOrders, stats } = overview;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-orange-500 shrink-0" />
            <CardTitle className="text-base truncate">{unit.name}</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              stats.cashStatus === "aberto"
                ? "border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 shrink-0"
                : "border-muted text-muted-foreground shrink-0"
            }
          >
            <Wallet className="h-3 w-3 mr-1" />
            {stats.cashStatus === "aberto" ? "Caixa aberto" : "Caixa fechado"}
          </Badge>
        </div>

        {unit.cnpj && <p className="text-xs text-muted-foreground mt-1">{unit.cnpj}</p>}

        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            <span>
              <strong className="text-foreground">{stats.occupiedTables}</strong>
              {" / "}{stats.totalTables} mesas ocupadas
            </span>
          </span>
          {cashSession && (
            <span className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              Aberto {formatDistanceToNowStrict(new Date(cashSession.openedAt), { locale: ptBR })}
            </span>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 pt-3">
        {openOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm gap-1">
            <Table2 className="h-8 w-8 opacity-30" />
            <span>Nenhuma mesa ocupada</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {openOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onOpen={() => onOpenOrder(unit.id, order.id)}
                onCancel={() => onCancelOrder(order, unit.name)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState | null>(null);

  const { data: overview = [], isLoading, refetch, isFetching } = useQuery<UnitOverview[]>({
    queryKey: ["/api/restaurant-pdv/admin/units-overview"],
    refetchInterval: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest("DELETE", `/api/restaurant-pdv/admin/orders/${orderId}`),
    onSuccess: () => {
      toast({ title: "Mesa cancelada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/admin/units-overview"] });
      setCancelDialog(null);
    },
    onError: (err: any) => {
      let description = "Tente novamente";
      const raw: string = err?.message ?? "";
      const match = raw.match(/^\d+: (.+)$/s);
      if (match) {
        try { description = (JSON.parse(match[1]) as any).message ?? raw; }
        catch { description = match[1]; }
      } else if (raw) {
        description = raw;
      }
      toast({ title: "Erro ao cancelar mesa", description, variant: "destructive" });
    },
  });

  const handleOpenOrder = (unitId: string, orderId: string) => {
    setPdvCurrentUnitId(unitId);
    navigate(`/pdv-restaurante?orderId=${orderId}`);
  };

  const totalOccupied = overview.reduce((s, u) => s + u.stats.occupiedTables, 0);
  const totalTables = overview.reduce((s, u) => s + u.stats.totalTables, 0);
  const openCashSessions = overview.filter((u) => u.stats.cashStatus === "aberto").length;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Painel Multi-Unidade</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de todas as unidades do PDV
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo global */}
      {!isLoading && overview.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-border shrink-0">
          <div className="bg-card px-6 py-3 flex flex-col">
            <span className="text-xs text-muted-foreground">Unidades ativas</span>
            <span className="text-2xl font-bold">{overview.length}</span>
          </div>
          <div className="bg-card px-6 py-3 flex flex-col">
            <span className="text-xs text-muted-foreground">Mesas ocupadas</span>
            <span className="text-2xl font-bold">
              {totalOccupied}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {totalTables}</span>
            </span>
          </div>
          <div className="bg-card px-6 py-3 flex flex-col">
            <span className="text-xs text-muted-foreground">Caixas abertos</span>
            <span className="text-2xl font-bold">{openCashSessions}</span>
          </div>
        </div>
      )}

      {/* Cards de unidades */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded mt-2" />
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : overview.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
            <Building2 className="h-12 w-12 opacity-30" />
            <p className="text-base">Nenhuma unidade PDV cadastrada</p>
            <p className="text-sm">Crie unidades em Configurações → Unidades</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {overview.map((unitOverview) => (
              <UnitCard
                key={unitOverview.unit.id}
                overview={unitOverview}
                onOpenOrder={handleOpenOrder}
                onCancelOrder={(order, unitName) => setCancelDialog({ order, unitName })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Mesa {cancelDialog?.order.tableNumber}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Você está cancelando a comanda da{" "}
                  <strong className="text-foreground">Mesa {cancelDialog?.order.tableNumber}</strong>
                  {cancelDialog?.unitName ? ` — ${cancelDialog.unitName}` : ""}.
                </p>
                {cancelDialog?.order.subtotal != null && cancelDialog.order.subtotal > 0 && (
                  <p>
                    Subtotal atual:{" "}
                    <strong className="text-foreground">
                      {formatCurrency(cancelDialog.order.subtotal)}
                    </strong>
                  </p>
                )}
                <p className="text-destructive font-medium">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              onClick={() => cancelDialog && cancelMutation.mutate(cancelDialog.order.id)}
            >
              {cancelMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
