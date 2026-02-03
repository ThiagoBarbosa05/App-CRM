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
import { useBlingOrderById } from "@/hooks/use-bling-orders";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";

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
    const date = new Date(dateStr);
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
                                parseFloat(installment.value || "0")
                              )}
                            </TableCell>
                            <TableCell>{installment.obs || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
