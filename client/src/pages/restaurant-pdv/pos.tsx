import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  ArrowRightLeft,
  Clock,
  Combine,
  Lock,
  LogOut,
  UserPlus,
  Users,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateOrderTotals } from "@shared/restaurant-order-totals";
import type {
  Product,
  RestaurantMenuItem,
  RestaurantOrderItem,
  RestaurantOrder,
  RestaurantPdvSettings,
} from "@shared/schema";
import { TableMapGrid } from "./table-map";
import { ReasonPromptDialog } from "@/components/restaurant-pdv/reason-prompt-dialog";
import { ApplyDiscountDialog } from "@/components/restaurant-pdv/apply-discount-dialog";
import { SplitBillDialog } from "@/components/restaurant-pdv/split-bill-dialog";
import { TransferItemsDialog } from "@/components/restaurant-pdv/transfer-items-dialog";
import { MergeTablesDialog } from "@/components/restaurant-pdv/merge-tables-dialog";
import { OrderReceiptPrint, printBillNow } from "@/components/restaurant-pdv/order-receipt-print";
import { OrderItemSelector } from "@/components/restaurant-pdv/order-item-selector";
import { OrderSummaryCard } from "@/components/restaurant-pdv/order-summary-card";
import { LinkClientDialog } from "@/components/restaurant-pdv/link-client-dialog";

