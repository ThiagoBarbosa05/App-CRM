import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  DollarSign,
  User,
  Hash,
  ArrowRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SaleHistoryItem {
  id: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  invoice: string;
  grossValue: string;
  netValue: string;
  cashbackUsed: string;
  cashbackGenerated: string;
  createdAt: string;
  updatedAt: string;
  sellerName: string;
}

interface SalesHistoryResponse {
  success: boolean;
  data: {
    sales: SaleHistoryItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    statistics: {
      totalSales: number;
      totalGrossValue: string;
      totalNetValue: string;
      totalCashbackUsed: string;
      totalCashbackGenerated: string;
    };
  };
}

interface SalesHistoryFilters {
  search: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  minAmount: string;
  maxAmount: string;
  sortBy: "createdAt" | "grossValue" | "netValue" | "clientName" | "sellerName";
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
}

export function SalesHistory() {
  const [filters, setFilters] = useState<SalesHistoryFilters>({
    search: "",
    startDate: undefined,
    endDate: undefined,
    minAmount: "",
    maxAmount: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    limit: 10,
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);
    return () => clearTimeout(handler);
  }, [filters.search]);

  useEffect(() => {
    if (filters.page > 1) {
      setFilters((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    debouncedSearch,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
    filters.sortBy,
    filters.sortOrder,
  ]);

  const {
    data: salesData,
    isLoading,
    isError,
    error,
  } = useQuery<SalesHistoryResponse>({
    queryKey: [
      "sales-history",
      debouncedSearch,
      filters.startDate?.toISOString(),
      filters.endDate?.toISOString(),
      filters.minAmount,
      filters.maxAmount,
      filters.sortBy,
      filters.sortOrder,
      filters.page,
      filters.limit,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      if (filters.startDate) params.append("startDate", filters.startDate.toISOString().split("T")[0]);
      if (filters.endDate) params.append("endDate", filters.endDate.toISOString().split("T")[0]);
      if (filters.minAmount) params.append("minAmount", filters.minAmount);
      if (filters.maxAmount) params.append("maxAmount", filters.maxAmount);
      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);
      params.append("offset", ((filters.page - 1) * filters.limit).toString());
      params.append("limit", filters.limit.toString());

      const response = await fetch(`/api/sales-history?${params.toString()}`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      return response.json();
    },
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue || 0);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM, yyyy • HH:mm", { locale: ptBR });
  };

  const sales = salesData?.data?.sales || [];
  const pagination = salesData?.data?.pagination;

  return (
    <div className="space-y-8">
      {/* Filtros Premium */}
      <Card className="border-0 shadow-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden rounded-[2rem]">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
        <CardHeader className="relative border-b border-slate-100 dark:border-slate-800/50 px-8 py-6">
          <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Filtros de Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent className="relative p-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Pesquisar por cliente, CPF, vendedor ou nota..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-12 h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 transition-all text-base"
              />
            </div>
            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split("-");
                setFilters(prev => ({
                  ...prev,
                  sortBy: sortBy as SalesHistoryFilters["sortBy"],
                  sortOrder: sortOrder as "asc" | "desc",
                  page: 1,
                }));
              }}
            >
              <SelectTrigger className="h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl px-6 font-bold text-slate-700 dark:text-slate-200">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
                <SelectItem value="createdAt-desc">Mais recentes primeiro</SelectItem>
                <SelectItem value="createdAt-asc">Mais antigos primeiro</SelectItem>
                <SelectItem value="grossValue-desc">Maior valor bruto</SelectItem>
                <SelectItem value="netValue-desc">Maior valor líquido</SelectItem>
                <SelectItem value="clientName-asc">Cliente (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              { label: "De", date: filters.startDate, setter: (d: any) => setFilters(p => ({ ...p, startDate: d })) },
              { label: "Até", date: filters.endDate, setter: (d: any) => setFilters(p => ({ ...p, endDate: d })) }
            ].map((picker, i) => (
              <div key={i} className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{picker.label}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-bold border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800",
                        !picker.date && "text-slate-400"
                      )}
                    >
                      <CalendarIcon className="mr-3 h-4 w-4 text-blue-500" />
                      {picker.date ? format(picker.date, "dd/MM/yyyy") : "Data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl" align="start">
                    <Calendar
                      mode="single"
                      selected={picker.date}
                      onSelect={picker.setter}
                      locale={ptBR}
                      className="rounded-2xl"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ))}

            {[
              { label: "Mínimo (R$)", value: filters.minAmount, setter: (v: string) => setFilters(p => ({ ...p, minAmount: v })) },
              { label: "Máximo (R$)", value: filters.maxAmount, setter: (v: string) => setFilters(p => ({ ...p, maxAmount: v })) }
            ].map((input, i) => (
              <div key={i} className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{input.label}</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={input.value}
                    onChange={(e) => input.setter(e.target.value)}
                    className="h-12 pl-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-emerald-500/5 font-bold"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
               {salesData?.data?.pagination?.totalItems || 0} registros encontrados
             </div>
             <Button
                variant="ghost"
                onClick={() => setFilters({
                  search: "",
                  startDate: undefined,
                  endDate: undefined,
                  minAmount: "",
                  maxAmount: "",
                  sortBy: "createdAt",
                  sortOrder: "desc",
                  page: 1,
                  limit: 10,
                })}
                className="text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl"
              >
                Limpar Todos os Filtros
              </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas Premium */}
      <Card className="border-0 shadow-2xl bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
              <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Data & Hora</TableHead>
              <TableHead className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</TableHead>
              <TableHead className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">NF</TableHead>
              <TableHead className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor Bruto</TableHead>
              <TableHead className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Cashback Utilizado</TableHead>
              <TableHead className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor Líquido</TableHead>
              <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Cashback Gerado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-slate-100 dark:border-slate-800">
                  <TableCell className="p-8"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell className="p-4 text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  <TableCell className="p-4"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  <TableCell className="p-8"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                     <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full">
                       <Search className="w-12 h-12 text-slate-300" />
                     </div>
                     <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhuma venda encontrada</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence mode="popLayout">
                {sales.map((sale, index) => (
                  <motion.tr
                    key={sale.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <TableCell className="py-6 px-8 font-bold text-slate-500 text-xs">
                      {formatDate(sale.createdAt)}
                    </TableCell>
                    <TableCell className="py-6 px-4">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm leading-tight">{sale.clientName}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sale.clientCpf}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-200" />
                          <span className="text-[10px] font-bold text-blue-500/70 uppercase tracking-widest">{sale.sellerName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-6 px-4 text-center">
                      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[10px] px-3 py-1 rounded-lg">
                        {sale.invoice}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-6 px-4 text-right font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                      {formatCurrency(sale.grossValue)}
                    </TableCell>
                    <TableCell className="py-6 px-4 text-right tabular-nums">
                      {parseFloat(sale.cashbackUsed) > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-black text-orange-600 dark:text-orange-400 text-sm">-{formatCurrency(sale.cashbackUsed)}</span>
                          <span className="text-[9px] font-black uppercase text-orange-400 tracking-tighter mt-0.5">Cashback Redimido</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-6 px-4 text-right tabular-nums">
                      <span className="font-black text-slate-900 dark:text-white text-base">
                        {formatCurrency(sale.netValue)}
                      </span>
                    </TableCell>
                    <TableCell className="py-6 px-8 text-right tabular-nums">
                       <div className="flex flex-col items-end">
                          <div className="bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 rounded-xl">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">+{formatCurrency(sale.cashbackGenerated)}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase text-emerald-500 tracking-tighter mt-1 mr-1">Novo Acúmulo</span>
                       </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>

        {/* Paginação Premium */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-8 py-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">
              Página <span className="text-slate-900 dark:text-white">{pagination.currentPage}</span> de {pagination.totalPages}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.currentPage === 1}
                className="h-10 px-6 rounded-xl border-slate-200 dark:border-slate-800 disabled:opacity-30 font-black uppercase tracking-widest text-[10px]"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(p => ({ ...p, page: Math.min(pagination.totalPages, p.page + 1) }))}
                disabled={pagination.currentPage === pagination.totalPages}
                className="h-10 px-6 rounded-xl border-slate-200 dark:border-slate-800 disabled:opacity-30 font-black uppercase tracking-widest text-[10px]"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
