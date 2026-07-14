import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRightLeft,
  Combine,
  Minus,
  Percent,
  Plus,
  Receipt,
  Split,
  Trash2,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import type { RestaurantMenuItem, RestaurantOrderItem, RestaurantOrder } from "@shared/schema";
import { TableMapGrid } from "./table-map";
import { ReasonPromptDialog } from "@/components/restaurant-pdv/reason-prompt-dialog";
import { ApplyDiscountDialog } from "@/components/restaurant-pdv/apply-discount-dialog";
import { SplitBillDialog } from "@/components/restaurant-pdv/split-bill-dialog";
import { TransferItemsDialog } from "@/components/restaurant-pdv/transfer-items-dialog";
import { MergeTablesDialog } from "@/components/restaurant-pdv/merge-tables-dialog";
import { OrderReceiptPrint } from "@/components/restaurant-pdv/order-receipt-print";

interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
];

const ACTIVE_ORDER_KEY = "restaurant-pdv-active-order-id";

export default function RestaurantPos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ORDER_KEY),
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [itemToCancel, setItemToCancel] = useState<RestaurantOrderItem | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const setActiveOrder = (id: string | null) => {
    setActiveOrderId(id);
    if (id) localStorage.setItem(ACTIVE_ORDER_KEY, id);
    else localStorage.removeItem(ACTIVE_ORDER_KEY);
  };

  const { data: menuItems = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items"],
  });

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

  const handleAddCustomItem = () => {
    const price = customPrice.replace(",", ".");
    if (!customName.trim() || !price || Number(price) <= 0) return;
    addItemMutation.mutate({
      menuItemId: null,
      name: customName.trim(),
      unitPrice: price,
      quantity: 1,
    });
    setCustomName("");
    setCustomPrice("");
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
          <div className="mx-auto max-w-5xl space-y-6 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground"
                    onClick={() => setActiveOrder(null)}
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Mapa de mesas
                  </Button>
                </div>
                <h1 className="text-xl font-bold">Mesa {order.tableNumber}</h1>
                <p className="text-sm text-muted-foreground">
                  {order.peopleCount} pessoa(s)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={order.paymentRequestedAt ? "secondary" : "outline"} className="uppercase">
                  {order.paymentRequestedAt ? "Aguardando pagamento" : order.status}
                </Badge>
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

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cardápio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {menuItems.map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="h-auto flex-col items-start p-3 text-left"
                        onClick={() => handleAddMenuItem(item)}
                        disabled={addItemMutation.isPending || updateItemMutation.isPending}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(item.price)}
                        </span>
                      </Button>
                    ))}
                    {menuItems.length === 0 && (
                      <p className="col-span-2 text-sm text-muted-foreground">
                        Nenhum item cadastrado no cardápio.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t pt-4">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Item avulso
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                      <Input
                        placeholder="Valor"
                        className="w-28"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                      />
                      <Button variant="secondary" onClick={handleAddCustomItem}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comanda</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qtd.</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                disabled={item.quantity <= 1}
                                onClick={() =>
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    data: { quantity: item.quantity - 1 },
                                  })
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center">{item.quantity}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() =>
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    data: { quantity: item.quantity + 1 },
                                  })
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-24"
                              defaultValue={item.unitPrice}
                              onBlur={(e) => {
                                const value = e.target.value.replace(",", ".");
                                if (value !== item.unitPrice && Number(value) > 0) {
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    data: { unitPrice: value },
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => setItemToCancel(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhum item adicionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div className="mt-4 space-y-2 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {hasDiscount && (
                      <div className="flex justify-between text-sm text-emerald-600">
                        <span>
                          Desconto
                          {order.discountReason ? ` (${order.discountReason})` : ""}
                        </span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de serviço (10%)</span>
                      <span>{formatCurrency(serviceFee)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    {!isGarcom && (
                      <div className="pt-1">
                        {hasDiscount ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => removeDiscountMutation.mutate()}
                            disabled={removeDiscountMutation.isPending}
                          >
                            Remover desconto
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => setDiscountDialogOpen(true)}
                            disabled={items.length === 0}
                          >
                            <Percent className="mr-1 h-3.5 w-3.5" />
                            Aplicar desconto
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t pt-4">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Forma de pagamento
                    </Label>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                      {PAYMENT_METHODS.map((method) => (
                        <div key={method.value} className="flex items-center gap-2">
                          <RadioGroupItem value={method.value} id={method.value} />
                          <Label htmlFor={method.value} className="font-normal">
                            {method.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="shrink-0"
                      disabled={items.length === 0}
                      onClick={() => setSplitDialogOpen(true)}
                    >
                      <Split className="mr-1.5 h-4 w-4" />
                      Dividir Conta
                    </Button>

                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="flex-1"
                        disabled={items.length === 0 || !paymentMethod}
                      >
                        Fechar Comanda
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Fechar comanda da Mesa {order.tableNumber}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Total de {formatCurrency(total)} (com taxa de serviço de 10%),
                          pagamento em{" "}
                          {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}. Esta
                          ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => closeOrderMutation.mutate()}>
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
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
