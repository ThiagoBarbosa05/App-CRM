import { formatCurrency } from "@/lib/utils";
import type { UnifiedTopSeller } from "@/hooks/use-unified-orders";
import { Users2, TrendingUp, ShoppingCart, Receipt } from "lucide-react";

interface SellerTotalsTableProps {
  data?: UnifiedTopSeller[];
  isLoading: boolean;
}

const RANK_STYLES = [
  { medal: "🥇", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-700/50", text: "text-amber-700 dark:text-amber-300", bar: "from-amber-400 to-yellow-300" },
  { medal: "🥈", bg: "bg-slate-50 dark:bg-slate-800/50", border: "border-slate-200 dark:border-slate-700", text: "text-slate-600 dark:text-slate-300", bar: "from-slate-400 to-slate-300" },
  { medal: "🥉", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-700/50", text: "text-orange-700 dark:text-orange-300", bar: "from-orange-400 to-amber-300" },
];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 w-36 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-2.5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1">
        <div className="h-3.5 w-20 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-2.5 w-14 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-3.5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function SellerTotalsTable({ data, isLoading }: SellerTotalsTableProps) {
  const sellers = data ?? [];
  const maxValue = sellers.length > 0 ? Math.max(...sellers.map((s) => s.totalValue)) : 1;
  const grandTotal = sellers.reduce((acc, s) => acc + s.totalValue, 0);
  const grandOrders = sellers.reduce((acc, s) => acc + s.totalOrders, 0);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 shadow-inner">
              <Users2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Total Vendido por Vendedor
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Bling + Connect · período selecionado
              </p>
            </div>
          </div>

          {/* Summary chips */}
          {!isLoading && sellers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-lg px-3 py-1.5">
                <TrendingUp className="h-3 w-3 text-violet-500" />
                <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5">
                <ShoppingCart className="h-3 w-3 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {grandOrders} pedidos
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Column headers */}
      {!isLoading && sellers.length > 0 && (
        <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-5 py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-7 text-center">#</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vendedor</span>
          <span className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Pedidos</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Ticket Médio</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Total</span>
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-slate-50 dark:divide-slate-800/70">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : sellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Users2 className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum dado encontrado</p>
            <p className="text-xs mt-1">Ajuste o período para ver vendas por vendedor</p>
          </div>
        ) : (
          sellers.map((seller, idx) => {
            const rank = RANK_STYLES[idx] ?? null;
            const barWidth = maxValue > 0 ? (seller.totalValue / maxValue) * 100 : 0;
            const avgTicket = seller.totalOrders > 0 ? seller.totalValue / seller.totalOrders : 0;
            const share = grandTotal > 0 ? (seller.totalValue / grandTotal) * 100 : 0;

            return (
              <div
                key={seller.sellerId ?? seller.sellerName}
                className={`grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${rank ? rank.bg : ""}`}
              >
                {/* Rank badge */}
                <div className="w-7 flex justify-center shrink-0">
                  {rank ? (
                    <span className="text-lg leading-none">{rank.medal}</span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Name + bar */}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${rank ? rank.text : "text-slate-700 dark:text-slate-200"}`}>
                    {seller.sellerName || "Desconhecido"}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${rank ? rank.bar : "from-violet-400 to-violet-300"} transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Orders */}
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                    {seller.totalOrders}
                  </span>
                  <span className="text-[9px] text-slate-400">pedidos</span>
                </div>

                {/* Avg ticket */}
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatCurrency(avgTicket)}
                  </span>
                  <span className="text-[9px] text-slate-400">ticket médio</span>
                </div>

                {/* Total */}
                <div className="flex flex-col items-end">
                  <span className={`text-sm font-bold tabular-nums ${rank ? rank.text : "text-slate-800 dark:text-slate-100"}`}>
                    {formatCurrency(seller.totalValue)}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Receipt className="h-2.5 w-2.5 text-slate-400" />
                    <span className="text-[9px] text-slate-400 sm:hidden">{seller.totalOrders} ped.</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer total */}
      {!isLoading && sellers.length > 1 && (
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800">
          <div className="w-7" />
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total Geral
          </span>
          <span className="hidden sm:block text-xs font-bold text-slate-600 dark:text-slate-300 text-right tabular-nums">
            {grandOrders}
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right tabular-nums">
            {grandOrders > 0 ? formatCurrency(grandTotal / grandOrders) : "—"}
          </span>
          <span className="text-sm font-black text-violet-700 dark:text-violet-300 text-right tabular-nums">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      )}
    </div>
  );
}
