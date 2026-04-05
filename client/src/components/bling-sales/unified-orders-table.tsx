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
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UnifiedOrder } from "@/hooks/use-unified-orders";
import {
  EyeIcon,
  InboxIcon,
  History,
  User,
  CreditCard,
  Hash,
  Link2,
  Link2Off,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { OrderDetailsDialog } from "@/components/bling-sales/order-details-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface UnifiedOrdersTableProps {
  orders: UnifiedOrder[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasMore: boolean;
  totalOrders?: number;
}

function SourceBadge({ source }: { source: "bling" | "connect" }) {
  if (source === "bling") {
    return (
      <span
        title="Origem: Bling ERP"
        className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-green-100 dark:bg-green-900/40 text-[8px] font-black text-green-600 dark:text-green-400 leading-none select-none"
      >
        B
      </span>
    );
  }
  return (
    <span
      title="Origem: Connect"
      className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-violet-100 dark:bg-violet-900/40 text-[8px] font-black text-violet-600 dark:text-violet-400 leading-none select-none"
    >
      C
    </span>
  );
}

function AppLinkBadge({ order }: { order: UnifiedOrder }) {
  if (order.appClientId) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
        <Link2 className="h-3 w-3" /> Vinculado
      </div>
    );
  }
  // Connect orders are always type F; bling orders check contactType
  const isPF = order.source === "connect" || order.contactType === "F";
  if (!isPF) {
    return (
      <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
      <Link2Off className="h-3 w-3" /> Sem vínculo
    </div>
  );
}

export function UnifiedOrdersTable({
  orders,
  isLoading,
  page,
  onPageChange,
  hasMore,
  totalOrders = 0,
}: UnifiedOrdersTableProps) {
  const [, navigate] = useLocation();
  const [selectedBlingOrderId, setSelectedBlingOrderId] = useState<
    string | null
  >(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleViewBlingDetails = (blingOrderId: string) => {
    setSelectedBlingOrderId(blingOrderId);
    setIsDetailsOpen(true);
  };

  const handleOpenClientPurchases = (appClientId: string | null) => {
    if (!appClientId) return;
    navigate(`/clientes/${appClientId}?tab=compras`);
  };

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px] lg:min-w-full">
            <TableHeader>
              <TableRow className="border-b border-slate-50 dark:border-slate-800 hover:bg-transparent">
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto w-8"></TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3" /> Ref. / Situação
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
                <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-4 h-auto">
                  <div className="flex items-center justify-end gap-2">
                    <CreditCard className="h-3 w-3" /> Valor Total
                  </div>
                </TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-72 text-center">
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
                      key={`${order.source}-${order.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all cursor-default"
                    >
                      {/* Source icon */}
                      <TableCell className="py-4 pl-5 pr-2">
                        <SourceBadge source={order.source} />
                      </TableCell>

                      {/* Ref / Situation */}
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          {order.orderNumber ? (
                            <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg inline-block font-mono text-[11px] font-black text-slate-600 dark:text-slate-300">
                              #{order.orderNumber}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 italic">
                              CSV Import
                            </span>
                          )}
                          {order.situationValue && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                              {order.situationValue}
                            </span>
                          )}
                          {order.appClientStatus && !order.orderNumber && (
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md w-fit",
                                order.appClientStatus === "found"
                                  ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400"
                                  : order.appClientStatus === "created"
                                    ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400"
                                    : "bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
                              )}
                            >
                              {order.appClientStatus === "found"
                                ? "encontrado"
                                : order.appClientStatus === "created"
                                  ? "criado"
                                  : "não encontrado"}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Sale date */}
                      <TableCell className="text-xs font-bold text-slate-500">
                        {order.saleDate
                          ? format(
                              parseISO(order.saleDate + "T12:00:00"),
                              "dd 'de' MMM, yyyy",
                              { locale: ptBR },
                            )
                          : "—"}
                      </TableCell>

                      {/* Client / Seller */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                            {order.appClientId ? (
                              <button
                                type="button"
                                onClick={() => handleOpenClientPurchases(order.appClientId)}
                                className="truncate text-left transition-colors hover:text-cyan-600 dark:hover:text-cyan-400"
                              >
                                {order.contactName || "Anonimo"}
                              </button>
                            ) : (
                              order.contactName || "Anonimo"
                            )}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">
                            Rep: {order.sellerName || "Nao vinculado"}
                          </span>
                        </div>
                      </TableCell>

                      {/* App link */}
                      <TableCell>
                        <AppLinkBadge order={order} />
                      </TableCell>

                      {/* Total value */}
                      <TableCell className="text-right">
                        <div className="text-base font-black text-slate-900 dark:text-white">
                          {formatCurrency(parseFloat(order.totalValue))}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {order.blingOrderId && (
                          <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 w-9 p-0 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:scale-110 transition-all rounded-xl border-none"
                              onClick={() =>
                                handleViewBlingDetails(order.blingOrderId!)
                              }
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
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

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-green-100 dark:bg-green-900/40 text-[8px] font-black text-green-600 dark:text-green-400">
                B
              </span>{" "}
              Bling
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-violet-100 dark:bg-violet-900/40 text-[8px] font-black text-violet-600 dark:text-violet-400">
                C
              </span>{" "}
              Connect
            </span>
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
        blingOrderId={selectedBlingOrderId}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedBlingOrderId(null);
        }}
      />
    </div>
  );
}
