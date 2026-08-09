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
  Package,
  Search,
  UserCheck,
  Loader2,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { OrderDetailsDialog } from "@/components/bling-sales/order-details-dialog";
import { ConnectOrderDetailsDialog, type ConnectOrderDialogData } from "@/components/connect-sales/connect-order-details-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface UnifiedOrdersTableProps {
  orders: UnifiedOrder[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasMore: boolean;
  totalOrders?: number;
  /** Soma apenas das vendas concluídas (Bling situationId '9' + todo o Connect) */
  totalValueCompleted?: number;
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
      return value || null;
  }
}

function getSituationBadgeClass(value: string | null | undefined) {
  switch (String(value ?? "").trim()) {
    case "0":
      return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
    case "1":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400";
    case "2":
      return "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400";
    default:
      return "bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400";
  }
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

function AppLinkBadge({
  order,
  onLink,
  onRelink,
}: {
  order: UnifiedOrder;
  onLink?: () => void;
  onRelink?: () => void;
}) {
  if (order.appClientId) {
    if (onRelink) {
      return (
        <button
          type="button"
          onClick={onRelink}
          title="Clique para trocar ou remover o vínculo"
          className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
        >
          <Link2 className="h-3 w-3" /> Vinculado
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
        <Link2 className="h-3 w-3" /> Vinculado
      </div>
    );
  }
  if (onLink) {
    return (
      <button
        type="button"
        onClick={onLink}
        title="Clique para vincular a um cliente"
        className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
      >
        <Link2Off className="h-3 w-3" /> Sem vínculo
      </button>
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
  totalValueCompleted = 0,
}: UnifiedOrdersTableProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageLinks = user?.role === "admin" || user?.role === "gerente";
  const [selectedBlingOrderId, setSelectedBlingOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedConnectOrder, setSelectedConnectOrder] = useState<ConnectOrderDialogData | null>(null);
  const [isConnectDetailsOpen, setIsConnectDetailsOpen] = useState(false);

  // ── Link-client dialog ─────────────────────────────────────────────────────
  const [linkingOrder, setLinkingOrder] = useState<UnifiedOrder | null>(null);
  /** true when dialog was opened from a "Vinculado" badge (replace/unlink mode) */
  const [isReplacing, setIsReplacing] = useState(false);
  /** pending replace confirmation: selected client before user confirms */
  const [pendingReplace, setPendingReplace] = useState<{ clientId: string; clientName: string } | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setClientSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data: clientResults, isFetching: isSearching } = useQuery({
    queryKey: ["/api/clients", "link-search", debouncedSearch],
    queryFn: async () => {
      const param = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
      const res = await apiRequest("GET", `/api/clients?pageSize=20${param}`);
      const body = await res.json() as { data: Array<{ id: string; name: string; phone?: string | null }> };
      return body.data ?? [];
    },
    enabled: !!linkingOrder,
    staleTime: 10_000,
  });

  const closeLinkDialog = () => {
    setLinkingOrder(null);
    setIsReplacing(false);
    setPendingReplace(null);
    setClientSearch("");
    setDebouncedSearch("");
  };

  const linkMutation = useMutation({
    mutationFn: async ({ order, clientId }: { order: UnifiedOrder; clientId: string }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/unified-orders/${order.source}/${order.id}/link-client`,
        { clientId },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Erro ao vincular cliente");
      }
      return res.json() as Promise<{ ok: boolean; clientName: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Cliente vinculado com sucesso", description: data.clientName });
      queryClient.invalidateQueries({ queryKey: ["/api/unified-orders"] });
      closeLinkDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao vincular", description: err.message, variant: "destructive" });
      setPendingReplace(null);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (order: UnifiedOrder) => {
      const res = await apiRequest(
        "PATCH",
        `/api/unified-orders/${order.source}/${order.id}/unlink-client`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Erro ao desvincular cliente");
      }
      return res.json() as Promise<{ ok: boolean }>;
    },
    onSuccess: () => {
      toast({ title: "Vínculo removido com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/unified-orders"] });
      closeLinkDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desvincular", description: err.message, variant: "destructive" });
    },
  });

  const handleViewConnectDetails = (order: UnifiedOrder) => {
    setSelectedConnectOrder({
      saleCode: order.saleCode,
      saleDate: order.saleDate,
      totalValue: order.totalValue,
      contactName: order.contactName,
      sellerName: order.sellerName,
      appClientId: order.appClientId,
      contactPhone: order.contactPhone,
      contactCellphone: order.contactCellphone,
      connectItems: order.connectItems,
    });
    setIsConnectDetailsOpen(true);
  };

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
      {/* ── Mobile: Cards ──────────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-4 py-16 px-6 shadow-sm">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-dashed border-slate-200 dark:border-slate-700">
              <InboxIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                Vazio por aqui
              </p>
              <p className="text-xs font-medium text-slate-500">
                Não encontramos pedidos com os filtros aplicados.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {orders.map((order, index) => {
              const hasConnectItems =
                order.source === "connect" &&
                (order.connectItems?.length ?? 0) > 0;

              return (
                <motion.div
                  key={`card-${order.source}-${order.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  {/* Row 1: Source + Ref + Situação + Valor */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SourceBadge source={order.source} />
                      {order.orderNumber ? (
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-mono text-[11px] font-black text-slate-600 dark:text-slate-300">
                          #{order.orderNumber}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 italic">
                          CSV Import
                        </span>
                      )}
                      {order.situationValue && (
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                            getSituationBadgeClass(order.situationValue),
                          )}
                        >
                          {getSituationLabel(order.situationValue)}
                        </span>
                      )}
                      {order.appClientStatus && !order.orderNumber && (
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
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
                    <span className="text-base font-black text-slate-900 dark:text-white shrink-0">
                      {formatCurrency(parseFloat(order.totalValue))}
                    </span>
                  </div>

                  {/* Row 2: Cliente + Vendedor */}
                  <div className="flex flex-col gap-0.5">
                    {order.appClientId ? (
                      <button
                        type="button"
                        onClick={() => handleOpenClientPurchases(order.appClientId)}
                        className="text-sm font-black text-left text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                      >
                        {order.contactName || "Anônimo"}
                      </button>
                    ) : (
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {order.contactName || "Anônimo"}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">
                      Rep: {order.sellerName || "Não vinculado"}
                    </span>
                  </div>

                  {/* Row 3: Data + App link */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {order.saleDate
                        ? format(
                            parseISO(order.saleDate + "T12:00:00"),
                            "dd 'de' MMM, yyyy",
                            { locale: ptBR },
                          )
                        : "—"}
                    </span>
                    <AppLinkBadge
                      order={order}
                      onLink={canManageLinks ? () => { setIsReplacing(false); setLinkingOrder(order); } : undefined}
                      onRelink={canManageLinks ? () => { setIsReplacing(true); setLinkingOrder(order); } : undefined}
                    />
                  </div>

                  {/* Row 4: Actions */}
                  {(order.blingOrderId || hasConnectItems) && (
                    <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {order.blingOrderId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 gap-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-xl border-none text-xs font-bold"
                          onClick={() => handleViewBlingDetails(order.blingOrderId!)}
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Ver detalhes
                        </Button>
                      )}
                      {hasConnectItems && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 gap-2 bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900 rounded-xl border-none text-xs font-bold"
                          onClick={() => handleViewConnectDetails(order)}
                        >
                          <Package className="h-3.5 w-3.5" />
                          Produtos
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── Desktop: Table ─────────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
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
                  orders.map((order, index) => {
                    const hasConnectItems =
                      order.source === "connect" &&
                      (order.connectItems?.length ?? 0) > 0;

                    return (
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
                            <span
                              className={cn(
                                "w-fit rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                getSituationBadgeClass(order.situationValue),
                              )}
                            >
                              {getSituationLabel(order.situationValue)}
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
                        <AppLinkBadge
                          order={order}
                          onLink={canManageLinks ? () => { setIsReplacing(false); setLinkingOrder(order); } : undefined}
                          onRelink={canManageLinks ? () => { setIsReplacing(true); setLinkingOrder(order); } : undefined}
                        />
                      </TableCell>

                      {/* Total value */}
                      <TableCell className="text-right">
                        <div className="text-base font-black text-slate-900 dark:text-white">
                          {formatCurrency(parseFloat(order.totalValue))}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {order.blingOrderId && (
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
                          )}
                          {hasConnectItems && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 w-9 p-0 bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900 hover:scale-110 transition-all rounded-xl border-none"
                              onClick={() => handleViewConnectDetails(order)}
                              title="Ver produtos"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                    );
                  })
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

          {totalValueCompleted > 0 && (
            <div
              className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800"
              title="Soma apenas dos pedidos concluídos — pedidos em aberto e cancelados aparecem na lista, mas não entram neste total"
            >
              <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">
                Concluído{" "}
                <span className="text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(totalValueCompleted)}
                </span>
              </p>
            </div>
          )}

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

      <ConnectOrderDetailsDialog
        order={selectedConnectOrder}
        open={isConnectDetailsOpen}
        onOpenChange={(open) => {
          setIsConnectDetailsOpen(open);
          if (!open) setSelectedConnectOrder(null);
        }}
      />

      {/* ── Dialog: Vincular / Trocar / Desvincular cliente ──────────────── */}
      <Dialog
        open={!!linkingOrder}
        onOpenChange={(open) => { if (!open) closeLinkDialog(); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              {isReplacing ? "Trocar ou remover vínculo" : "Vincular cliente ao pedido"}
            </DialogTitle>
            <DialogDescription>
              {linkingOrder?.contactName
                ? `Pedido de "${linkingOrder.contactName}" — ${isReplacing ? "selecione um novo cliente ou remova o vínculo" : "busque e selecione o cliente no CRM"}`
                : isReplacing ? "Selecione um novo cliente ou remova o vínculo" : "Busque e selecione o cliente no CRM"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {/* ── Unlink button (replace mode only) ── */}
            {isReplacing && !pendingReplace && (
              <button
                type="button"
                disabled={unlinkMutation.isPending}
                onClick={() => linkingOrder && unlinkMutation.mutate(linkingOrder)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50"
              >
                <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                  {unlinkMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Link2Off className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold">Remover vínculo</p>
                  <p className="text-xs opacity-70">O pedido ficará sem cliente associado</p>
                </div>
              </button>
            )}

            {/* ── Confirmation step (replace mode) ── */}
            {pendingReplace ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Confirmar troca de vínculo?
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  O pedido será vinculado a{" "}
                  <span className="font-black">{pendingReplace.clientName}</span>.
                  O vínculo anterior será substituído.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl"
                    disabled={linkMutation.isPending}
                    onClick={() => setPendingReplace(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={linkMutation.isPending}
                    onClick={() =>
                      linkingOrder &&
                      linkMutation.mutate({ order: linkingOrder, clientId: pendingReplace.clientId })
                    }
                  >
                    {linkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar troca"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    autoFocus
                    placeholder="Buscar por nome ou telefone..."
                    value={clientSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                  )}
                </div>

                {/* Results list */}
                <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  {(clientResults ?? []).length === 0 && !isSearching ? (
                    <p className="text-sm text-slate-400 text-center py-8">
                      {debouncedSearch ? "Nenhum cliente encontrado" : "Digite para buscar clientes"}
                    </p>
                  ) : (
                    (clientResults ?? []).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        disabled={linkMutation.isPending}
                        onClick={() => {
                          if (!linkingOrder) return;
                          if (isReplacing) {
                            // require confirmation before replacing
                            setPendingReplace({ clientId: client.id, clientName: client.name });
                          } else {
                            linkMutation.mutate({ order: linkingOrder, clientId: client.id });
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors text-left disabled:opacity-50"
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{client.name}</p>
                          {client.phone && (
                            <p className="text-xs text-slate-400 truncate">{client.phone}</p>
                          )}
                        </div>
                        {linkMutation.isPending && (
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
