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

  // Debounce da pesquisa
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [filters.search]);

  // Reset da página quando filtros mudam
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

  // Query para buscar histórico de vendas
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

      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }
      if (filters.startDate) {
        params.append(
          "startDate",
          filters.startDate.toISOString().split("T")[0]
        );
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate.toISOString().split("T")[0]);
      }
      if (filters.minAmount) {
        params.append("minAmount", filters.minAmount);
      }
      if (filters.maxAmount) {
        params.append("maxAmount", filters.maxAmount);
      }
      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);
      params.append("offset", ((filters.page - 1) * filters.limit).toString());
      params.append("limit", filters.limit.toString());

      console.log("Fetching sales history with params:", params.toString());
      const response = await fetch(`/api/sales-history?${params.toString()}`);
      if (!response.ok) {
        throw new Error(
          `Erro ao buscar histórico de vendas: ${response.statusText}`
        );
      }
      const data = await response.json();
      console.log("Sales history response:", data);
      return data;
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
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const handleSort = (column: SalesHistoryFilters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder:
        prev.sortBy === column && prev.sortOrder === "asc" ? "desc" : "asc",
      page: 1,
    }));
  };

  const getSortIcon = (column: SalesHistoryFilters["sortBy"]) => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === "asc" ? (
      <SortAsc className="w-4 h-4 ml-1" />
    ) : (
      <SortDesc className="w-4 h-4 ml-1" />
    );
  };

  const sales = salesData?.data?.sales || [];
  const pagination = salesData?.data?.pagination;
  const statistics = salesData?.data?.statistics;

  // Debug: Log the data structure
  if (salesData) {
    console.log("Sales data structure:", {
      success: salesData.success,
      salesCount: sales.length,
      pagination,
      statistics,
    });
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      {/* {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[
            {
              title: "Total de Vendas",
              color: "bg-blue-100 dark:bg-blue-900/30",
            },
            {
              title: "Valor Bruto Total",
              color: "bg-slate-100 dark:bg-slate-800",
            },
            {
              title: "Valor Líquido Total",
              color: "bg-slate-100 dark:bg-slate-800",
            },
            {
              title: "Cashback Utilizado",
              color: "bg-orange-100 dark:bg-orange-900/30",
            },
            {
              title: "Cashback Gerado",
              color: "bg-emerald-100 dark:bg-emerald-900/30",
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className="border-slate-200 dark:border-slate-800 animate-pulse"
            >
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-700" />
              </CardHeader>
              <CardContent className="pb-3">
                <Skeleton className={`h-8 w-20 ${stat.color} rounded`} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : statistics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {statistics.totalSales}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Valor Bruto Total
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(statistics.totalGrossValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Valor Líquido Total
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(statistics.totalNetValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Cashback Utilizado
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(statistics.totalCashbackUsed)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Cashback Gerado
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(statistics.totalCashbackGenerated)}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null} */}

      {/* Filtros */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Filtros de Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha 1: Pesquisa e Ordenação */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Pesquisar por cliente, CPF, telefone, vendedor ou nota fiscal..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="pl-10 border-slate-200 dark:border-slate-800 focus:border-blue-400 dark:focus:border-blue-600 focus:ring-blue-400/10"
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
              <SelectTrigger className="border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">
                  Data (Mais recente)
                </SelectItem>
                <SelectItem value="createdAt-asc">
                  Data (Mais antiga)
                </SelectItem>
                <SelectItem value="grossValue-desc">
                  Valor Bruto (Maior)
                </SelectItem>
                <SelectItem value="grossValue-asc">
                  Valor Bruto (Menor)
                </SelectItem>
                <SelectItem value="netValue-desc">
                  Valor Líquido (Maior)
                </SelectItem>
                <SelectItem value="netValue-asc">
                  Valor Líquido (Menor)
                </SelectItem>
                <SelectItem value="clientName-asc">Cliente (A-Z)</SelectItem>
                <SelectItem value="clientName-desc">Cliente (Z-A)</SelectItem>
                <SelectItem value="sellerName-asc">Vendedor (A-Z)</SelectItem>
                <SelectItem value="sellerName-desc">Vendedor (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: Data e Valores */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
                Data Inicial
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800",
                      !filters.startDate && "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                    {filters.startDate
                      ? format(filters.startDate, "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) =>
                      setFilters((prev) => ({ ...prev, startDate: date }))
                    }
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
                Data Final
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800",
                      !filters.endDate && "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                    {filters.endDate
                      ? format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) =>
                      setFilters((prev) => ({ ...prev, endDate: date }))
                    }
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
                Valor Mínimo
              </label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={filters.minAmount}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, minAmount: e.target.value }))
                }
                className="border-slate-200 dark:border-slate-800 focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-emerald-400/10"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
                Valor Máximo
              </label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={filters.maxAmount}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))
                }
                className="border-slate-200 dark:border-slate-800 focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-emerald-400/10"
              />
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex justify-end gap-2">
            {/* <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch("/api/sales-history?limit=5");
                  const data = await response.json();
                  console.log("Test API response:", data);
                  alert(
                    `API Test: ${data.success ? "Success" : "Failed"} - ${
                      data.data?.sales?.length || 0
                    } sales found`
                  );
                } catch (error) {
                  console.error("Test API error:", error);
                  alert("API Test Failed: " + error);
                }
              }}
            >
              Testar API
            </Button> */}
            <Button
              variant="outline"
              onClick={() => {
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
                });
              }}
              className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-slate-900 dark:text-slate-100">
              Histórico de Vendas
            </CardTitle>
            {pagination && (
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                <span className="font-semibold">{pagination.totalItems}</span>{" "}
                vendas encontradas
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="text-red-600 p-4 text-center">
              <p>Erro ao carregar histórico de vendas: {error?.message}</p>
              <p className="text-sm mt-2">
                Verifique o console para mais detalhes
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-6">
              {/* Loading Header */}
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-32 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-4 w-24 bg-blue-100 dark:bg-blue-900/30" />
              </div>

              {/* Loading Table */}
              <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg">
                {/* Table Header Loading */}
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-9 gap-4 p-4">
                    {[
                      "Data",
                      "Cliente",
                      "CPF",
                      "Telefone",
                      "Nota Fiscal",
                      "Valor Bruto",
                      "Valor Líquido",
                      "Cashback",
                      "Vendedor",
                    ].map((header, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-4 w-16 bg-slate-300 dark:bg-slate-600" />
                        {i < 4 && (
                          <Skeleton className="h-3 w-3 bg-slate-200 dark:bg-slate-700" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Table Rows Loading */}
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-9 gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Data */}
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-700" />
                        <Skeleton className="h-3 w-16 bg-slate-100 dark:bg-slate-800" />
                      </div>

                      {/* Cliente */}
                      <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-700" />

                      {/* CPF */}
                      <Skeleton className="h-4 w-20 bg-slate-100 dark:bg-slate-800" />

                      {/* Telefone */}
                      <Skeleton className="h-4 w-18 bg-slate-100 dark:bg-slate-800" />

                      {/* Nota Fiscal */}
                      <Skeleton className="h-6 w-16 bg-purple-100 dark:bg-purple-900/30 rounded-full" />

                      {/* Valor Bruto */}
                      <Skeleton className="h-4 w-20 bg-emerald-100 dark:bg-emerald-900/30" />

                      {/* Valor Líquido */}
                      <Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-700" />

                      {/* Cashback */}
                      <div className="space-y-1">
                        {i % 3 === 0 && (
                          <Skeleton className="h-3 w-16 bg-orange-100 dark:bg-orange-900/30" />
                        )}
                        {i % 2 === 0 && (
                          <Skeleton className="h-3 w-18 bg-emerald-100 dark:bg-emerald-900/30" />
                        )}
                      </div>

                      {/* Vendedor */}
                      <Skeleton className="h-4 w-20 bg-blue-100 dark:bg-blue-900/30" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Loading Pagination */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-700" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                  <Skeleton className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center font-semibold text-slate-700 dark:text-slate-300">
                        Data
                        {getSortIcon("createdAt")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("clientName")}
                    >
                      <div className="flex items-center font-semibold text-slate-700 dark:text-slate-300">
                        Cliente
                        {getSortIcon("clientName")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                      CPF
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                      Telefone
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                      Nota Fiscal
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("grossValue")}
                    >
                      <div className="flex items-center font-semibold text-slate-700 dark:text-slate-300">
                        Valor Bruto
                        {getSortIcon("grossValue")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("netValue")}
                    >
                      <div className="flex items-center font-semibold text-slate-700 dark:text-slate-300">
                        Valor Líquido
                        {getSortIcon("netValue")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                      Cashback
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("sellerName")}
                    >
                      <div className="flex items-center font-semibold text-slate-700 dark:text-slate-300">
                        Vendedor
                        {getSortIcon("sellerName")}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Nenhuma venda encontrada com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(sale.createdAt)}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                          {sale.clientName}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                          {sale.clientCpf}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                          {sale.clientPhone}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          >
                            {sale.invoice}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(sale.grossValue)}
                        </TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(sale.netValue)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            {parseFloat(sale.cashbackUsed) > 0 && (
                              <div className="text-orange-600 dark:text-orange-400 font-semibold">
                                Usado: {formatCurrency(sale.cashbackUsed)}
                              </div>
                            )}
                            {parseFloat(sale.cashbackGenerated) > 0 && (
                              <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Gerado: {formatCurrency(sale.cashbackGenerated)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-blue-600 dark:text-blue-400">
                          {sale.sellerName}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Paginação */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Página{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {pagination.currentPage}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {pagination.totalPages}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  disabled={pagination.currentPage === 1}
                  className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      page: Math.min(pagination.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
