import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRightLeft,
  Clock,
  Combine,
  Receipt,
  Users,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  Product,
  RestaurantMenuItem,
  RestaurantOrderItem,
  RestaurantOrder,
} from "@shared/schema";
import { TableMapGrid } from "./table-map";
import { ReasonPromptDialog } from "@/components/restaurant-pdv/reason-prompt-dialog";
import { ApplyDiscountDialog } from "@/components/restaurant-pdv/apply-discount-dialog";
import { SplitBillDialog } from "@/components/restaurant-pdv/split-bill-dialog";
import { TransferItemsDialog } from "@/components/restaurant-pdv/transfer-items-dialog";
import { MergeTablesDialog } from "@/components/restaurant-pdv/merge-tables-dialog";
import { OrderReceiptPrint } from "@/components/restaurant-pdv/order-receipt-print";
import { OrderItemSelector } from "@/components/restaurant-pdv/order-item-selector";
import { OrderSummaryCard } from "@/components/restaurant-pdv/order-summary-card";

interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  aberta: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
  fechada: "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
  mesclada: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  aguardando_pagamento: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function RestaurantPos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [itemToCancel, setItemToCancel] = useState<RestaurantOrderItem | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const setActiveOrder = (id: string | null) => {
    setActiveOrderId(id);
  };

  // Permite reabrir uma comanda em aberto a partir do histórico
  // (/pdv-restaurante?orderId=xxx). Fora isso, a página sempre inicia
  // no mapa de mesas — nunca reabre a última comanda automaticamente.
  useEffect(() => {
    const orderIdFromUrl = new URLSearchParams(window.location.search).get(
      "orderId",
    );
    if (orderIdFromUrl) setActiveOrder(orderIdFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: order, isLoading: isLoadingOrder } = useQuery<RestaurantOrderWithItems>({
    queryKey: ["/api/restaurant-pdv/orders", activeOrderId],
    enabled: !!activeOrderId,
  });

  const invalidateOrder = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/restaurant-pdv/orders", activeOrderId],
    });
    queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
  };

  const requestPaymentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/request-payment`);
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao pedir a conta", description: err.message, variant: "destructive" });
    },
  });

  const cancelPaymentRequestMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(
        "POST",
        `/api/restaurant-pdv/orders/${activeOrderId}/cancel-payment-request`,
      );
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao cancelar pedido", description: err.message, variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: {
      menuItemId?: string | null;
      productId?: string | null;
      name: string;
      unitPrice: string;
      quantity: number;
    }) => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/items`, data);
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar item", description: err.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: { unitPrice?: string; quantity?: number };
    }) => {
      await apiRequest(
        "PUT",
        `/api/restaurant-pdv/orders/${activeOrderId}/items/${itemId}`,
        data,
      );
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar item", description: err.message, variant: "destructive" });
    },
  });

  const cancelItemMutation = useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      await apiRequest(
        "DELETE",
        `/api/restaurant-pdv/orders/${activeOrderId}/items/${itemId}`,
        { reason },
      );
    },
    onSuccess: () => {
      invalidateOrder();
      setItemToCancel(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao cancelar item", description: err.message, variant: "destructive" });
    },
  });

  const applyDiscountMutation = useMutation({
    mutationFn: async (data: {
      discountPercent?: string;
      discountAmount?: string;
      reason: string;
    }) => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/discount`, data);
    },
    onSuccess: () => {
      invalidateOrder();
      setDiscountDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao aplicar desconto", description: err.message, variant: "destructive" });
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/restaurant-pdv/orders/${activeOrderId}/discount`);
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao remover desconto", description: err.message, variant: "destructive" });
    },
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/close`, {
        paymentMethod,
      });
    },
    onSuccess: () => {
      toast({ title: "Comanda fechada", description: "Venda registrada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setActiveOrder(null);
      setPaymentMethod("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao fechar comanda", description: err.message, variant: "destructive" });
    },
  });

  const splitCloseMutation = useMutation({
    mutationFn: async (
      payments: { method: string; amount: string; payerLabel: string }[],
    ) => {
      for (const payment of payments) {
        await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/payments`, payment);
      }
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/close`, {});
    },
    onSuccess: () => {
      toast({ title: "Comanda fechada", description: "Conta dividida com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setSplitDialogOpen(false);
      setActiveOrder(null);
      setPaymentMethod("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao dividir conta", description: err.message, variant: "destructive" });
    },
  });

  const transferItemsMutation = useMutation({
    mutationFn: async ({
      itemIds,
      targetOrderId,
    }: {
      itemIds: string[];
      targetOrderId: string;
    }) => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/transfer-items`, {
        itemIds,
        targetOrderId,
      });
    },
    onSuccess: () => {
      toast({ title: "Itens transferidos" });
      invalidateOrder();
      setTransferDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao transferir itens", description: err.message, variant: "destructive" });
    },
  });

  const mergeOrdersMutation = useMutation({
    mutationFn: async (targetOrderId: string) => {
      await apiRequest(
        "POST",
        `/api/restaurant-pdv/orders/${activeOrderId}/merge-into/${targetOrderId}`,
      );
    },
    onSuccess: () => {
      toast({ title: "Mesas mescladas com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      setMergeDialogOpen(false);
      setActiveOrder(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao juntar mesas", description: err.message, variant: "destructive" });
    },
  });

  const handleAddMenuItem = (menuItem: RestaurantMenuItem) => {
    const existing = order?.items.find((i) => i.menuItemId === menuItem.id);
    if (existing) {
      updateItemMutation.mutate({
        itemId: existing.id,
        data: { quantity: existing.quantity + 1 },
      });
    } else {
      addItemMutation.mutate({
        menuItemId: menuItem.id,
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: 1,
      });
    }
  };

  const handleAddProduct = (product: Product) => {
    const existing = order?.items.find((i) => i.productId === product.id);
    if (existing) {
      updateItemMutation.mutate({
        itemId: existing.id,
        data: { quantity: existing.quantity + 1 },
      });
    } else {
      addItemMutation.mutate({
        productId: product.id,
        name: product.name,
        unitPrice: product.negotiatedPrice,
        quantity: 1,
      });
    }
  };

  const handleAddCustomItem = (name: string, unitPrice: string) => {
    addItemMutation.mutate({
      menuItemId: null,
      name,
      unitPrice,
      quantity: 1,
    });
  };

  const items = order?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );
  const discountAmount = order?.discountAmount
    ? Number(order.discountAmount)
    : order?.discountPercent
      ? subtotal * (Number(order.discountPercent) / 100)
      : 0;
  const discountedSubtotal = Math.max(subtotal - discountAmount, 0);
  const serviceFee = discountedSubtotal * 0.1;
  const total = discountedSubtotal + serviceFee;
  const hasDiscount = !!order?.discountAmount || !!order?.discountPercent;

  const isGarcom = user?.role === "garcom";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        {!isGarcom && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-muted-foreground"
              onClick={() => navigate("/pdv-restaurante/comandas")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <Separator orientation="vertical" className="h-5 shrink-0" />
          </>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">PDV Restaurante</span>
        </div>
        {user?.name && (
          <span className="ml-auto text-xs text-muted-foreground">
            Garçom: {user.name}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-auto">
        {!activeOrderId ? (
          <TableMapGrid onOrderOpened={(id) => setActiveOrder(id)} />
        ) : isLoadingOrder || !order ? (
          <div className="p-6 text-center text-muted-foreground">Carregando comanda...</div>
        ) : (
          <div className="w-full space-y-6 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 -ml-2 px-2 text-muted-foreground"
                  onClick={() => setActiveOrder(null)}
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Mapa de mesas
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold">Mesa {order.tableNumber}</h1>
                  <Badge
                    variant="outline"
                    className={cn(
                      "uppercase",
                      STATUS_BADGE_CLASS[
                        order.paymentRequestedAt ? "aguardando_pagamento" : order.status
                      ],
                    )}
                  >
                    {order.paymentRequestedAt ? "Aguardando pagamento" : order.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {order.peopleCount} pessoa(s)
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Aberta há{" "}
                    {formatDistanceToNowStrict(new Date(order.openedAt), { locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransferDialogOpen(true)}
                  disabled={items.length === 0}
                >
                  <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                  Transferir itens
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMergeDialogOpen(true)}>
                  <Combine className="mr-1.5 h-3.5 w-3.5" />
                  Juntar mesa
                </Button>
                <OrderReceiptPrint orderId={order.id} label="Imprimir comanda" />
                {order.paymentRequestedAt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelPaymentRequestMutation.mutate()}
                    disabled={cancelPaymentRequestMutation.isPending}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancelar pedido
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => requestPaymentMutation.mutate()}
                    disabled={requestPaymentMutation.isPending || items.length === 0}
                  >
                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                    Pedir a conta
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Item</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderItemSelector
                    blingConnectionId={order.blingConnectionId}
                    addingDisabled={addItemMutation.isPending || updateItemMutation.isPending}
                    onAddMenuItem={handleAddMenuItem}
                    onAddProduct={handleAddProduct}
                    onAddCustomItem={handleAddCustomItem}
                  />
                </CardContent>
              </Card>

              <OrderSummaryCard
                order={order}
                items={items}
                subtotal={subtotal}
                discountAmount={discountAmount}
                serviceFee={serviceFee}
                total={total}
                hasDiscount={hasDiscount}
                isGarcom={isGarcom}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                onUpdateItemQuantity={(itemId, quantity) =>
                  updateItemMutation.mutate({ itemId, data: { quantity } })
                }
                onUpdateItemPrice={(itemId, unitPrice) =>
                  updateItemMutation.mutate({ itemId, data: { unitPrice } })
                }
                onCancelItem={setItemToCancel}
                onRemoveDiscount={() => removeDiscountMutation.mutate()}
                removeDiscountPending={removeDiscountMutation.isPending}
                onApplyDiscountClick={() => setDiscountDialogOpen(true)}
                onSplitClick={() => setSplitDialogOpen(true)}
                onCloseOrder={() => closeOrderMutation.mutate()}
                closeOrderPending={closeOrderMutation.isPending}
              />
            </div>
          </div>
        )}
      </main>

      <ReasonPromptDialog
        open={!!itemToCancel}
        onOpenChange={(open) => !open && setItemToCancel(null)}
        title={`Cancelar "${itemToCancel?.name ?? ""}"?`}
        confirmLabel="Cancelar Item"
        isPending={cancelItemMutation.isPending}
        onConfirm={(reason) =>
          itemToCancel && cancelItemMutation.mutate({ itemId: itemToCancel.id, reason })
        }
      />

      <ApplyDiscountDialog
        open={discountDialogOpen}
        onOpenChange={setDiscountDialogOpen}
        isPending={applyDiscountMutation.isPending}
        onConfirm={(data) => applyDiscountMutation.mutate(data)}
      />

      <SplitBillDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        items={items}
        subtotal={subtotal}
        discountAmount={discountAmount}
        serviceFee={serviceFee}
        total={total}
        isPending={splitCloseMutation.isPending}
        onConfirm={(payments) => splitCloseMutation.mutate(payments)}
      />

      <TransferItemsDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        items={items}
        currentTableId={order?.tableId ?? null}
        isPending={transferItemsMutation.isPending}
        onConfirm={(itemIds, targetOrderId) =>
          transferItemsMutation.mutate({ itemIds, targetOrderId })
        }
      />

      <MergeTablesDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        currentTableId={order?.tableId ?? null}
        currentTableNumber={order?.tableNumber ?? 0}
        isPending={mergeOrdersMutation.isPending}
        onConfirm={(targetOrderId) => mergeOrdersMutation.mutate(targetOrderId)}
      />
    </div>
  );
}
