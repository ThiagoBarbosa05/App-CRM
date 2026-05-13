import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DollarSign, PieChart as PieChartIcon, ChevronDown, BarChart3, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatCurrency, cn } from "@/lib/utils";
import { useLocation } from "wouter";
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
  { bar: "from-primary via-primary/80 to-primary/60", glow: "bg-primary/15", badge: "bg-primary/10 text-primary dark:bg-primary/20 border-primary/20" },
  { bar: "from-primary/90 via-primary/70 to-primary/50", glow: "bg-primary/10", badge: "bg-accent text-primary border-border" },
  { bar: "from-primary/70 via-primary/50 to-primary/30", glow: "bg-primary/8", badge: "bg-accent text-primary/80 border-border" },
  { bar: "from-slate-400 via-slate-300 to-slate-200", glow: "bg-slate-300/10", badge: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50" },
  { bar: "from-slate-300 via-slate-200 to-slate-100", glow: "bg-slate-200/10", badge: "bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-300 border-slate-100" },
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

type WinePeriod = "mes_atual" | "ultimos_12";
type WineType = "TODOS" | "ESPUMANTE" | "BRANCO" | "ROSE" | "TINTO" | "PÓS-REFEIÇÃO";

const TYPE_BUTTON_STYLES: Record<WineType, string> = {
  TODOS:        "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
  ESPUMANTE:    "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  BRANCO:       "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
  ROSE:         "bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300",
  TINTO:        "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300",
  "PÓS-REFEIÇÃO": "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
};

export function ProductsStatistics({
  statistics,
  isLoading,
  error,
  getCountryFlag,
  getTypeColor,
}: ProductsStatisticsProps) {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [winePeriod, setWinePeriod] = useState<WinePeriod>("mes_atual");
  const [qtyPeriod, setQtyPeriod] = useState<WinePeriod>("mes_atual");
  const [selectedType, setSelectedType] = useState<WineType>("TODOS");

  const { startDate: wineStartDate, endDate: wineEndDate } = useMemo(() => {
    const now = new Date();
    return winePeriod === "mes_atual"
      ? { startDate: format(startOfMonth(now), "yyyy-MM-dd"), endDate: format(endOfMonth(now), "yyyy-MM-dd") }
      : { startDate: format(subMonths(now, 12), "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") };
  }, [winePeriod]);

  const { startDate: qtyStartDate, endDate: qtyEndDate } = useMemo(() => {
    const now = new Date();
    return qtyPeriod === "mes_atual"
      ? { startDate: format(startOfMonth(now), "yyyy-MM-dd"), endDate: format(endOfMonth(now), "yyyy-MM-dd") }
      : { startDate: format(subMonths(now, 12), "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") };
  }, [qtyPeriod]);

  const { data: qtyStats, isLoading: isLoadingQty, isFetching: isFetchingQty } = useQuery<{ quantityByProduct: any[] }>({
    queryKey: ["/api/products/statistics", "qty", qtyStartDate, qtyEndDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/products/statistics?startDate=${qtyStartDate}&endDate=${qtyEndDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar quantidade por produto");
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: 2,
  });

  const { data: wineStats, isLoading: isLoadingWine, isFetching: isFetchingWine } = useQuery<{ revenueByType: any[] }>({
    queryKey: ["/api/products/statistics", "wine", wineStartDate, wineEndDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/products/statistics?startDate=${wineStartDate}&endDate=${wineEndDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar receita por tipo de vinho");
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: 2,
  });

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

  const { topProductsByRevenue } = statistics;

  const maxRevenue = Math.max(
    ...topProductsByRevenue.map((p: any) => parseFloat(p.totalRevenue || "0")),
    0
  );

  const allQuantityByProduct: any[] = qtyStats?.quantityByProduct ?? [];
  const filteredByType = (selectedType === "TODOS"
    ? allQuantityByProduct
    : allQuantityByProduct.filter((p: any) => p.productType === selectedType)
  ).slice(0, 20);
  const totalQty = filteredByType.reduce((acc: number, p: any) => acc + parseFloat(p.totalQuantity || "0"), 0);
  const maxQty = Math.max(...filteredByType.map((p: any) => parseFloat(p.totalQuantity || "0")), 0);

  const wineRevenueByType: any[] = wineStats?.revenueByType ?? [];
  const totalRevenue = wineRevenueByType.reduce(
    (acc: number, t: any) => acc + parseFloat(t.totalRevenue || "0"),
    0
  );

  const pieData = wineRevenueByType.map((t: any) => {
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
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
      {/* Card 1 — Faturamento por Vinho */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 p-6 transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/80">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
              <div className="p-2.5 bg-accent rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="h-5 w-5 text-primary" />
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
                      onClick={() => navigate(`/products/${product.productId}`)}
                      className="group/row relative overflow-hidden rounded-2xl border border-white/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55 p-3.5 shadow-sm hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
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
                          <p className="text-sm font-black text-primary">
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <PieChartIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Receita por Tipo de Vinho
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium ml-[52px]">
                  Distribuição da receita total por categoria
                </CardDescription>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                {(["mes_atual", "ultimos_12"] as WinePeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setWinePeriod(p)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                      winePeriod === p
                        ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                        : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p === "mes_atual" ? "Mês Atual" : "12 Meses"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-slate-900">
            {(isLoadingWine || isFetchingWine) ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : pieData.length === 0 ? (
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

      {/* Card 3 — Produtos Vendidos por Tipo */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 p-6 transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Produtos Vendidos
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium ml-[52px]">
                  Quantidade de garrafas vendidas por tipo
                </CardDescription>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                {(["mes_atual", "ultimos_12"] as WinePeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setQtyPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                      qtyPeriod === p
                        ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                        : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p === "mes_atual" ? "Mês Atual" : "12 Meses"}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filter buttons */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(["TODOS", "ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] as WineType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-150 border",
                    selectedType === t
                      ? cn(TYPE_BUTTON_STYLES[t], "ring-2 ring-offset-1 ring-current border-transparent")
                      : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  {t === "TODOS" ? "Todos" : t}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-4 bg-white dark:bg-slate-900">
            {(isLoadingQty || isFetchingQty) ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : filteredByType.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                  <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-900 dark:text-white font-semibold">Nenhum dado disponível</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 px-8">
                  Sem vendas no período selecionado
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Total */}
                <div className="flex items-center justify-between px-1 mb-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total no período
                  </span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {totalQty.toFixed(0)} unid.
                  </span>
                </div>

                {filteredByType.map((product: any) => {
                  const qty = parseFloat(product.totalQuantity || "0");
                  const barWidth = maxQty > 0 ? Math.max((qty / maxQty) * 100, 4) : 0;
                  const typeStyle = TYPE_BUTTON_STYLES[product.productType as WineType] ?? TYPE_BUTTON_STYLES["TODOS"];

                  return (
                    <div key={product.productId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate flex-1">
                          {product.productName}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {selectedType === "TODOS" && product.productType && (
                            <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md", typeStyle)}>
                              {product.productType}
                            </span>
                          )}
                          <span className="text-xs font-black text-blue-700 dark:text-blue-300 w-16 text-right">
                            {qty.toFixed(0)} unid.
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
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
      </div>
      )}
    </motion.div>
  );
}
