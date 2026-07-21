import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface CancelledItem {
  itemId: string;
  itemName: string;
  unitPrice: string;
  quantity: number;
  orderNumber: number;
  tableNumber: number;
  orderStatus: string;
  cancelReason: string | null;
  cancelledById: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
}

export function cancelledItemValue(item: CancelledItem): number {
  return Number(item.unitPrice) * item.quantity;
}

interface CancelledItemsTableProps {
  items: CancelledItem[];
  /** Data completa no relatório; só a hora dentro de um turno. */
  showDate?: boolean;
  emptyMessage?: string;
}

export function CancelledItemsTable({
  items,
  showDate = false,
  emptyMessage = "Nenhum item cancelado",
}: CancelledItemsTableProps) {
  const formatWhen = (value: string) =>
    new Date(value).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      ...(showDate ? { day: "2-digit", month: "2-digit" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Cancelado por</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.itemId}>
              <TableCell className="font-medium">
                {item.quantity > 1 && (
                  <span className="text-muted-foreground">{item.quantity}× </span>
                )}
                {item.itemName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                Mesa {item.tableNumber} · #{item.orderNumber}
              </TableCell>
              <TableCell>{item.cancelledByName ?? "—"}</TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground">
                {item.cancelReason?.trim() || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.cancelledAt ? formatWhen(item.cancelledAt) : "—"}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(cancelledItemValue(item))}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface CancellationsByUserProps {
  byUser: {
    userId: string;
    userName: string;
    itemCount: number;
    total: string;
    sharePercent: number;
  }[];
}

/**
 * Ranking de quem cancela. É a leitura que importa no período: um total alto
 * distribuído entre todos é rotina do salão; concentrado numa pessoa, não.
 */
export function CancellationsByUser({ byUser }: CancellationsByUserProps) {
  if (byUser.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum cancelamento no período
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {byUser.map((u) => (
        <div key={u.userId} className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{u.userName}</span>
            <span className="tabular-nums">
              {formatCurrency(u.total)}
              <span className="ml-2 text-xs text-muted-foreground">
                {u.itemCount} item(ns) · {u.sharePercent}%
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${Math.min(u.sharePercent, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
