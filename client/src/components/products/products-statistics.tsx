import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DollarSign, PieChart as PieChartIcon, ChevronDown, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useState } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ProductsStatisticsProps {
  statistics: any;
  isLoading: boolean;
  error: any;
  getCountryFlag: (country: string) => string;
  getTypeColor: (type: string) => string;
}

const TYPE_COLORS: Record<string, string> = {
  TINTO: "#dc2626",
  BRANCO: "#d4a017",
  ESPUMANTE: "#f59e0b",
  ROSE: "#ec4899",
  "PÓS-REFEIÇÃO": "#7c3aed",
};

const BAR_STYLES = [
  { bar: "from-violet-600 via-purple-500 to-fuchsia-400", glow: "bg-violet-500/15", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200/50" },
  { bar: "from-violet-500 via-purple-400 to-fuchsia-300", glow: "bg-purple-400/12", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200/50" },
  { bar: "from-indigo-500 via-violet-400 to-purple-300", glow: "bg-indigo-400/10", badge: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200/50" },
  { bar: "from-slate-400 via-violet-300 to-purple-200", glow: "bg-slate-300/10", badge: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50" },
  { bar: "from-slate-300 via-indigo-200 to-violet-100", glow: "bg-slate-300/10", badge: "bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-300 border-slate-100" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

function SkeletonCard() {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50 dark:bg-slate-900 h-24 p-6 flex flex-col gap-2">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
        <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded" />
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {[1, 2, 3].map((j) => (
          <div key={j} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
              <div className="space-y-1">
                <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                <div className="h-3 w-24 bg-slate-50 dark:bg-slate-800/50 animate-pulse rounded" />
              </div>
            </div>
            <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
        {item.name}
      </p>
      <p className="text-sm font-black text-slate-800 dark:text-slate-100">
        {formatCurrency(item.value)}
      </p>
      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
        {item.payload.totalQuantity} unid. · {item.payload.percent}
      </p>
    </div>
  );
}

export function ProductsStatistics({
  statistics,
  isLoading,
  error,
  getCountryFlag,
  getTypeColor,
}: ProductsStatisticsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/20">
        <CardContent className="p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium">
            Erro ao carregar estatísticas: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !statistics) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const { topProductsByRevenue, revenueByType } = statistics;

  const maxRevenue = Math.max(
    ...topProductsByRevenue.map((p: any) => parseFloat(p.totalRevenue || "0")),
    0
  );

  const totalRevenue = revenueByType.reduce(
    (acc: number, t: any) => acc + parseFloat(t.totalRevenue || "0"),
    0
  );

  const pieData = revenueByType.map((t: any) => {
    const rev = parseFloat(t.totalRevenue || "0");
    return {
      name: t.productType,
      value: rev,
      totalQuantity: t.totalQuantity,
      percent:
        totalRevenue > 0
          ? `${((rev / totalRevenue) * 100).toFixed(1)}%`
          : "0%",
      color: TYPE_COLORS[t.productType] ?? "#94a3b8",
    };
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Cabeçalho retrátil — mesmo padrão de Análise de Clientes */}
      <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 px-4 py-3 rounded-xl shadow-md">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Análise de Produtos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Faturamento e distribuição de receita por tipo de vinho
            </p>
          </div>
          <ChevronDown
            className={`ml-auto h-5 w-5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Conteúdo expansível */}
      {isOpen && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {/* Card 1 — Faturamento por Vinho */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 p-6 transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/80">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
              <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              Faturamento por Vinho
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Top 8 vinhos com maior receita gerada nos pedidos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-slate-900">
            {topProductsByRevenue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                  <DollarSign className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-900 dark:text-white font-semibold">
                  Nenhum dado disponível
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 px-8">
                  Aguarde pedidos vinculados a clientes para ver o ranking
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topProductsByRevenue.map((product: any, index: number) => {
                  const revenue = parseFloat(product.totalRevenue || "0");
                  const barWidth =
                    maxRevenue > 0
                      ? Math.max((revenue / maxRevenue) * 100, 6)
                      : 0;
                  const style = BAR_STYLES[index % BAR_STYLES.length];

                  return (
                    <div
                      key={product.productId}
                      className="group/row relative overflow-hidden rounded-2xl border border-white/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55 p-3.5 shadow-sm hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-y-0 right-0 w-20 blur-2xl opacity-70 group-hover/row:opacity-100 transition-opacity duration-300",
                          style.glow
                        )}
                      />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-black border shadow-sm mt-0.5",
                              style.badge
                            )}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate leading-tight">
                              {product.productName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                <span>{getCountryFlag(product.productCountry)}</span>
                                {product.productCountry}
                              </span>
                              <Badge
                                className={cn(
                                  "text-[10px] font-black uppercase border-0 h-4 px-1.5",
                                  getTypeColor(product.productType)
                                )}
                              >
                                {product.productType}
                              </Badge>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {product.totalQuantity} unid.
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-violet-700 dark:text-violet-300">
                            {formatCurrency(revenue)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                            {product.orderCount} pedido{product.orderCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-100/90 dark:bg-slate-800/80">
                        <div
                          className={cn(
                            "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                            style.bar
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 2 — Distribuição por Tipo */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 p-6 transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/80">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                <PieChartIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Receita por Tipo de Vinho
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Distribuição da receita total por categoria
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-slate-900">
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                  <PieChartIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-900 dark:text-white font-semibold">
                  Nenhum dado disponível
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 px-8">
                  Aguarde pedidos registrados para ver a distribuição
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {pieData.map((entry: any) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between gap-3 px-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {entry.name}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {entry.totalQuantity} unid.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {formatCurrency(entry.value)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 w-10 text-right">
                          {entry.percent}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {totalRevenue > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Total
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatCurrency(totalRevenue)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      </div>
      )}
    </motion.div>
  );
}
