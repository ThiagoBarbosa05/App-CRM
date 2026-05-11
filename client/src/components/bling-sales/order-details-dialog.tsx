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
import { useBlingOrderById, useOrderCashback } from "@/hooks/use-bling-orders";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Link2,
  Link2Off,
  Phone,
  Smartphone,
  Gift,
  Package,
  User,
  Store,
  Calendar,
  CreditCard,
  Hash,
  ShoppingCart,
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
    const date = parseISO(dateStr + "T12:00:00");
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function getSituationBadgeClass(value: string | null | undefined) {
  switch (String(value ?? "").trim()) {
    case "0":
      return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    case "1":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    case "2":
      return "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border-rose-200 dark:border-rose-800";
    default:
      return "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800";
  }
}

function getSituationLabel(situationName: string | null, situationId: string | null) {
  if (situationName) return situationName;
  switch (String(situationId ?? "").trim()) {
    case "0": return "Em Aberto";
    case "1": return "Concluído";
    case "2": return "Cancelado";
    default: return situationId || "N/A";
  }
}

function InfoCard({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3",
      className,
    )}>
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </p>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
        <Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
      </div>
      <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
        {label}
      </h3>
      {count !== undefined && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-0">
          {count}
        </Badge>
      )}
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    </div>
  );
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 shrink-0">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando pedido…
                    </span>
                  ) : order?.orderNumber ? (
                    <>Pedido <span className="font-mono">#{order.orderNumber}</span></>
                  ) : (
                    "Detalhes do Pedido"
                  )}
                </DialogTitle>
                {!isLoading && order && (
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    getSituationBadgeClass(order.situationId),
                  )}>
                    {getSituationLabel(order.situationName, order.situationId)}
                  </span>
                )}
              </div>
              {!isLoading && order?.saleDate && (
                <p className="text-xs text-slate-400 font-medium">
                  {format(parseISO(order.saleDate + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="h-10 w-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Carregando…
            </span>
          </div>
        ) : order ? (
          <div className="px-6 py-5 space-y-6">
            {/* ── Info Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <InfoCard icon={User} label="Cliente">
                {order.contactName || "N/A"}
              </InfoCard>

              <InfoCard icon={Hash} label="Vendedor">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {order.sellerName || "N/A"}
                </span>
              </InfoCard>

              <InfoCard icon={CreditCard} label="Valor Total" className="col-span-2 sm:col-span-1">
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(parseFloat(order.totalValue || "0"))}
                </span>
              </InfoCard>

              <InfoCard icon={Calendar} label="Data da Venda">
                {formatDate(order.saleDate)}
              </InfoCard>

              <InfoCard icon={Store} label="Loja">
                {order.storeId || "N/A"}
              </InfoCard>

              {order.contactType === "F" && (
                <>
                  <InfoCard icon={Phone} label="Telefone">
                    {order.contactPhone || "—"}
                  </InfoCard>

                  <InfoCard icon={Smartphone} label="Celular">
                    {order.contactCellphone || "—"}
                  </InfoCard>

                  <InfoCard icon={Link2} label="Vínculo no App" className="col-span-2 sm:col-span-1">
                    {order.appClientId ? (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-black">
                        <Link2 className="h-3 w-3" /> Vinculado
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-black">
                        <Link2Off className="h-3 w-3" /> Não encontrado
                      </div>
                    )}
                  </InfoCard>
                </>
              )}
            </div>

            {/* ── Itens ──────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <SectionTitle icon={ShoppingCart} label="Itens do Pedido" count={order.items?.length ?? 0} />

              {order.items && order.items.length > 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {/* Mobile: cards */}
                  <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {order.items.map((item) => {
                      const quantity = parseFloat(item.quantity || "0");
                      const unitValue = parseFloat(item.value || "0");
                      const total = quantity * unitValue;
                      return (
                        <div key={item.id} className="p-3 space-y-2 bg-white dark:bg-slate-900">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                              {item.description || "—"}
                            </p>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                              {formatCurrency(total)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {item.productCode || "—"}
                            </span>
                            <span>{quantity.toFixed(2)} un.</span>
                            <span>× {formatCurrency(unitValue)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent bg-slate-50 dark:bg-slate-900/60">
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto w-[110px]">
                            Código
                          </TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                            Descrição
                          </TableHead>
                          <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto w-[70px]">
                            Qtd
                          </TableHead>
                          <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto w-[120px]">
                            Unitário
                          </TableHead>
                          <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto w-[120px]">
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
                            <TableRow
                              key={item.id}
                              className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                            >
                              <TableCell className="font-mono text-[11px] font-bold text-slate-500 py-3">
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  {item.productCode || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-slate-700 dark:text-slate-300 py-3">
                                {item.description || "—"}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold text-slate-600 dark:text-slate-400 py-3">
                                {quantity.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-sm text-slate-600 dark:text-slate-400 py-3">
                                {formatCurrency(unitValue)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-black text-emerald-600 dark:text-emerald-400 py-3">
                                {formatCurrency(total)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">
                  Nenhum item encontrado.
                </p>
              )}
            </div>

            {/* ── Parcelas ───────────────────────────────────────────────── */}
            {order.installments && order.installments.length > 0 && (
              <div className="space-y-3">
                <SectionTitle icon={CreditCard} label="Parcelas" count={order.installments.length} />

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent bg-slate-50 dark:bg-slate-900/60">
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                          Vencimento
                        </TableHead>
                        <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                          Valor
                        </TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                          Observação
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.installments.map((installment) => (
                        <TableRow
                          key={installment.id}
                          className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        >
                          <TableCell className="text-sm font-semibold text-slate-700 dark:text-slate-300 py-3">
                            {formatDate(installment.dueDate)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-black text-slate-800 dark:text-white py-3">
                            {formatCurrency(parseFloat(installment.value || "0"))}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500 py-3">
                            {installment.observations || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── Cashback ───────────────────────────────────────────────── */}
            {order.contactType === "F" && (
              <div className="space-y-3">
                <SectionTitle icon={Gift} label="Cashback" />

                {isCashbackLoading ? (
                  <div className="flex items-center gap-2 py-4 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Carregando…
                    </span>
                  </div>
                ) : cashbacks && cashbacks.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent bg-slate-50 dark:bg-slate-900/60">
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                            Valor Cashback
                          </TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                            Taxa
                          </TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                            Status
                          </TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 h-auto">
                            Validade
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashbacks.map((cb) => (
                          <TableRow
                            key={cb.id}
                            className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                          >
                            <TableCell className="py-3">
                              <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                {formatCurrency(parseFloat(cb.cashbackAmount || "0"))}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-slate-600 dark:text-slate-400 py-3">
                              {parseFloat(cb.cashbackRate).toFixed(1)}%
                            </TableCell>
                            <TableCell className="py-3">
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                                cb.status === "approved"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : cb.status === "paid"
                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
                              )}>
                                {cb.status === "pending" && "Pendente"}
                                {cb.status === "approved" && "Aprovado"}
                                {cb.status === "paid" && "Pago"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-500 py-3">
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
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-5 text-center">
                    <Gift className="h-6 w-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      {order.appClientId
                        ? "Nenhuma transação de cashback registrada para este pedido."
                        : "Cliente não vinculado ao app. Cashback não gerado."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-6">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-dashed border-slate-200 dark:border-slate-700">
              <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Pedido não encontrado
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
