import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { BlingOrder } from "@/hooks/use-bling-orders";
import {
  EyeIcon,
  InboxIcon,
  History,
  User,
  CreditCard,
  Hash,
  Link2,
  Link2Off,
  Gift,
} from "lucide-react";
import { useState } from "react";
import { OrderDetailsDialog } from "./order-details-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ptBR } from "date-fns/locale";

interface OrdersTableProps {
  orders: BlingOrder[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasMore: boolean;
  totalOrders?: number;
}

function getSituationLabel(value: string | null | undefined) {
  switch (String(value ?? "").trim()) {
    case "0":
      return "Em Aberto";
    case "1":
      return "Concluído";
    case "2":
      return "Cancelado";
    default:
      return value || undefined;
  }
}

function getStatusStyles(statusName: string | undefined) {
  if (!statusName)
    return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };

  const status = statusName.toLowerCase();

  if (status.includes("cancelado"))
    return {
      bg: "bg-rose-50 dark:bg-rose-900/20",
      text: "text-rose-600 dark:text-rose-400",
      dot: "bg-rose-500",
    };

  if (
    status.includes("atendido") ||
    status.includes("verificado") ||
    status.includes("concluído")
  )
    return {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    };

  if (
    status.includes("pendente") ||
    status.includes("em aberto") ||
    status.includes("processamento")
  )
    return {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    };

  return {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  };
}

function StatusBadge({ name }: { name: string }) {
  const styles = getStatusStyles(name);

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${styles.bg} ${styles.text} px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider`}
    >
      <div className={`h-1.5 w-1.5 rounded-full ${styles.dot} animate-pulse`} />
      {name}
    </div>
  );
}

export function OrdersTable({
  orders,
  isLoading,
  page,
  onPageChange,
  hasMore,
  totalOrders = 0,
}: OrdersTableProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleViewDetails = (blingOrderId: string) => {
    setSelectedOrderId(blingOrderId);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Carregando pedidos...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px] lg:min-w-full">
            <TableHeader>
              <TableRow className="border-b border-slate-50 dark:border-slate-800 hover:bg-transparent">
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3" /> Nº Pedido
                  </div>
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center gap-2">
                    <History className="h-3 w-3" /> Data Venda
                  </div>
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" /> Cliente / Vendedor
                  </div>
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3 w-3" /> App
                  </div>
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  Situação
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Gift className="h-3 w-3" /> Cashback
                  </div>
                </TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center justify-end gap-2">
                    <CreditCard className="h-3 w-3" /> Valor Total
                  </div>
                </TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-72 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-dashed border-slate-200 dark:border-slate-700">
                          <InboxIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Vazio por aqui
                          </p>
                          <p className="text-xs font-medium text-slate-500">
                            Não encontramos pedidos com os filtros aplicados.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order, index) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all cursor-default"
                    >
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg inline-block font-mono text-[11px] font-black text-slate-600 dark:text-slate-300">
                            #{order.orderNumber}
                          </div>
                          {order.lastEventAction && (
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md w-fit",
                                order.lastEventAction === "created"
                                  ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400"
                                  : order.lastEventAction === "updated"
                                    ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400"
                                    : "bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400",
                              )}
                            >
                              {order.lastEventAction}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-500">
                        {format(
                          parseISO(order.saleDate + "T12:00:00"),
                          "dd 'de' MMM, yyyy",
                          { locale: ptBR },
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                            {order.contactName || "Anônimo"}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">
                            Rep: {order.sellerName || "Não vinculado"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.contactType === "F" ? (
                          order.appClientId ? (
                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                              <Link2 className="h-3 w-3" /> Vinculado
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                              <Link2Off className="h-3 w-3" /> Sem vínculo
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.cashbackAmount &&
                        parseFloat(order.cashbackAmount) > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                              {formatCurrency(parseFloat(order.cashbackAmount))}
                            </span>
                            {order.cashbackRate && (
                              <span className="text-[10px] font-bold text-slate-400">
                                {parseFloat(order.cashbackRate).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          name={
                            getSituationLabel(order.situationValue) ||
                            getSituationLabel(order.situationId) ||
                            order.situationName ||
                            "DEFININDO"
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-base font-black text-slate-900 dark:text-white">
                          {formatCurrency(parseFloat(order.totalValue))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 w-9 p-0 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:scale-110 transition-all rounded-xl border-none"
                            onClick={() =>
                              handleViewDetails(order.blingOrderId)
                            }
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Exibindo{" "}
              <span className="text-slate-900 dark:text-white">
                {orders.length}
              </span>
              {totalOrders > 0 && (
                <span>
                  {" "}
                  de <span className="text-blue-500">{totalOrders}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <Pagination>
          <PaginationContent className="gap-2">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={cn(
                  "h-10 px-4 rounded-xl font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all",
                  page === 1
                    ? "opacity-30 pointer-events-none"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm",
                )}
              />
            </PaginationItem>

            <div className="bg-blue-600 text-white h-10 w-10 flex items-center justify-center rounded-xl font-black shadow-lg shadow-blue-500/30">
              {page}
            </div>

            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(page + 1)}
                className={cn(
                  "h-10 px-4 rounded-xl font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all",
                  !hasMore
                    ? "opacity-30 pointer-events-none"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm",
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <OrderDetailsDialog
        blingOrderId={selectedOrderId}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedOrderId(null);
        }}
      />
    </div>
  );
}
