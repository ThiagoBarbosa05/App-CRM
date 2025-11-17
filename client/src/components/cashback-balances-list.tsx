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
  Wallet,
  User,
  Trash2,
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
import { Avatar, AvatarFallback } from "./ui/avatar";

interface CashbackBalanceItem {
  id: string;
  clientId: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  clientEmail: string;
  currentBalance: string;
  totalEarned: string;
  totalUsed: string;
  lastUpdated: string;
  sellerId: string | null;
  sellerName: string | null;
  sellerEmail: string | null;
}

interface CashbackBalancesResponse {
  success: boolean;
  data: {
    balances: CashbackBalanceItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    statistics: {
      totalClients: number;
      totalCurrentBalance: string;
      totalEarnedEver: string;
      totalUsedEver: string;
      averageBalance: string;
    };
  };
}

interface CashbackBalancesFilters {
  search: string;
  userId: string;
  minBalance: string;
  maxBalance: string;
  sortBy:
    | "clientName"
    | "currentBalance"
    | "totalEarned"
    | "totalUsed"
    | "sellerName"
    | "createdAt";
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CashbackBalancesListProps {
  formatCurrency: (value: string | number) => string;
  users?: User[];
  onDeleteBalance?: (balanceId: string) => void;
  isAdmin?: boolean;
}

/**
 * Componente CashbackBalancesList - Lista completa de saldos de cashback
 *
 * Melhorias implementadas:
 * - Design moderno com gradientes temáticos e bordas coloridas
 * - Responsividade completa: tabela para desktop/tablet, cards para mobile
 * - Skeletons sofisticados com cores temáticas durante o carregamento
 * - Filtros aprimorados com labels e melhor organização
 * - Paginação moderna com números de página
 * - Estados vazios melhorados com ícones e mensagens
 * - Suporte completo ao modo escuro
 * - Hover states e transições suaves
 * - Tipografia hierárquica e consistente
 */
export function CashbackBalancesList({
  formatCurrency,
  users = [],
  onDeleteBalance,
  isAdmin = false,
}: CashbackBalancesListProps) {
  const [filters, setFilters] = useState<CashbackBalancesFilters>({
    search: "",
    userId: "all",
    minBalance: "",
    maxBalance: "",
    sortBy: "currentBalance",
    sortOrder: "desc",
    page: 1,
    limit: 20,
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
    filters.userId,
    filters.minBalance,
    filters.maxBalance,
    filters.sortBy,
    filters.sortOrder,
  ]);

  // Query para buscar saldos de cashback
  const {
    data: balancesData,
    isLoading,
    isError,
    error,
  } = useQuery<CashbackBalancesResponse>({
    queryKey: [
      "cashback-balances-list",
      debouncedSearch,
      filters.userId,
      filters.minBalance,
      filters.maxBalance,
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
      if (filters.userId !== "all") {
        params.append("userId", filters.userId);
      }
      if (filters.minBalance) {
        params.append("minBalance", filters.minBalance);
      }
      if (filters.maxBalance) {
        params.append("maxBalance", filters.maxBalance);
      }
      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);
      params.append("page", filters.page.toString());
      params.append("limit", filters.limit.toString());

      console.log("Fetching cashback balances with params:", params.toString());
      const response = await fetch(
        `/api/cashback-settings/balances?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(
          `Erro ao buscar saldos de cashback: ${response.statusText}`
        );
      }
      const data = await response.json();
      console.log("Cashback balances response:", data);
      return data;
    },
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const handleSort = (column: CashbackBalancesFilters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder:
        prev.sortBy === column && prev.sortOrder === "asc" ? "desc" : "asc",
      page: 1,
    }));
  };

  const getSortIcon = (column: CashbackBalancesFilters["sortBy"]) => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === "asc" ? (
      <SortAsc className="w-4 h-4 ml-1" />
    ) : (
      <SortDesc className="w-4 h-4 ml-1" />
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const balances = balancesData?.data?.balances || [];
  const pagination = balancesData?.data?.pagination;
  const statistics = balancesData?.data?.statistics;

  return (
    <div className="space-y-6 mt-5">
      {/* Estatísticas */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => {
            const colors = [
              "bg-slate-200 dark:bg-slate-800",
              "bg-emerald-100 dark:bg-emerald-900/20",
              "bg-blue-100 dark:bg-blue-900/20",
              "bg-orange-100 dark:bg-orange-900/20",
              "bg-purple-100 dark:bg-purple-900/20",
            ];
            return (
              <Card
                key={i}
                className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className={`h-4 w-4 rounded ${colors[i]}`} />
                    <Skeleton className={`h-4 w-24 ${colors[i]}`} />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <Skeleton className={`h-8 w-20 ${colors[i]}`} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : statistics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <User className="h-4 w-4" />
                Total de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {statistics.totalClients.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Saldo Total Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(statistics.totalCurrentBalance)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-blue-500"></div>
                Total Acumulado
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(statistics.totalEarnedEver)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-orange-500"></div>
                Total Utilizado
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                {formatCurrency(statistics.totalUsedEver)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-purple-500"></div>
                Saldo Médio
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {formatCurrency(statistics.averageBalance)}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Filtros */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Filter className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            Filtros de Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Linha 1: Pesquisa e Vendedor */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Pesquisa Geral
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="Cliente, CPF, telefone, email ou vendedor..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="pl-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Vendedor
              </label>
              <Select
                value={filters.userId}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, userId: value, page: 1 }));
                }}
              >
                <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Filtrar por vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Saldos e Ordenação */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Saldo Mínimo
              </label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={filters.minBalance}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    minBalance: e.target.value,
                  }))
                }
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-slate-400 dark:focus:border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Saldo Máximo
              </label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={filters.maxBalance}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    maxBalance: e.target.value,
                  }))
                }
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-slate-400 dark:focus:border-slate-600"
              />
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Ordenar por
              </label>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-");
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: sortBy as CashbackBalancesFilters["sortBy"],
                    sortOrder: sortOrder as "asc" | "desc",
                    page: 1,
                  }));
                }}
              >
                <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currentBalance-desc">
                    Saldo Atual (Maior)
                  </SelectItem>
                  <SelectItem value="currentBalance-asc">
                    Saldo Atual (Menor)
                  </SelectItem>
                  <SelectItem value="totalEarned-desc">
                    Total Acumulado (Maior)
                  </SelectItem>
                  <SelectItem value="totalEarned-asc">
                    Total Acumulado (Menor)
                  </SelectItem>
                  <SelectItem value="clientName-asc">Cliente (A-Z)</SelectItem>
                  <SelectItem value="clientName-desc">Cliente (Z-A)</SelectItem>
                  <SelectItem value="sellerName-asc">Vendedor (A-Z)</SelectItem>
                  <SelectItem value="sellerName-desc">
                    Vendedor (Z-A)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  search: "",
                  userId: "all",
                  minBalance: "",
                  maxBalance: "",
                  sortBy: "currentBalance",
                  sortOrder: "desc",
                  page: 1,
                  limit: 20,
                });
              }}
              className="text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Saldos */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              Saldos de Cashback
            </CardTitle>
            {!isLoading && pagination && (
              <Badge
                variant="outline"
                className="text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
              >
                {pagination.totalItems.toLocaleString()} clientes encontrados
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="text-center py-12">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg p-6 max-w-md mx-auto">
                <div className="text-red-600 dark:text-red-400 mb-2">
                  <svg
                    className="w-8 h-8 mx-auto mb-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  Erro ao carregar saldos de cashback
                </p>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  {error?.message}
                </p>
                <p className="text-xs text-red-500 dark:text-red-600 mt-2">
                  Verifique o console para mais detalhes
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {/* Skeleton da tabela */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {/* Header skeleton */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-7 gap-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-4 bg-slate-200 dark:bg-slate-800"
                      />
                    ))}
                  </div>
                </div>
                {/* Rows skeleton */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0"
                  >
                    <div className="grid grid-cols-7 gap-4 items-center">
                      {/* Cliente */}
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
                        <Skeleton className="h-3 w-20 bg-slate-100 dark:bg-slate-800/50" />
                      </div>
                      {/* Contato */}
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-20 bg-slate-200 dark:bg-slate-800" />
                        <Skeleton className="h-3 w-24 bg-slate-100 dark:bg-slate-800/50" />
                      </div>
                      {/* Saldo Atual */}
                      <Skeleton className="h-6 w-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full" />
                      {/* Total Acumulado */}
                      <Skeleton className="h-4 w-16 bg-blue-100 dark:bg-blue-900/20" />
                      {/* Total Utilizado */}
                      <Skeleton className="h-4 w-16 bg-orange-100 dark:bg-orange-900/20" />
                      {/* Vendedor */}
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-800" />
                          <Skeleton className="h-2 w-20 bg-slate-100 dark:bg-slate-800/50" />
                        </div>
                      </div>
                      {/* Data */}
                      <Skeleton className="h-3 w-20 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Versão Desktop/Tablet - Tabela */}
              <div className="hidden sm:block border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                          onClick={() => handleSort("clientName")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Cliente
                            {getSortIcon("clientName")}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                          Contato
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                          onClick={() => handleSort("currentBalance")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Saldo Atual
                            {getSortIcon("currentBalance")}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors hidden lg:table-cell"
                          onClick={() => handleSort("totalEarned")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Total Acumulado
                            {getSortIcon("totalEarned")}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors hidden lg:table-cell"
                          onClick={() => handleSort("totalUsed")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Total Utilizado
                            {getSortIcon("totalUsed")}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors hidden md:table-cell"
                          onClick={() => handleSort("sellerName")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Vendedor
                            {getSortIcon("sellerName")}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                          Última Atualização
                        </TableHead>
                        {isAdmin && onDeleteBalance && (
                          <TableHead className="w-[60px] font-semibold text-slate-700 dark:text-slate-300">
                            Ações
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={isAdmin ? 8 : 7}
                            className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/20"
                          >
                            <div className="flex flex-col items-center space-y-4">
                              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                                <Wallet className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                              </div>
                              <div className="text-slate-600 dark:text-slate-400">
                                <p className="font-semibold text-lg mb-1">
                                  Nenhum saldo encontrado
                                </p>
                                <p className="text-sm">
                                  Tente ajustar os filtros de pesquisa
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        balances.map((balance) => (
                          <TableRow
                            key={balance.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors border-b border-slate-100 dark:border-slate-800/50"
                          >
                            <TableCell className="py-4">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {balance.clientName}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                                  {balance.clientCpf}
                                </div>
                                {/* Mostrar contato em mobile */}
                                <div className="sm:hidden space-y-1">
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {balance.clientPhone}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-500 truncate">
                                    {balance.clientEmail}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm py-4 hidden sm:table-cell">
                              <div className="space-y-1">
                                <div className="text-slate-700 dark:text-slate-300">
                                  {balance.clientPhone}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                  {balance.clientEmail}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge
                                variant={
                                  parseFloat(balance.currentBalance) > 0
                                    ? "default"
                                    : "secondary"
                                }
                                className={`font-semibold text-xs px-2 py-1 ${
                                  parseFloat(balance.currentBalance) > 0
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {formatCurrency(balance.currentBalance)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-blue-600 dark:text-blue-400 py-4 hidden lg:table-cell">
                              {formatCurrency(balance.totalEarned)}
                            </TableCell>
                            <TableCell className="font-semibold text-orange-600 dark:text-orange-400 py-4 hidden lg:table-cell">
                              {formatCurrency(balance.totalUsed)}
                            </TableCell>
                            <TableCell className="py-4 hidden md:table-cell">
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-800">
                                  <AvatarFallback className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {balance.sellerName ? (
                                      getInitials(balance.sellerName)
                                    ) : (
                                      <User className="h-4 w-4" />
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-sm min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {balance.sellerName || "Não atribuído"}
                                  </div>
                                  {balance.sellerEmail && (
                                    <div className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[150px]">
                                      {balance.sellerEmail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-slate-400 py-4 hidden xl:table-cell">
                              {formatDate(balance.lastUpdated)}
                            </TableCell>
                            {isAdmin && onDeleteBalance && (
                              <TableCell className="py-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteBalance(balance.id)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
                                  title="Excluir saldo (apenas administradores)"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Versão Mobile - Cards */}
              <div className="sm:hidden space-y-4">
                {balances.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <Wallet className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-lg mb-1">
                          Nenhum saldo encontrado
                        </p>
                        <p className="text-sm">
                          Tente ajustar os filtros de pesquisa
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  balances.map((balance) => (
                    <Card
                      key={balance.id}
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Header com Cliente e Saldo */}
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {balance.clientName}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                              {balance.clientCpf}
                            </p>
                          </div>
                          <Badge
                            variant={
                              parseFloat(balance.currentBalance) > 0
                                ? "default"
                                : "secondary"
                            }
                            className={`font-semibold text-xs px-2 py-1 ${
                              parseFloat(balance.currentBalance) > 0
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {formatCurrency(balance.currentBalance)}
                          </Badge>
                        </div>

                        {/* Contato */}
                        <div className="space-y-1">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {balance.clientPhone}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {balance.clientEmail}
                          </p>
                        </div>

                        {/* Estatísticas */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              Total Acumulado
                            </p>
                            <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                              {formatCurrency(balance.totalEarned)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              Total Utilizado
                            </p>
                            <p className="font-semibold text-orange-600 dark:text-orange-400 text-sm">
                              {formatCurrency(balance.totalUsed)}
                            </p>
                          </div>
                        </div>

                        {/* Vendedor e Data */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6 border border-slate-200 dark:border-slate-800">
                              <AvatarFallback className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {balance.sellerName ? (
                                  getInitials(balance.sellerName)
                                ) : (
                                  <User className="h-3 w-3" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                              {balance.sellerName || "Não atribuído"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {format(new Date(balance.lastUpdated), "dd/MM/yy", {
                              locale: ptBR,
                            })}
                          </div>
                          {isAdmin && onDeleteBalance && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteBalance(balance.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 h-6 w-6 p-0"
                              title="Excluir saldo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}

          {/* Paginação */}
          {!isLoading && pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 gap-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Página {pagination.currentPage.toLocaleString()} de{" "}
                {pagination.totalPages.toLocaleString()}
                <span className="ml-2 text-slate-500 dark:text-slate-500">
                  ({pagination.totalItems.toLocaleString()} registros)
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
                  className="text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>

                {/* Números das páginas (apenas em telas maiores) */}
                <div className="hidden md:flex items-center space-x-1">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else {
                        const current = pagination.currentPage;
                        if (current <= 3) {
                          pageNum = i + 1;
                        } else if (current >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = current - 2 + i;
                        }
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            pagination.currentPage === pageNum
                              ? "default"
                              : "ghost"
                          }
                          size="sm"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, page: pageNum }))
                          }
                          className={`w-8 h-8 p-0 text-xs ${
                            pagination.currentPage === pageNum
                              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                  )}
                </div>

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
                  className="text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  <span className="hidden sm:inline">Próxima</span>
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
