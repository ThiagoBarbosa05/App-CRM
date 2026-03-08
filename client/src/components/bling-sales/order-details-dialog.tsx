import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBlingOrderById, useOrderCashback } from "@/hooks/use-bling-orders";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Link2,
  Link2Off,
  Phone,
  Smartphone,
  Gift,
} from "lucide-react";

interface OrderDetailsDialogProps {
  blingOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    // Adiciona horário do meio-dia para evitar problemas de timezone
    const date = parseISO(dateStr + "T12:00:00");
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function OrderDetailsDialog({
  blingOrderId,
  open,
  onOpenChange,
}: OrderDetailsDialogProps) {
  const { data: order, isLoading } = useBlingOrderById(blingOrderId);
  const { data: cashbacks, isLoading: isCashbackLoading } = useOrderCashback(
    open ? blingOrderId : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </span>
            ) : (
              `Detalhes do Pedido #${order?.orderNumber || ""}`
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Order Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Cliente
                </p>
                <p className="text-sm">{order.contactName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Vendedor
                </p>
                <p className="text-sm">{order.sellerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Data da Venda
                </p>
                <p className="text-sm">{formatDate(order.saleDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Situação
                </p>
                <Badge variant="outline">
                  {order.situationName || order.situationId || "N/A"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Loja
                </p>
                <p className="text-sm">{order.storeId || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Valor Total
                </p>
                <p className="text-sm font-semibold text-green-600">
                  {formatCurrency(parseFloat(order.totalValue || "0"))}
                </p>
              </div>
              {/* Dados de contato e vínculo com app */}
              {order.contactType === "F" && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone
                    </p>
                    <p className="text-sm">{order.contactPhone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> Celular
                    </p>
                    <p className="text-sm">{order.contactCellphone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Vínculo no App
                    </p>
                    {order.appClientId ? (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full text-xs font-semibold mt-1">
                        <Link2 className="h-3.5 w-3.5" /> Cliente vinculado
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs font-semibold mt-1">
                        <Link2Off className="h-3.5 w-3.5" /> Não encontrado
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Items Table */}
            <div>
              <h3 className="font-semibold mb-4">
                Itens do Pedido ({order.items?.length || 0})
              </h3>
              {order.items && order.items.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right w-[80px]">
                          Qtd
                        </TableHead>
                        <TableHead className="text-right w-[120px]">
                          Valor Unit.
                        </TableHead>
                        <TableHead className="text-right w-[120px]">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item) => {
                        const quantity = parseFloat(item.quantity || "0");
                        const unitValue = parseFloat(item.value || "0");
                        const total = quantity * unitValue;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">
                              {item.productCode || "-"}
                            </TableCell>
                            <TableCell>{item.description || "-"}</TableCell>
                            <TableCell className="text-right">
                              {quantity.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(unitValue)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum item encontrado.
                </p>
              )}
            </div>

            {/* Installments if available */}
            {order.installments && order.installments.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-4">
                    Parcelas ({order.installments.length})
                  </h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.installments.map((installment) => (
                          <TableRow key={installment.id}>
                            <TableCell>
                              {formatDate(installment.dueDate)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                parseFloat(installment.value || "0"),
                              )}
                            </TableCell>
                            <TableCell>
                              {installment.observations || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* Cashback section (only for PF with app client) */}
            {order.contactType === "F" && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-amber-500" /> Cashback
                  </h3>
                  {isCashbackLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </div>
                  ) : cashbacks && cashbacks.length > 0 ? (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Valor Cashback</TableHead>
                            <TableHead>Taxa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Validade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cashbacks.map((cb) => (
                            <TableRow key={cb.id}>
                              <TableCell className="font-semibold text-amber-600">
                                {formatCurrency(
                                  parseFloat(cb.cashbackAmount || "0"),
                                )}
                              </TableCell>
                              <TableCell>
                                {parseFloat(cb.cashbackRate).toFixed(1)}%
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    cb.status === "approved"
                                      ? "default"
                                      : "outline"
                                  }
                                  className={
                                    cb.status === "pending"
                                      ? "border-amber-300 text-amber-600"
                                      : ""
                                  }
                                >
                                  {cb.status === "pending" && "Pendente"}
                                  {cb.status === "approved" && "Aprovado"}
                                  {cb.status === "paid" && "Pago"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {cb.expiresAt
                                  ? formatDate(cb.expiresAt.split("T")[0])
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {order.appClientId
                        ? "Nenhuma transação de cashback registrada para este pedido."
                        : "Cliente não vinculado ao app. Cashback não gerado."}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Pedido não encontrado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
