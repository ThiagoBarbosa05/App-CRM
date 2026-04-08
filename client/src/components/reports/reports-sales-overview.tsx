import {
  TrendingUp,
  ShoppingCart,
  Award,
  Package,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import type {
  SalesStatistics,
  TopSeller,
  TopProduct,
} from "@/hooks/use-bling-orders";

interface ReportsSalesOverviewProps {
  salesStats: SalesStatistics | undefined;
  topSellers: TopSeller[] | undefined;
  topProducts: TopProduct[] | undefined;
  isLoading: boolean;
  monthLabel: string;
}

function StatPill({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    violet: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400",
  };
  return (
    <div className={`flex items-center gap-3 p-4 rounded-2xl ${colorMap[color]}`}>
      <div className="opacity-80">{icon}</div>
      <div>
        <p className="text-xs font-medium opacity-70 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xl font-black">{value}</p>
      </div>
    </div>
  );
}

export function ReportsSalesOverview({
  salesStats,
  topSellers,
  topProducts,
  isLoading,
  monthLabel,
}: ReportsSalesOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-72 bg-slate-100 dark:bg-slate-800 rounded-3xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  const hasSalesData =
    salesStats && (salesStats.totalOrders > 0 || salesStats.totalValue > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-900/10 dark:to-green-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
        <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 text-emerald-600 dark:text-emerald-400 shadow-sm">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Vendas do Mês
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Desempenho comercial em {monthLabel}
          </p>
        </div>
      </div>

      {!hasSalesData ? (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl bg-white dark:bg-slate-900">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-full w-16 h-16 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
              <TrendingUp className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium italic text-center">
              Nenhuma venda registrada em {monthLabel}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs de vendas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <StatPill
                label="Receita Total"
                value={formatCurrency(salesStats.totalValue)}
                icon={<TrendingUp className="h-5 w-5" />}
                color="emerald"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <StatPill
                label="Pedidos"
                value={salesStats.totalOrders.toLocaleString("pt-BR")}
                icon={<ShoppingCart className="h-5 w-5" />}
                color="blue"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <StatPill
                label="Ticket Médio"
                value={formatCurrency(salesStats.averageValue)}
                icon={<Award className="h-5 w-5" />}
                color="violet"
              />
            </motion.div>
          </div>

          {/* Top vendedores e top produtos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Vendedores */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl bg-white dark:bg-slate-900">
              <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-2.5">
                    <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Top Vendedores
                    </CardTitle>
                    <CardDescription>
                      Melhores desempenhos do mês
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {!topSellers || topSellers.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 italic py-8">
                    Sem dados de vendedores
                  </p>
                ) : (
                  topSellers.map((seller, index) => (
                    <motion.div
                      key={seller.sellerId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                            index === 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : index === 1
                                ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                : index === 2
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {seller.sellerName || "Sem nome"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {seller.totalOrders} pedido
                            {seller.totalOrders !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-blue-700 dark:text-blue-400 flex-shrink-0">
                        {formatCurrency(Number(seller.totalValue))}
                      </span>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top Produtos */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl bg-white dark:bg-slate-900">
              <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800 bg-violet-50/30 dark:bg-violet-900/10">
                <div className="flex items-center gap-3">
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-xl p-2.5">
                    <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Top Produtos
                    </CardTitle>
                    <CardDescription>
                      Mais vendidos em quantidade e valor
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {!topProducts || topProducts.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 italic py-8">
                    Sem dados de produtos
                  </p>
                ) : (
                  topProducts.map((product, index) => (
                    <motion.div
                      key={product.productId ?? product.description}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                            index === 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : index === 1
                                ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                : index === 2
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {product.description}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {Number(product.totalQuantity).toLocaleString("pt-BR")} un
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-violet-700 dark:text-violet-400 flex-shrink-0">
                        {formatCurrency(Number(product.totalValue))}
                      </span>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
