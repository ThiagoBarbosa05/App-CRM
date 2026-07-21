import { useState } from "react";
import { cn, formatCurrency, parseBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Banknote,
  ClipboardList,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Receipt,
  Split,
  Trash2,
} from "lucide-react";
import type { RestaurantOrder, RestaurantOrderItem } from "@shared/schema";
import { formatPercent } from "@shared/restaurant-order-totals";

const PAYMENT_METHODS: { value: string; label: string; icon: typeof QrCode }[] = [
  { value: "pix", label: "Pix", icon: QrCode },
  { value: "cartao_credito", label: "Crédito", icon: CreditCard },
  { value: "cartao_debito", label: "Débito", icon: CreditCard },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
];

interface OrderSummaryCardProps {
  order: RestaurantOrder;
  items: RestaurantOrderItem[];
  subtotal: number;
  discountAmount: number;
  serviceFee: number;
  serviceFeePercent: number;
  total: number;
  hasDiscount: boolean;
  isGarcom: boolean;
  isPaymentPhase: boolean;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  onUpdateItemQuantity: (itemId: string, quantity: number) => void;
  onUpdateItemPrice: (itemId: string, unitPrice: string) => void;
  onCancelItem: (item: RestaurantOrderItem) => void;
  onRemoveDiscount: () => void;
  removeDiscountPending: boolean;
  onApplyDiscountClick: () => void;
  onRequestPayment: () => void;
  requestPaymentPending: boolean;
  onSplitClick: () => void;
  onCloseOrder: () => void;
  closeOrderPending: boolean;
}

export function OrderSummaryCard({
  order,
  items,
  subtotal,
  discountAmount,
  serviceFee,
  serviceFeePercent,
  total,
  hasDiscount,
  isGarcom,
  isPaymentPhase,
  paymentMethod,
  onPaymentMethodChange,
  onUpdateItemQuantity,
  onUpdateItemPrice,
  onCancelItem,
  onSplitClick,
  onCloseOrder,
  closeOrderPending,
  onRequestPayment,
  requestPaymentPending,
}: OrderSummaryCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden border-l bg-card">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            {isPaymentPhase ? "Pagamento" : "Comanda"}
          </span>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </Badge>
          )}
        </div>
        {order.clientName && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-3 w-3 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            {order.clientName}
          </p>
        )}
      </div>

      {/* Items list — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm">Nenhum item lançado</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Item</span>
              <span className="text-center w-20">Qtd.</span>
              <span className="text-right w-20">Valor unit.</span>
              <span className="w-8" />
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-4 py-2 hover:bg-muted/30"
              >
                {/* Name (+ optional note inline) */}
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  {item.notes && (
                    <span className="block truncate text-xs text-orange-600 dark:text-orange-400">
                      📝 {item.notes}
                    </span>
                  )}
                </div>

                {/* Quantity */}
                <div className="flex w-20 items-center justify-center gap-0.5 shrink-0">
                  {isPaymentPhase ? (
                    <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={item.quantity <= 1}
                        onClick={() => onUpdateItemQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onUpdateItemQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Unit price */}
                <div className="w-20 shrink-0 text-right">
                  {isGarcom || isPaymentPhase ? (
                    <span className="text-sm tabular-nums">{formatCurrency(item.unitPrice)}</span>
                  ) : (
                    <Input
                      className="h-7 w-20 text-right text-xs tabular-nums"
                      defaultValue={item.unitPrice}
                      onBlur={(e) => {
                        const parsed = parseBRL(e.target.value);
                        // Entrada ilegível volta ao preço atual em vez de
                        // gravar NaN ou um valor mil vezes menor.
                        if (parsed === null || parsed <= 0) {
                          e.target.value = item.unitPrice;
                          return;
                        }
                        const value = parsed.toFixed(2);
                        if (value !== item.unitPrice) {
                          onUpdateItemPrice(item.id, value);
                        }
                      }}
                    />
                  )}
                </div>

                {/* Remove */}
                <div className="w-8 shrink-0">
                  {!isPaymentPhase && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      onClick={() => onCancelItem(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals + actions — fixed at bottom */}
      <div className="shrink-0 border-t bg-card">
        {/* Totals */}
        <div className="space-y-1.5 px-4 py-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Desconto{order.discountReason ? ` (${order.discountReason})` : ""}</span>
              <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Taxa de serviço ({formatPercent(serviceFeePercent)})</span>
            <span className="tabular-nums">{formatCurrency(serviceFee)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-xl font-bold">
            <span>Total</span>
            <span className="tabular-nums text-orange-600 dark:text-orange-400">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Payment phase */}
        {isPaymentPhase ? (
          <div className="space-y-3 border-t px-4 pb-4 pt-3">
            <Label className="text-xs uppercase text-muted-foreground">Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => onPaymentMethodChange(method.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 p-2.5 text-sm font-medium transition-colors",
                    paymentMethod === method.value
                      ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                      : "border-border text-muted-foreground hover:border-orange-300 hover:text-foreground",
                  )}
                >
                  <method.icon className="h-4 w-4 shrink-0" />
                  {method.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="shrink-0"
                disabled={items.length === 0}
                onClick={onSplitClick}
              >
                <Split className="mr-1.5 h-4 w-4" />
                Dividir
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    disabled={items.length === 0 || !paymentMethod}
                  >
                    Fechar Comanda
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fechar comanda da Mesa {order.tableNumber}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Total de {formatCurrency(total)} · pagamento em{" "}
                      {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}. Esta ação
                      não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onCloseOrder} disabled={closeOrderPending}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4 pt-3 border-t">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
              size="lg"
              disabled={items.length === 0 || requestPaymentPending}
              onClick={onRequestPayment}
            >
              <Receipt className="mr-2 h-4 w-4" />
              {requestPaymentPending ? "Solicitando..." : "PEDIR A CONTA"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
