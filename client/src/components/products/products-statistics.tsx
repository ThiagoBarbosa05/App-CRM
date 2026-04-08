import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Award, TrendingUp, Wine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface ProductsStatisticsProps {
  statistics: any;
  isLoading: boolean;
  error: any;
  getCountryFlag: (country: string) => string;
  getTypeColor: (type: string) => string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export function ProductsStatistics({
  statistics,
  isLoading,
  error,
  getCountryFlag,
  getTypeColor,
}: ProductsStatisticsProps) {
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
        {[1, 2].map((i) => (
          <Card
            key={i}
            className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <CardHeader className="bg-slate-50 dark:bg-slate-900 content-none h-24 p-6 flex flex-col gap-2">
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
                  <div className="h-6 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { topClientsByProducts, topProductsByClients } = statistics;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-6 md:grid-cols-1 lg:grid-cols-2"
    >
      {/* Top Clientes */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 p-6 transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/80">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Clientes com Mais Vinhos
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Top 10 clientes com maior variedade de produtos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topClientsByProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                    <Award className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-900 dark:text-white font-semibold">
                    Nenhum dado disponível
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 px-8">
                    Aguarde clientes cadastrarem produtos para ver o ranking
                  </p>
                </div>
              ) : (
                topClientsByProducts.map((client: any, index: number) => (
                  <div
                    key={client.clientId}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/row"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm transition-all group-hover/row:scale-105 ${
                          index === 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200/50"
                            : index === 1
                              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50"
                              : index === 2
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border border-orange-200/50"
                                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight">
                          {client.clientName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {(client.clientCity || client.clientState) && (
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase">
                              {[client.clientCity, client.clientState].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {client.responsibleName && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">
                                •
                              </span>
                              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                {client.responsibleName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                        {client.productCount}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-wider">
                        vinhos
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Produtos */}
      <motion.div variants={itemVariants}>
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 p-6 transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/80">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Vinhos Mais Populares
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Top 10 produtos mais vinculados a clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topProductsByClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                    <Wine className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-900 dark:text-white font-semibold">
                    Nenhum dado disponível
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 px-8">
                    Aguarde vinhos serem vinculados a clientes para ver o
                    ranking
                  </p>
                </div>
              ) : (
                topProductsByClients.map((product: any, index: number) => (
                  <div
                    key={product.productId}
                    className="flex items-start justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/row"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm transition-all group-hover/row:scale-105 mt-1 shrink-0 ${
                          index === 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200/50"
                            : index === 1
                              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50"
                              : index === 2
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border border-orange-200/50"
                                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">
                          {product.productName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="text-base leading-none">
                              {getCountryFlag(product.productCountry)}
                            </span>
                            {product.productCountry}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-black uppercase border-slate-200 dark:border-slate-700"
                          >
                            {product.productVolume}
                          </Badge>
                          <Badge
                            className={`text-[10px] font-black uppercase border-0 ${getTypeColor(product.productType)}`}
                          >
                            {product.productType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                        {product.clientCount}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-wider">
                        clientes
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
