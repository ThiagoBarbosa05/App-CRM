import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Banknote,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Minus,
  Percent,
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
  { value: "cartao_credito", label: "Cartão de Crédito", icon: CreditCard },
  { value: "cartao_debito", label: "Cartão de Débito", icon: CreditCard },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
];

function itemSourceLabel(item: RestaurantOrderItem): string {
  if (item.menuItemId) return "Cardápio";
  if (item.productId) return "Produto";
  return "Avulso";
}

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
  /**
   * Conta já solicitada. O backend congela a comanda neste ponto
   * (`assertOrderEditable` → 409 PAYMENT_REQUESTED), então a tela troca de
   * lançamento para pagamento em vez de oferecer ações que vão falhar.
   */
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
  onRemoveDiscount,
  removeDiscountPending,
  onApplyDiscountClick,
  onRequestPayment,
  requestPaymentPending,
  onSplitClick,
  onCloseOrder,
  closeOrderPending,
}: OrderSummaryCardProps) {
  // Na fase de pagamento o que importa é o total; a lista de itens vira consulta.
  const [itemsExpanded, setItemsExpanded] = useState(!isPaymentPhase);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isPaymentPhase ? "Pagamento" : "Comanda"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <button
            type="button"
            className="flex w-full items-center justify-between py-1 text-sm font-semibold text-foreground"
            onClick={() => setItemsExpanded((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Comanda lançada
              {items.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {items.length}
                </Badge>
              )}
            </span>
            {itemsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {itemsExpanded && (
            <div className="mt-2">
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
                    <TableRow key={item.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span>{item.name}</span>
                          {item.notes && (
                            <span className="text-xs text-orange-600 dark:text-orange-400">
                              📝 {item.notes}
                            </span>
                          )}
                          <Badge variant="outline" className="w-fit text-[10px] font-normal">
                            {itemSourceLabel(item)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isPaymentPhase ? (
                          <span className="tabular-nums">{item.quantity}</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              disabled={item.quantity <= 1}
                              onClick={() => onUpdateItemQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => onUpdateItemQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isGarcom || isPaymentPhase ? (
                          // Alterar preço é privilégio de gestor — o backend
                          // também recusa (403), isto só evita a tentativa.
                          <span className="tabular-nums">
                            {formatCurrency(item.unitPrice)}
                          </span>
                        ) : (
                          <Input
                            className="h-8 w-24"
                            defaultValue={item.unitPrice}
                            onBlur={(e) => {
                              const value = e.target.value.replace(",", ".");
                              if (value !== item.unitPrice && Number(value) > 0) {
                                onUpdateItemPrice(item.id, value);
                              }
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {!isPaymentPhase && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => onCancelItem(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
                          <span>Nenhum item lançado</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Totais ficam fora do colapso: recolher a lista não pode esconder o
            valor a pagar nem a ação primária. */}
        <div className="space-y-2 border-t pt-4">
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
            <span className="text-muted-foreground">
              Taxa de serviço ({formatPercent(serviceFeePercent)})
            </span>
            <span>{formatCurrency(serviceFee)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {/* Desconto passa por assertOrderEditable — só antes de pedir a conta. */}
          {!isGarcom && !isPaymentPhase && (
            <div className="pt-1">
              {hasDiscount ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={onRemoveDiscount}
                  disabled={removeDiscountPending}
                >
                  Remover desconto
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={onApplyDiscountClick}
                  disabled={items.length === 0}
                >
                  <Percent className="mr-1 h-3.5 w-3.5" />
                  Aplicar desconto
                </Button>
              )}
            </div>
          )}
        </div>

        {isPaymentPhase ? (
          <>
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs uppercase text-muted-foreground">
                Forma de pagamento
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => onPaymentMethodChange(method.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 p-2.5 text-sm font-medium transition-colors",
                      paymentMethod === method.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <method.icon className="h-4 w-4 shrink-0" />
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="shrink-0"
                disabled={items.length === 0}
                onClick={onSplitClick}
              >
                <Split className="mr-1.5 h-4 w-4" />
                Dividir Conta
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="flex-1" disabled={items.length === 0 || !paymentMethod}>
                    Fechar Comanda
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Fechar comanda da Mesa {order.tableNumber}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Total de {formatCurrency(total)} (com taxa de serviço de{" "}
                      {formatPercent(serviceFeePercent)}), pagamento em{" "}
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
          </>
        ) : (
          <Button
            className="w-full font-semibold"
            size="lg"
            disabled={items.length === 0 || requestPaymentPending}
            onClick={onRequestPayment}
          >
            <Receipt className="mr-2 h-4 w-4" />
            {requestPaymentPending ? "Solicitando..." : "PEDIR A CONTA"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
