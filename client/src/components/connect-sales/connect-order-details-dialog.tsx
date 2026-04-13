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
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link2, Link2Off, Phone, Smartphone } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface ConnectOrderDialogData {
  saleCode: string | null;
  saleDate: string;
  totalValue: string;
  contactName: string | null;
  sellerName: string | null;
  appClientId: string | null;
  contactPhone?: string | null;
  contactCellphone?: string | null;
  connectItems: Array<{
    id: number;
    productCode: string | null;
    productName: string | null;
    quantity: string;
    unitValue: string;
  }>;
}

interface ConnectOrderDetailsDialogProps {
  order: ConnectOrderDialogData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr + "T12:00:00"), "dd/MM/yyyy", {
      locale: ptBR,
    });
  } catch {
    return dateStr;
  }
}

export function ConnectOrderDetailsDialog({
  order,
  open,
  onOpenChange,
}: ConnectOrderDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalhes da Venda Connect
            {order?.saleCode ? ` #${order.saleCode}` : ""}
          </DialogTitle>
        </DialogHeader>

        {order && (
          <div className="space-y-6">
            {/* Info Grid */}
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
                  Valor Total
                </p>
                <p className="text-sm font-semibold text-green-600">
                  {formatCurrency(parseFloat(order.totalValue || "0"))}
                </p>
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
            </div>

            <Separator />

            {/* Items Table */}
            <div>
              <h3 className="font-semibold mb-4">
                Itens do Pedido ({order.connectItems?.length || 0})
              </h3>
              {order.connectItems && order.connectItems.length > 0 ? (
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
                      {order.connectItems.map((item) => {
                        const quantity = parseFloat(item.quantity || "0");
                        const unitValue = parseFloat(item.unitValue || "0");
                        const total = quantity * unitValue;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">
                              {item.productCode || "—"}
                            </TableCell>
                            <TableCell>{item.productName || "—"}</TableCell>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
