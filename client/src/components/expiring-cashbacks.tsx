import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Clock,
  Search,
  SortAsc,
  SortDesc,
  User,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExpiringCashback {
  id: string;
  cashbackAmount: number;
  purchaseAmount: number;
  cashbackRate: number;
  expiresAt: string;
  daysUntilExpiry: number;
  status: string;
  notes: string | null;
  invoiceNumber: string | null;
  saleDate: string | null;
  createdAt: string;
  client: {
    id: string;
    name: string;
    phone: string;
    cpf: string;
    email: string;
  };
  seller: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ExpiringCashbacksResponse {
  success: boolean;
  data: ExpiringCashback[];
  statistics: {
    totalRecords: number;
    totalAmount: number;
    averageAmount: number;
    daysRange: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ExpiringCashbacksProps {
  formatCurrency: (value: string | number) => string;
}

export const ExpiringCashbacks: React.FC<ExpiringCashbacksProps> = ({
  formatCurrency,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<
    "amount" | "expiresAt" | "clientName" | "sellerName"
  >("expiresAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Query para buscar cashbacks vencendo
  const {
    data: expiringData,
    isLoading,
    isError,
    refetch,
  } = useQuery<ExpiringCashbacksResponse>({
    queryKey: [
      "/api/cashback-settings/expiring",
      searchTerm,
      sortBy,
      sortOrder,
      currentPage,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        sortBy,
        sortOrder,
        limit: itemsPerPage.toString(),
        offset: (currentPage * itemsPerPage).toString(),
      });

      const response = await fetch(`/api/cashback-settings/expiring?${params}`);
      if (!response.ok) {
        throw new Error("Erro ao buscar cashbacks vencendo");
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
  };

  const handleSortChange = (
    newSortBy: "amount" | "expiresAt" | "clientName" | "sellerName"
  ) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("asc");
    }
    setCurrentPage(0);
  };

  const getSortIcon = (
    field: "amount" | "expiresAt" | "clientName" | "sellerName"
  ) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? (
      <SortAsc className="h-4 w-4" />
    ) : (
      <SortDesc className="h-4 w-4" />
    );
  };

  if (isError) {
    return (
      <Card className="border-0 shadow-2xl bg-white dark:bg-slate-900 border-red-500/10 dark:border-red-500/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5" />
        <CardHeader className="relative border-b border-red-100 dark:border-red-900/20">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/10 rounded-2xl p-3">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-red-700 dark:text-red-400 uppercase tracking-tight">
                Falha na Conexão
              </CardTitle>
              <CardDescription className="text-red-600/70 dark:text-red-400/70 font-medium">
                Não foi possível recuperar os dados de vencimento.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative p-10 text-center">
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 font-bold rounded-xl"
          >
            Tentar Restaurar Dados
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-slate-100 dark:border-slate-800 overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 px-8 py-10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="flex items-start gap-4">
            <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl p-3.5 shadow-lg shadow-blue-500/5">
              <Clock className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Cashback a <span className="text-blue-600 dark:text-blue-400">Vencer</span>
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-base">
                Análise de saldos com validade nos próximos 7 dias
                {expiringData?.statistics && (
                  <span className="flex items-center gap-2 mt-2">
                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg text-xs font-bold">
                      {expiringData.statistics.totalRecords} REGISTROS
                    </span>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-xs font-bold">
                      {formatCurrency(expiringData.statistics.totalAmount)} TOTAL
                    </span>
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                placeholder="Localizar por cliente ou vendedor..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full flex h-12 rounded-2xl border-slate-200 dark:border-slate-800 py-2 px-12 text-base shadow-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all bg-white dark:bg-slate-950 placeholder:text-slate-500"
              />
            </div>
            <div className="flex gap-3 h-12">
              <Select
                value={sortBy}
                onValueChange={(value: any) => handleSortChange(value)}
              >
                <SelectTrigger className="w-full sm:w-[220px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl px-6 font-medium">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
                  <SelectItem value="expiresAt">Data de Vencimento</SelectItem>
                  <SelectItem value="amount">Valor do Cashback</SelectItem>
                  <SelectItem value="clientName">Nome do Cliente</SelectItem>
                  <SelectItem value="sellerName">Nome do Vendedor</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="w-12 h-12 shrink-0 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 rounded-2xl"
              >
                {getSortIcon(sortBy) || <SortAsc className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-6 p-6 border rounded-[2rem] bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800">
                  <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div className="h-4 w-1/4 bg-slate-100 dark:bg-slate-900 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : !expiringData?.data || expiringData.data.length === 0 ? (
            <div className="text-center py-24 bg-white/20 dark:bg-transparent">
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-[2.5rem] w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-inner">
                <Clock className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
                {searchTerm ? "Nenhum Match Encontrado" : "Tudo em Ordem"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
                {searchTerm
                  ? "Ajuste os filtros de pesquisa para tentar localizar o cliente desejado."
                  : "Não há saldos de cashback expirando nos próximos 7 dias."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence initial={false}>
                {expiringData.data.map((cashback, index) => (
                  <motion.div
                    key={cashback.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group flex flex-col md:flex-row md:items-center justify-between p-8 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                      <div className="shrink-0 relative">
                        <div className={`h-16 w-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 ${
                          cashback.daysUntilExpiry === 0
                            ? "bg-red-500 shadow-red-500/20"
                            : cashback.daysUntilExpiry <= 2
                            ? "bg-orange-500 shadow-orange-500/20"
                            : "bg-blue-600 shadow-blue-500/20"
                        }`}>
                          <AlertTriangle className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-md">
                           <div className={`h-4 w-4 rounded-full ${
                             cashback.daysUntilExpiry === 0 ? "bg-red-500 animate-pulse" : "bg-blue-500"
                           }`} />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">
                            {cashback.client.name}
                          </p>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            cashback.daysUntilExpiry === 0
                              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                              : cashback.daysUntilExpiry <= 2
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                          }`}>
                            {cashback.daysUntilExpiry === 0
                              ? "Expira Hoje"
                              : cashback.daysUntilExpiry === 1
                              ? "Expira Amanhã"
                              : `${cashback.daysUntilExpiry} Dias Restantes`}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400 font-bold">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-emerald-500" />
                            <span>Venda: <span className="text-slate-900 dark:text-white">{formatCurrency(cashback.purchaseAmount)}</span></span>
                          </div>
                          {cashback.seller && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-blue-500" />
                              <span>Vendedor: <span className="text-slate-900 dark:text-white capitalize">{cashback.seller.name.toLowerCase()}</span></span>
                            </div>
                          )}
                          {cashback.invoiceNumber && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                              <span>NF: {cashback.invoiceNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 md:mt-0 flex items-center md:items-end flex-row md:flex-col justify-between md:justify-center gap-4 border-t md:border-t-0 pt-6 md:pt-0 border-slate-100 dark:border-slate-800">
                      <div className="text-right space-y-1">
                        <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                          {formatCurrency(cashback.cashbackAmount)}
                        </p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Vencimento: {new Date(cashback.expiresAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {expiringData?.pagination && expiringData.pagination.total > itemsPerPage && (
          <div className="px-8 py-10 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50/30 dark:bg-slate-900/30">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Mostrando <span className="text-slate-900 dark:text-white px-1">{Math.min(currentPage * itemsPerPage + 1, expiringData.pagination.total)} - {Math.min((currentPage + 1) * itemsPerPage, expiringData.pagination.total)}</span> de {expiringData.pagination.total} registros
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="h-11 px-8 rounded-2xl border-slate-200 dark:border-slate-800 disabled:opacity-30 font-bold uppercase tracking-widest text-[10px]"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!expiringData.pagination.hasMore}
                className="h-11 px-8 rounded-2xl border-slate-200 dark:border-slate-800 disabled:opacity-30 font-bold uppercase tracking-widest text-[10px]"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