export interface CartItem {
  id: string;
  name: string;
  unitPrice: string;
  quantity: number;
  menuItemId?: string | null;
  productId?: string | null;
  notes?: string;
}

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
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  // A URL é a fonte da verdade da comanda ativa: um F5 dentro da mesa volta
  // para a mesma mesa, e o "voltar" do navegador leva ao mapa.
  const search = useSearch();
  const activeOrderId = new URLSearchParams(search).get("orderId");

  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [itemToCancel, setItemToCancel] = useState<RestaurantOrderItem | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmittingCart, setIsSubmittingCart] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [linkClientOpen, setLinkClientOpen] = useState(false);

  const setActiveOrder = (id: string | null) => {
    navigate(id ? `/pdv-restaurante?orderId=${id}` : "/pdv-restaurante");
  };

  // Trocar de comanda zera o carrinho — inclusive quando a troca vem do
  // "voltar" do navegador, que não passa por setActiveOrder.
  useEffect(() => {
    setCart([]);
  }, [activeOrderId]);

  const { data: order, isLoading: isLoadingOrder } = useQuery<RestaurantOrderWithItems>({
    queryKey: ["/api/restaurant-pdv/orders", activeOrderId],
    enabled: !!activeOrderId,
    // Duas pessoas podem atender a mesma mesa; sem isto, os lançamentos de uma
    // só aparecem para a outra quando alguma mutation força a revalidação.
    refetchInterval: 15000,
  });

  const { data: pdvSettings } = useQuery<RestaurantPdvSettings>({
    queryKey: ["/api/restaurant-pdv/settings"],
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
    onSuccess: () => {
      invalidateOrder();
      // Imprime a pré-conta automaticamente ao pedir a conta
      if (order) {
        printBillNow(order, order.items ?? [], { settings: pdvSettings });
      }
    },
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
      // Uma requisição só: o backend grava os pagamentos e fecha na mesma
      // transação. Em duas etapas, um erro no fechamento deixava pagamentos
      // órfãos na comanda.
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/close`, {
        payments,
      });
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

  // Sair da mesa descarta o carrinho ainda não lançado — pedir confirmação
  // evita perder uma seleção grande com um clique de distração.
  const handleLeaveToMap = () => {
    if (cart.length > 0) {
      setConfirmLeaveOpen(true);
      return;
    }
    setActiveOrder(null);
  };

  const handleAddMenuItem = (menuItem: RestaurantMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          id: `menu-${menuItem.id}`,
          name: menuItem.name,
          unitPrice: menuItem.price,
          quantity: 1,
          menuItemId: menuItem.id,
          productId: null,
        },
      ];
    });
  };

  const handleAddProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          id: `product-${product.id}`,
          name: product.name,
          unitPrice: product.negotiatedPrice,
          quantity: 1,
          menuItemId: null,
          productId: product.id,
        },
      ];
    });
  };

  const handleAddCustomItem = (name: string, unitPrice: string) => {
    setCart((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random()}`,
        name,
        unitPrice,
        quantity: 1,
        menuItemId: null,
        productId: null,
      },
    ]);
  };

  const handleCartIncrement = (id: string) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)),
    );
  };

  const handleCartDecrement = (id: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i,
      ),
    );
  };

  const handleCartRemove = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCartNoteChange = (id: string, notes: string) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, notes } : i)),
    );
  };

  const handleSubmitCart = async () => {
    if (cart.length === 0 || isSubmittingCart) return;
    setIsSubmittingCart(true);

    // Snapshot items at submit time — items added to cart after this point
    // will not be touched by this run (no race-condition data loss).
    const itemsToSubmit = [...cart];
    let anySuccess = false;

    for (const item of itemsToSubmit) {
      try {
        await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/items`, {
          menuItemId: item.menuItemId,
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          notes: item.notes || null,
        });
        // Remove only the successfully sent item — failed ones stay for retry.
        setCart((prev) => prev.filter((i) => i.id !== item.id));
        anySuccess = true;
      } catch (err) {
        toast({
          title: "Erro ao adicionar item",
          description: (err as Error).message,
          variant: "destructive",
        });
      }
    }

    // Single invalidation after the full batch — avoids per-item refetch churn.
    if (anySuccess) {
      invalidateOrder();
      toast({ title: "Pedido lançado", description: "Itens adicionados à comanda." });
    }

    setIsSubmittingCart(false);
  };

  const items = order?.items ?? [];
  const { subtotal, discountAmount, serviceFee, serviceFeePercent, total, hasDiscount } =
    calculateOrderTotals({
      items,
      serviceFeePercent: order?.serviceFeePercent,
      discountAmount: order?.discountAmount,
      discountPercent: order?.discountPercent,
    });

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );

  const isGarcom = user?.role === "garcom";
  // Divisor de fase: o backend congela a comanda a partir daqui.
  const isPaymentPhase = !!order?.paymentRequestedAt;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        {!isGarcom && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-muted-foreground"
              onClick={() => navigate("/pdv-restaurante")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Menu PDV</span>
            </Button>
            <Separator orientation="vertical" className="h-5 shrink-0" />
          </>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">PDV Restaurante</span>
        </div>
        {user?.name && (
          <span className={`text-xs text-muted-foreground ${isGarcom ? "" : "ml-auto"}`}>
            {isGarcom ? "" : "Garçom: "}{user.name}
          </span>
        )}
        {isGarcom && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 shrink-0 px-2 text-muted-foreground"
            onClick={() => logout()}
          >
            <LogOut className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        )}
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {!activeOrderId ? (
          <div className="flex-1 overflow-auto">
            <TableMapGrid onOrderOpened={(id) => setActiveOrder(id)} />
          </div>
        ) : isLoadingOrder || !order ? (
          <div className="p-6 text-center text-muted-foreground">Carregando comanda...</div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* ── Mesa sub-header ─────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-muted-foreground"
                onClick={handleLeaveToMap}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mesas</span>
              </Button>
              <div className="h-4 border-l shrink-0" />
              <span className="font-bold text-sm shrink-0">Mesa {order.tableNumber}</span>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-[10px] uppercase",
                  STATUS_BADGE_CLASS[
                    order.paymentRequestedAt ? "aguardando_pagamento" : order.status
                  ],
                )}
              >
                {order.paymentRequestedAt ? "Aguardando pagamento" : order.status}
              </Badge>
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Users className="h-3 w-3" />
                {order.peopleCount}p
              </span>
              <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {formatDistanceToNowStrict(new Date(order.openedAt), { locale: ptBR })}
              </span>
              <Button
                size="sm"
                variant={order.clientName ? "secondary" : "outline"}
                className="h-7 max-w-[140px] truncate px-2 text-xs shrink-0"
                onClick={() => setLinkClientOpen(true)}
                title={order.clientName ? `Cliente: ${order.clientName}` : "Vincular cliente"}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0 sm:mr-1" />
                <span className="hidden sm:inline truncate">
                  {order.clientName ?? "Vincular cliente"}
                </span>
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setTransferDialogOpen(true)}
                  disabled={items.length === 0 || isPaymentPhase}
                  title="Transferir itens"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Transferir</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMergeDialogOpen(true)}
                  disabled={isPaymentPhase}
                  title="Juntar mesas"
                >
                  <Combine className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Juntar</span>
                </Button>
                <OrderReceiptPrint orderId={order.id} label="" />
              </div>
            </div>

            {/* ── Two-column POS layout ──────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: item selector */}
              <div className="flex flex-1 flex-col overflow-hidden border-r">
                {isPaymentPhase ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <Lock className="h-12 w-12 text-muted-foreground/30" />
                    <div className="space-y-1">
                      <p className="font-semibold">Conta solicitada</p>
                      <p className="text-sm text-muted-foreground">
                        A comanda está bloqueada para novos lançamentos.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => cancelPaymentRequestMutation.mutate()}
                      disabled={cancelPaymentRequestMutation.isPending}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      {cancelPaymentRequestMutation.isPending
                        ? "Cancelando..."
                        : "Cancelar pedido de conta"}
                    </Button>
                  </div>
                ) : (
                  <OrderItemSelector
                    blingConnectionId={order.blingConnectionId}
                    cart={cart}
                    onAddMenuItem={handleAddMenuItem}
                    onAddProduct={handleAddProduct}
                    onAddCustomItem={handleAddCustomItem}
                    onCartIncrement={handleCartIncrement}
                    onCartDecrement={handleCartDecrement}
                    onCartRemove={handleCartRemove}
                    onCartNoteChange={handleCartNoteChange}
                    onSubmitCart={handleSubmitCart}
                    submitPending={isSubmittingCart}
                    cartSubtotal={cartSubtotal}
                  />
                )}
              </div>

              {/* Right: order summary */}
              <div className="flex w-[620px] shrink-0 flex-col overflow-hidden xl:w-[720px]">
                <OrderSummaryCard
                  order={order}
                  items={items}
                  subtotal={subtotal}
                  discountAmount={discountAmount}
                  serviceFee={serviceFee}
                  serviceFeePercent={serviceFeePercent}
                  total={total}
                  hasDiscount={hasDiscount}
                  isGarcom={isGarcom}
                  isPaymentPhase={isPaymentPhase}
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
                  onRequestPayment={() => requestPaymentMutation.mutate()}
                  requestPaymentPending={requestPaymentMutation.isPending}
                  onSplitClick={() => setSplitDialogOpen(true)}
                  onCloseOrder={() => closeOrderMutation.mutate()}
                  closeOrderPending={closeOrderMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o pedido não lançado?</AlertDialogTitle>
            <AlertDialogDescription>
              {cart.length} item(ns) foram selecionados mas ainda não foram lançados na
              comanda. Sair do mapa de mesas descarta a seleção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar na mesa</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false);
                setActiveOrder(null);
              }}
            >
              Descartar e sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        peopleCount={order?.peopleCount ?? 0}
        isPending={splitCloseMutation.isPending}
        onConfirm={(payments) => splitCloseMutation.mutate(payments)}
      />

      <TransferItemsDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        items={items}
        currentOrderId={order?.id ?? null}
        isPending={transferItemsMutation.isPending}
        onConfirm={(itemIds, targetOrderId) =>
          transferItemsMutation.mutate({ itemIds, targetOrderId })
        }
      />

      <MergeTablesDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        currentOrderId={order?.id ?? null}
        currentTableNumber={order?.tableNumber ?? 0}
        isPending={mergeOrdersMutation.isPending}
        onConfirm={(targetOrderId) => mergeOrdersMutation.mutate(targetOrderId)}
      />

      {order && (
        <LinkClientDialog
          open={linkClientOpen}
          onOpenChange={setLinkClientOpen}
          orderId={order.id}
          currentClientName={order.clientName}
          onLinked={invalidateOrder}
        />
      )}
    </div>
  );
}
