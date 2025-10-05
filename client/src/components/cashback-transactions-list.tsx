import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Receipt,
  DollarSign,
  Percent,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CashbackTransaction {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  clientEmail: string;
  purchaseAmount: string;
  cashbackAmount: string;
  cashbackRate: string;
  status: "pending" | "approved" | "paid" | "cancelled";
  saleDate: string | null;
  expiresAt: string;
  invoiceNumber: string | null;
  notes: string | null;
  processedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  processedAt: string | null;
  responsibleUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface CashbackTransactionsStatistics {
  totalTransactions: number;
  totalPurchaseAmount: string;
  totalCashbackAmount: string;
  avgCashbackRate: string;
  statusCounts: {
    pending: number;
    approved: number;
    paid: number;
    cancelled: number;
  };
}

interface CashbackTransactionsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface CashbackTransactionsResponse {
  success: boolean;
  data: {
    transactions: CashbackTransaction[];
    pagination: CashbackTransactionsPagination;
    statistics: CashbackTransactionsStatistics;
  };
}

interface CashbackTransactionsFilters {
  search: string;
  status: string;
  userId: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  sortBy:
    | "clientName"
    | "cashbackAmount"
    | "purchaseAmount"
    | "cashbackRate"
    | "saleDate"
    | "status"
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

interface CashbackTransactionsListProps {
  formatCurrency: (value: string | number) => string;
  users?: User[];
}

/**
 * Componente CashbackTransactionsList - Lista completa de transações de cashback
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
export function CashbackTransactionsList({
  formatCurrency,
  users = [],
}: CashbackTransactionsListProps) {
  const [filters, setFilters] = useState<CashbackTransactionsFilters>({
    search: "",
    status: "all",
    userId: "all",
    startDate: "",
    endDate: "",
    minAmount: "",
    maxAmount: "",
    sortBy: "createdAt",
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
    filters.status,
    filters.userId,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
    filters.sortBy,
    filters.sortOrder,
  ]);

  // Query para buscar transações
  const {
    data: transactionsData,
    isLoading,
    isError,
    error,
  } = useQuery<CashbackTransactionsResponse>({
    queryKey: [
      "cashback-transactions-list",
      debouncedSearch,
      filters.status,
      filters.userId,
      filters.startDate,
      filters.endDate,
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
      if (filters.status !== "all") {
        params.append("status", filters.status);
      }
      if (filters.userId !== "all") {
        params.append("userId", filters.userId);
      }
      if (filters.startDate) {
        params.append("startDate", filters.startDate);
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate);
      }
      if (filters.minAmount) {
        params.append("minAmount", filters.minAmount);
      }
      if (filters.maxAmount) {
        params.append("maxAmount", filters.maxAmount);
      }

      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);
      params.append("page", filters.page.toString());
      params.append("limit", filters.limit.toString());

      const response = await fetch(`/api/cashback-transactions-list?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao buscar transações");
      }

      return response.json();
    },
    staleTime: 30000, // Cache por 30 segundos
    refetchOnWindowFocus: false,
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const formatDateOnly = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const handleSort = (column: CashbackTransactionsFilters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder:
        prev.sortBy === column && prev.sortOrder === "asc" ? "desc" : "asc",
      page: 1,
    }));
  };

  const getSortIcon = (column: CashbackTransactionsFilters["sortBy"]) => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === "asc" ? (
      <SortAsc className="w-4 h-4 ml-1" />
    ) : (
      <SortDesc className="w-4 h-4 ml-1" />
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: "Pendente",
        variant: "secondary" as const,
        icon: Clock,
        className:
          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30",
      },
      approved: {
        label: "Aprovado",
        variant: "default" as const,
        icon: CheckCircle,
        className:
          "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30",
      },
      paid: {
        label: "Pago",
        variant: "default" as const,
        icon: CheckCircle,
        className:
          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30",
      },
      cancelled: {
        label: "Cancelado",
        variant: "destructive" as const,
        icon: XCircle,
        className:
          "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge
        variant={config.variant}
        className={`${config.className} flex items-center gap-1 font-medium text-xs px-2 py-1`}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const transactions = transactionsData?.data?.transactions || [];
  const pagination = transactionsData?.data?.pagination;
  const statistics = transactionsData?.data?.statistics;

  return (
    <div className="space-y-6 mt-5">
      {/* Estatísticas */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => {
            const colors = [
              "bg-slate-200 dark:bg-slate-800",
              "bg-blue-100 dark:bg-blue-900/20",
              "bg-emerald-100 dark:bg-emerald-900/20",
              "bg-purple-100 dark:bg-purple-900/20",
              "bg-amber-100 dark:bg-amber-900/20",
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
                <Receipt className="w-4 h-4" />
                Total Transações
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {statistics.totalTransactions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Compras
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(statistics.totalPurchaseAmount)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Total Cashback
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(statistics.totalCashbackAmount)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Taxa Média
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {parseFloat(statistics.avgCashbackRate).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800/30 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Pendentes:
                </span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {statistics.statusCounts.pending}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Aprovados:
                </span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {statistics.statusCounts.approved}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Pagos:
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {statistics.statusCounts.paid}
                </span>
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
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Linha 1: Busca e Status */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Buscar Transações
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
                <Input
                  placeholder="Nome, CPF, telefone, email ou nº da nota..."
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
                Status da Transação
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, status: value, page: 1 }));
                }}
              >
                <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Filtrar por status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Vendedor e Período */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Vendedor Responsável
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
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Data Inicial
                </label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Linha 3: Valores e Ordenação */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Cashback Mínimo
              </label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={filters.minAmount}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    minAmount: e.target.value,
                  }))
                }
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-slate-400 dark:focus:border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Cashback Máximo
              </label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={filters.maxAmount}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    maxAmount: e.target.value,
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
                    sortBy: sortBy as CashbackTransactionsFilters["sortBy"],
                    sortOrder: sortOrder as "asc" | "desc",
                    page: 1,
                  }));
                }}
              >
                <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Mais Recentes</SelectItem>
                  <SelectItem value="createdAt-asc">Mais Antigas</SelectItem>
                  <SelectItem value="cashbackAmount-desc">
                    Maior Cashback
                  </SelectItem>
                  <SelectItem value="cashbackAmount-asc">
                    Menor Cashback
                  </SelectItem>
                  <SelectItem value="purchaseAmount-desc">
                    Maior Compra
                  </SelectItem>
                  <SelectItem value="purchaseAmount-asc">
                    Menor Compra
                  </SelectItem>
                  <SelectItem value="clientName-asc">Cliente (A-Z)</SelectItem>
                  <SelectItem value="clientName-desc">Cliente (Z-A)</SelectItem>
                  <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                  <SelectItem value="status-desc">Status (Z-A)</SelectItem>
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
                  status: "all",
                  userId: "all",
                  startDate: "",
                  endDate: "",
                  minAmount: "",
                  maxAmount: "",
                  sortBy: "createdAt",
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

      {/* Tabela de Transações */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              Transações de Cashback
            </CardTitle>
            {!isLoading && pagination && (
              <Badge
                variant="outline"
                className="text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
              >
                {pagination.totalItems.toLocaleString()} transações encontradas
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
                  Erro ao carregar transações
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
                  <div className="grid grid-cols-8 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-4 bg-slate-200 dark:bg-slate-800"
                      />
                    ))}
                  </div>
                </div>
                {/* Rows skeleton */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0"
                  >
                    <div className="grid grid-cols-8 gap-4 items-center">
                      {/* Cliente */}
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
                        <Skeleton className="h-3 w-20 bg-slate-100 dark:bg-slate-800/50" />
                      </div>
                      {/* Valor Compra */}
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-16 bg-blue-100 dark:bg-blue-900/20" />
                        <Skeleton className="h-3 w-12 bg-slate-100 dark:bg-slate-800/50" />
                      </div>
                      {/* Cashback */}
                      <Skeleton className="h-4 w-16 bg-emerald-100 dark:bg-emerald-900/20" />
                      {/* Taxa */}
                      <Skeleton className="h-4 w-12 bg-purple-100 dark:bg-purple-900/20" />
                      {/* Status */}
                      <Skeleton className="h-6 w-16 bg-amber-100 dark:bg-amber-900/20 rounded-full" />
                      {/* Data Venda */}
                      <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-800" />
                      {/* Vendedor */}
                      <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-800" />
                      {/* Vencimento */}
                      <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Receipt className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  <h3 className="text-lg font-semibold mb-1">
                    Nenhuma transação encontrada
                  </h3>
                  <p className="text-sm">
                    Não há transações de cashback que correspondam aos filtros
                    aplicados.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Versão Desktop/Tablet - Tabela */}
              <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <th
                          className="text-left p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors select-none"
                          onClick={() => handleSort("clientName")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Cliente
                            {getSortIcon("clientName")}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors select-none"
                          onClick={() => handleSort("purchaseAmount")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Valor Compra
                            {getSortIcon("purchaseAmount")}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors select-none"
                          onClick={() => handleSort("cashbackAmount")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Cashback
                            {getSortIcon("cashbackAmount")}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors select-none"
                          onClick={() => handleSort("cashbackRate")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Taxa
                            {getSortIcon("cashbackRate")}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors select-none"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Status
                            {getSortIcon("status")}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 transition-colors select-none hidden lg:table-cell"
                          onClick={() => handleSort("saleDate")}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            Data Venda
                            {getSortIcon("saleDate")}
                          </div>
                        </th>
                        <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                          Vendedor
                        </th>
                        <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                          Vencimento
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors"
                        >
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {transaction.clientName}
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-400 space-x-2">
                                {transaction.clientPhone && (
                                  <span>{transaction.clientPhone}</span>
                                )}
                                {transaction.clientCpf && (
                                  <span className="font-mono">
                                    CPF: {transaction.clientCpf}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-blue-600 dark:text-blue-400">
                                {formatCurrency(transaction.purchaseAmount)}
                              </div>
                              {transaction.invoiceNumber && (
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  NF: {transaction.invoiceNumber}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(transaction.cashbackAmount)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-purple-600 dark:text-purple-400">
                              {parseFloat(transaction.cashbackRate).toFixed(1)}%
                            </div>
                          </td>
                          <td className="p-4">
                            {getStatusBadge(transaction.status)}
                          </td>
                          <td className="p-4 hidden lg:table-cell">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {transaction.saleDate
                                ? formatDateOnly(transaction.saleDate)
                                : "N/A"}
                            </div>
                          </td>
                          <td className="p-4 hidden xl:table-cell">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {transaction.responsibleUser?.name || "N/A"}
                            </div>
                          </td>
                          <td className="p-4 hidden xl:table-cell">
                            <div
                              className={`text-sm ${
                                new Date(transaction.expiresAt).getTime() -
                                  Date.now() <
                                7 * 24 * 60 * 60 * 1000
                                  ? "text-orange-600 dark:text-orange-400 font-medium"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {formatDateOnly(transaction.expiresAt)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Versão Mobile - Cards */}
              <div className="md:hidden space-y-4">
                {transactions.map((transaction) => (
                  <Card
                    key={transaction.id}
                    className="border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <CardContent className="p-4 space-y-4">
                      {/* Header com Cliente e Status */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {transaction.clientName}
                          </h3>
                          <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1 mt-1">
                            {transaction.clientPhone && (
                              <div>{transaction.clientPhone}</div>
                            )}
                            {transaction.clientCpf && (
                              <div className="font-mono">
                                CPF: {transaction.clientCpf}
                              </div>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(transaction.status)}
                      </div>

                      {/* Valores */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Valor da Compra
                          </p>
                          <p className="font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(transaction.purchaseAmount)}
                          </p>
                          {transaction.invoiceNumber && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              NF: {transaction.invoiceNumber}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Cashback (
                            {parseFloat(transaction.cashbackRate).toFixed(1)}%)
                          </p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(transaction.cashbackAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Informações Adicionais */}
                      <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Data da Venda
                          </p>
                          <p className="text-slate-600 dark:text-slate-400">
                            {transaction.saleDate
                              ? formatDateOnly(transaction.saleDate)
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Vencimento
                          </p>
                          <p
                            className={`${
                              new Date(transaction.expiresAt).getTime() -
                                Date.now() <
                              7 * 24 * 60 * 60 * 1000
                                ? "text-orange-600 dark:text-orange-400 font-medium"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {formatDateOnly(transaction.expiresAt)}
                          </p>
                        </div>
                      </div>

                      {/* Vendedor */}
                      {transaction.responsibleUser && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            Vendedor Responsável
                          </p>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6 border border-slate-200 dark:border-slate-800">
                              <AvatarFallback className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {transaction.responsibleUser.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {transaction.responsibleUser.name}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Paginação */}
          {!isLoading && pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 gap-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Página {pagination.page.toLocaleString()} de{" "}
                {pagination.totalPages.toLocaleString()}
                <span className="ml-2 text-slate-500 dark:text-slate-500">
                  ({pagination.totalItems.toLocaleString()} transações)
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
                  disabled={!pagination.hasPrevious}
                  className="text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
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
                        const current = pagination.page;
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
                            pagination.page === pageNum ? "default" : "ghost"
                          }
                          size="sm"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, page: pageNum }))
                          }
                          className={`w-8 h-8 p-0 text-xs ${
                            pagination.page === pageNum
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
                  disabled={!pagination.hasNext}
                  className="text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
