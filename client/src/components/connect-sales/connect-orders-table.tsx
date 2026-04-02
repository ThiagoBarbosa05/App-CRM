import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { InboxIcon, ChevronLeft, ChevronRight, UserCheck, UserPlus, UserX } from "lucide-react";
import type { ConnectOrder } from "@/hooks/use-connect-orders";

interface ConnectOrdersTableProps {
  orders: ConnectOrder[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasMore: boolean;
  totalOrders?: number;
}

export function ConnectOrdersTable({
  orders,
  isLoading,
  page,
  onPageChange,
  hasMore,
  totalOrders = 0,
}: ConnectOrdersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <InboxIcon className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhum pedido encontrado</p>
        <p className="text-xs mt-1">Importe um CSV para visualizar as vendas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>{totalOrders} pedido(s) encontrado(s)</span>
        <span>
          Página {page} · {orders.length} exibidos
        </span>
      </div>

      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Data
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cliente
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cidade
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vendedor
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cliente App
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Arquivo
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                Valor
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className="hover:bg-slate-50 transition-colors"
              >
                <TableCell className="text-sm text-slate-700">
                  {order.saleDate
                    ? format(
                        typeof order.saleDate === "string"
                          ? parseISO(order.saleDate)
                          : order.saleDate,
                        "dd 'de' MMM, yyyy",
                        { locale: ptBR },
                      )
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="text-sm text-slate-800 truncate">
                    {order.contactName ?? (
                      <span className="text-slate-400 italic">Sem nome</span>
                    )}
                  </p>
                  {(order.contactCellphone || order.contactPhone) && (
                    <p className="text-xs text-slate-400">
                      {order.contactCellphone ?? order.contactPhone}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {order.contactCity ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {order.sellerNameRaw ?? (
                    <span className="text-slate-300">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {order.appClientStatus === "found" && (
                    <Badge className="gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                      <UserCheck className="h-3 w-3" />
                      Vinculado
                    </Badge>
                  )}
                  {order.appClientStatus === "created" && (
                    <Badge className="gap-1 bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50">
                      <UserPlus className="h-3 w-3" />
                      Criado
                    </Badge>
                  )}
                  {(!order.appClientStatus || order.appClientStatus === "not_found") && (
                    <Badge variant="outline" className="gap-1 text-slate-400">
                      <UserX className="h-3 w-3" />
                      Sem vínculo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-400 max-w-[140px] truncate">
                  {order.sourceFile ?? "—"}
                </TableCell>
                <TableCell className="text-right font-semibold text-slate-900">
                  {formatCurrency(parseFloat(order.totalValue))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <span className="text-sm text-slate-500 px-2">Página {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
          className="gap-1"
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
