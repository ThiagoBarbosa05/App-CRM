import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  DollarSign,
  ArrowRight,
  Trash2,
  Phone,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Info,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "administrador" || user?.role === "admin";

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
      if (debouncedSearch.trim())
        params.append("search", debouncedSearch.trim());
      if (filters.startDate)
        params.append(
          "startDate",
          filters.startDate.toISOString().split("T")[0],
        );
      if (filters.endDate)
        params.append("endDate", filters.endDate.toISOString().split("T")[0]);
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

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email || "",
        },
      });
      if (!response.ok) {
        try {
          const err = await response.json();
          throw new Error(err.message || "Erro ao excluir venda");
        } catch {
          throw new Error("Erro ao excluir venda");
        }
      }
      try {
        return await response.json();
      } catch {
        return { success: true };
      }
    },
    onSuccess: () => {
      toast({
        title: "Venda excluída",
        description: "A venda foi removida com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashback-transactions"],
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a venda.",
        variant: "destructive",
      });
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
    return format(new Date(dateString), "dd MMM, yyyy", { locale: ptBR });
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm", { locale: ptBR });
  };

  const formatRelativeDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  const sales = salesData?.data?.sales || [];
  const pagination = salesData?.data?.pagination;
  const statistics = salesData?.data?.statistics;

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Filtros */}
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
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="pl-12 h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 transition-all text-base"
                />
              </div>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-");
                  setFilters((prev) => ({
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
                  <SelectItem value="createdAt-desc">
                    Mais recentes primeiro
                  </SelectItem>
                  <SelectItem value="createdAt-asc">
                    Mais antigos primeiro
                  </SelectItem>
                  <SelectItem value="grossValue-desc">
                    Maior valor bruto
                  </SelectItem>
                  <SelectItem value="netValue-desc">
                    Maior valor líquido
                  </SelectItem>
                  <SelectItem value="clientName-asc">Cliente (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              {[
                {
                  label: "De",
                  date: filters.startDate,
                  setter: (d: Date | undefined) =>
                    setFilters((p) => ({ ...p, startDate: d })),
                },
                {
                  label: "Até",
                  date: filters.endDate,
                  setter: (d: Date | undefined) =>
                    setFilters((p) => ({ ...p, endDate: d })),
                },
              ].map((picker, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    {picker.label}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-start text-left font-bold border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800",
                          !picker.date && "text-slate-400",
                        )}
                      >
                        <CalendarIcon className="mr-3 h-4 w-4 text-blue-500" />
                        {picker.date
                          ? format(picker.date, "dd/MM/yyyy")
                          : "Data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl"
                      align="start"
                    >
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
                {
                  label: "Mínimo (R$)",
                  value: filters.minAmount,
                  setter: (v: string) =>
                    setFilters((p) => ({ ...p, minAmount: v })),
                },
                {
                  label: "Máximo (R$)",
                  value: filters.maxAmount,
                  setter: (v: string) =>
                    setFilters((p) => ({ ...p, maxAmount: v })),
                },
              ].map((input, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    {input.label}
                  </label>
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
                {salesData?.data?.pagination?.totalItems || 0} registros
                encontrados
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  setFilters({
                    search: "",
                    startDate: undefined,
                    endDate: undefined,
                    minAmount: "",
                    maxAmount: "",
                    sortBy: "createdAt",
                    sortOrder: "desc",
                    page: 1,
                    limit: 10,
                  })
                }
                className="text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl"
              >
                Limpar Todos os Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Legenda rápida */}
        <div className="flex flex-wrap gap-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Valor da Compra
            </span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-300 self-center" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              (-) Cashback Usado = Desconto
            </span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-300 self-center" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Cobrado
            </span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-300 self-center" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              (+) Pontos Acumulados
            </span>
          </div>
        </div>

        {/* Tabela de Vendas */}
        <Card className="border-0 shadow-2xl bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  {/* Data */}
                  <TableHead className="py-5 px-6 min-w-[130px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Data
                      </span>
                    </div>
                  </TableHead>

                  {/* Cliente */}
                  <TableHead className="py-5 px-4 min-w-[200px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Cliente / Vendedor
                    </span>
                  </TableHead>

                  {/* NF */}
                  <TableHead className="py-5 px-4 text-center min-w-[80px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center gap-1 cursor-help">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            NF
                          </span>
                          <Info className="w-3 h-3 text-slate-300" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Número da Nota Fiscal
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>

                  {/* Valor da Compra */}
                  <TableHead className="py-5 px-4 text-right min-w-[130px]">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Valor da Compra
                        </span>
                      </div>
                      <span className="text-[9px] font-medium text-slate-300 uppercase tracking-wide">
                        valor bruto
                      </span>
                    </div>
                  </TableHead>

                  {/* Cashback Usado */}
                  <TableHead className="py-5 px-4 text-right min-w-[140px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-end gap-0.5 cursor-help">
                          <div className="flex items-center gap-1.5">
                            <TrendingDown className="w-3 h-3 text-orange-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                              Cashback Usado
                            </span>
                          </div>
                          <span className="text-[9px] font-medium text-orange-300/60 uppercase tracking-wide">
                            desconto aplicado
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="text-xs max-w-[200px] text-center"
                      >
                        Saldo de cashback que o cliente usou como desconto nesta
                        compra
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>

                  {/* Total Cobrado */}
                  <TableHead className="py-5 px-4 text-right min-w-[130px]">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                          Total Cobrado
                        </span>
                      </div>
                      <span className="text-[9px] font-medium text-blue-300/60 uppercase tracking-wide">
                        após desconto
                      </span>
                    </div>
                  </TableHead>

                  {/* Recompensa Gerada */}
                  <TableHead className="py-5 px-6 text-right min-w-[150px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-end gap-0.5 cursor-help">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                              Recompensa
                            </span>
                          </div>
                          <span className="text-[9px] font-medium text-emerald-400/60 uppercase tracking-wide">
                            cashback acumulado
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="text-xs max-w-[200px] text-center"
                      >
                        Valor de cashback que o cliente ganhou nesta compra para
                        usar depois
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>

                  {/* Ações (apenas admin) */}
                  {isAdmin && (
                    <TableHead className="py-5 px-4 text-center w-16">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow
                      key={i}
                      className="border-slate-100 dark:border-slate-800"
                    >
                      <TableCell className="py-5 px-6">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="py-5 px-4">
                        <Skeleton className="h-4 w-44" />
                      </TableCell>
                      <TableCell className="py-5 px-4 text-center">
                        <Skeleton className="h-6 w-14 mx-auto rounded-lg" />
                      </TableCell>
                      <TableCell className="py-5 px-4">
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                      <TableCell className="py-5 px-4">
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                      <TableCell className="py-5 px-4">
                        <Skeleton className="h-5 w-24 ml-auto" />
                      </TableCell>
                      <TableCell className="py-5 px-6">
                        <Skeleton className="h-7 w-28 ml-auto rounded-xl" />
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="py-5 px-4">
                          <Skeleton className="h-8 w-8 mx-auto rounded-lg" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : sales.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 8 : 7}
                      className="h-64 text-center"
                    >
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full">
                          <Search className="w-12 h-12 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                          Nenhuma venda encontrada
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {sales.map((sale, index) => {
                      const cashbackUsed = parseFloat(sale.cashbackUsed);
                      const cashbackGenerated = parseFloat(
                        sale.cashbackGenerated,
                      );
                      const grossValue = parseFloat(sale.grossValue);
                      const netValue = parseFloat(sale.netValue);
                      const hasCashbackUsed = cashbackUsed > 0;
                      const hasCashbackGenerated = cashbackGenerated > 0;
                      const cashbackRate =
                        grossValue > 0
                          ? (
                              (cashbackGenerated /
                                (hasCashbackUsed ? netValue : grossValue)) *
                              100
                            ).toFixed(1)
                          : "0";

                      return (
                        <motion.tr
                          key={sale.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="group border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Data */}
                          <TableCell className="py-5 px-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-slate-700 dark:text-slate-300 text-sm tabular-nums">
                                {formatDate(sale.createdAt)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                {formatTime(sale.createdAt)}
                              </span>
                              <span className="text-[9px] font-medium text-slate-300 dark:text-slate-600 mt-0.5">
                                {formatRelativeDate(sale.createdAt)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Cliente */}
                          <TableCell className="py-5 px-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm leading-tight">
                                {sale.clientName}
                              </span>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {sale.clientCpf && (
                                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                    {sale.clientCpf}
                                  </span>
                                )}
                                {sale.clientPhone && (
                                  <>
                                    <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5" />
                                      {sale.clientPhone}
                                    </span>
                                  </>
                                )}
                              </div>
                              {sale.sellerName && (
                                <Badge
                                  variant="secondary"
                                  className="w-fit bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-[9px] px-2 py-0.5 rounded-md border-0"
                                >
                                  Vendedor: {sale.sellerName}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Nota Fiscal */}
                          <TableCell className="py-5 px-4 text-center">
                            {sale.invoice ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <ReceiptText className="w-3 h-3 text-slate-400" />
                                <span className="font-black text-slate-600 dark:text-slate-400 text-[11px] tabular-nums">
                                  {sale.invoice}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-200 dark:text-slate-700 text-sm">
                                —
                              </span>
                            )}
                          </TableCell>

                          {/* Valor da Compra */}
                          <TableCell className="py-5 px-4 text-right tabular-nums">
                            <span className="font-bold text-slate-600 dark:text-slate-400 text-sm">
                              {formatCurrency(sale.grossValue)}
                            </span>
                          </TableCell>

                          {/* Cashback Usado */}
                          <TableCell className="py-5 px-4 text-right tabular-nums">
                            {hasCashbackUsed ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-lg">
                                  <TrendingDown className="w-3 h-3 text-orange-500" />
                                  <span className="font-black text-orange-600 dark:text-orange-400 text-sm">
                                    -{formatCurrency(sale.cashbackUsed)}
                                  </span>
                                </div>
                                <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wide">
                                  desconto aplicado
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-wide">
                                não usado
                              </span>
                            )}
                          </TableCell>

                          {/* Total Cobrado */}
                          <TableCell className="py-5 px-4 text-right tabular-nums">
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={cn(
                                  "font-black text-base",
                                  hasCashbackUsed
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-slate-900 dark:text-white",
                                )}
                              >
                                {formatCurrency(sale.netValue)}
                              </span>
                              {hasCashbackUsed && (
                                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">
                                  -{formatCurrency(cashbackUsed)} de desconto
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Recompensa Gerada */}
                          <TableCell className="py-5 px-6 text-right tabular-nums">
                            {hasCashbackGenerated ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1 bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1.5 rounded-xl">
                                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                    +{formatCurrency(sale.cashbackGenerated)}
                                  </span>
                                </div>
                                <span className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-wide">
                                  {cashbackRate}% acumulado
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-wide">
                                sem recompensa
                              </span>
                            )}
                          </TableCell>

                          {/* Ações */}
                          {isAdmin && (
                            <TableCell className="py-5 px-4 text-center">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 text-slate-400 transition-all"
                                    disabled={deleteSaleMutation.isPending}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Excluir venda?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação removerá a venda de{" "}
                                      <strong>{sale.clientName}</strong> no
                                      valor de{" "}
                                      <strong>
                                        {formatCurrency(sale.grossValue)}
                                      </strong>{" "}
                                      e estornará o cashback associado. Esta
                                      operação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                                      onClick={() =>
                                        deleteSaleMutation.mutate(sale.id)
                                      }
                                    >
                                      Sim, excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          )}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </TableBody>

              {/* Linha de Totais */}
              {!isLoading && statistics && sales.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/50">
                    <td className="py-4 px-6" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Totais desta página
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[9px] px-2 py-0.5 rounded-md border-0"
                        >
                          {pagination?.totalItems ?? sales.length} vendas
                        </Badge>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right tabular-nums">
                      <span className="font-black text-slate-600 dark:text-slate-400 text-sm">
                        {formatCurrency(statistics.totalGrossValue)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right tabular-nums">
                      {parseFloat(statistics.totalCashbackUsed) > 0 ? (
                        <span className="font-black text-orange-600 dark:text-orange-400 text-sm">
                          -{formatCurrency(statistics.totalCashbackUsed)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right tabular-nums">
                      <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                        {formatCurrency(statistics.totalNetValue)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right tabular-nums">
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        +{formatCurrency(statistics.totalCashbackGenerated)}
                      </span>
                    </td>
                    {isAdmin && <td />}
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>

          {/* Paginação */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                Página{" "}
                <span className="text-slate-900 dark:text-white">
                  {pagination.currentPage}
                </span>{" "}
                de {pagination.totalPages}
                <span className="ml-3 text-slate-300 dark:text-slate-700">
                  ({pagination.totalItems} registros)
                </span>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                  }
                  disabled={pagination.currentPage === 1}
                  className="h-10 px-6 rounded-xl border-slate-200 dark:border-slate-800 disabled:opacity-30 font-black uppercase tracking-widest text-[10px]"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((p) => ({
                      ...p,
                      page: Math.min(pagination.totalPages, p.page + 1),
                    }))
                  }
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="h-10 px-6 rounded-xl border-slate-200 dark:border-slate-800 disabled:opacity-30 font-black uppercase tracking-widest text-[10px]"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}
