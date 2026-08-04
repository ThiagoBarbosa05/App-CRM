import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { extractApiMessage } from "@/lib/api-error";
import { getPdvCurrentUnitId } from "@/lib/pdv-unit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type {
  RestaurantOrder,
  RestaurantOrderItem,
  RestaurantOrderPayment,
} from "@shared/schema";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  outros: "Outros",
};

type OrderWithItems = RestaurantOrder & { items: RestaurantOrderItem[] };

function formatDateTime(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDuration(openedAt: string | Date | null, closedAt: string | Date | null): string | null {
  if (!openedAt || !closedAt) return null;
  const minutes = Math.round(
    (new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60_000,
  );
  if (minutes < 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/**
 * Detalhe de uma comanda em painel lateral — itens, pagamentos, taxas e
 * descontos — sem tirar o gestor da página em que está (relatórios ou
 * histórico). A comanda completa continua em /pdv-restaurante/comanda/:id.
 */
export function OrderDetailSheet({
  orderId,
  onClose,
}: {
  /** `null` fecha o painel. */
  orderId: string | null;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const unitId = getPdvCurrentUnitId();

  const orderQuery = useQuery<OrderWithItems>({
    queryKey: ["/api/restaurant-pdv/orders", orderId, unitId],
    enabled: orderId !== null,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/restaurant-pdv/orders/${orderId}`);
      return (await res.json()) as OrderWithItems;
    },
  });

  const paymentsQuery = useQuery<RestaurantOrderPayment[]>({
    queryKey: ["/api/restaurant-pdv/orders", orderId, "payments", unitId],
    enabled: orderId !== null,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/orders/${orderId}/payments`,
      );
      return (await res.json()) as RestaurantOrderPayment[];
    },
  });

  const order = orderQuery.data;
  const duration = order ? formatDuration(order.openedAt, order.closedAt) : null;

  return (
    <Sheet open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {orderQuery.isLoading && (
          <div className="space-y-3 py-8">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {orderQuery.isError && (
          <div className="space-y-3 py-8">
            <p className="font-medium text-destructive">Não foi possível carregar a comanda</p>
            <p className="text-sm text-muted-foreground">
              {extractApiMessage(orderQuery.error)}
            </p>
            <Button size="sm" variant="outline" onClick={() => void orderQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {order && (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Comanda #{order.orderNumber}
                <Badge variant={order.status === "fechada" ? "default" : "secondary"}>
                  {order.status}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Mesa {order.tableNumber}
                {order.peopleCount ? ` · ${order.peopleCount} pessoa(s)` : ""}
                {order.clientName ? ` · ${order.clientName}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Aberta em</span>
              <span className="text-right tabular-nums">{formatDateTime(order.openedAt)}</span>
              <span className="text-muted-foreground">Fechada em</span>
              <span className="text-right tabular-nums">{formatDateTime(order.closedAt)}</span>
              {duration && (
                <>
                  <span className="text-muted-foreground">Permanência</span>
                  <span className="text-right tabular-nums">{duration}</span>
                </>
              )}
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Itens ({order.items.length})
              </p>
              {order.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item ativo</p>
              ) : (
                <div className="space-y-1.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {item.quantity}× {item.name}
                        {item.notes && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.notes}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCurrency(Number(item.unitPrice) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(order.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Taxa de serviço ({order.serviceFeePercent ?? 0}%)
                </span>
                <span className="tabular-nums">{formatCurrency(order.serviceFeeAmount ?? 0)}</span>
              </div>
              {order.discountAmount && Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>
                    Desconto{order.discountReason ? ` (${order.discountReason})` : ""}
                  </span>
                  <span className="tabular-nums">
                    −{formatCurrency(order.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.total ?? 0)}</span>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Pagamentos
              </p>
              {paymentsQuery.isLoading && <Skeleton className="h-10 w-full" />}
              {paymentsQuery.isError && (
                <p className="text-sm text-muted-foreground">
                  {extractApiMessage(paymentsQuery.error)}
                </p>
              )}
              {paymentsQuery.data &&
                (paymentsQuery.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                ) : (
                  <div className="space-y-1.5">
                    {paymentsQuery.data.map((p) => (
                      <div key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          {p.payerLabel && (
                            <span className="text-muted-foreground"> · {p.payerLabel}</span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/pdv-restaurante/comanda/${order.id}`)}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Abrir comanda completa
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
