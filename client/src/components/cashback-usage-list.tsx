import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Wallet,
  DollarSign,
  Users,
  TrendingDown,
  UserCheck,
  Phone,
  Mail,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CashbackUsageItem {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  clientEmail: string;
  usedAmount: string;
  description: string;
  authorizedBy: {
    id: string;
    name: string;
    email: string;
  };
  responsibleUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
}

interface CashbackUsageStatistics {
  totalUsages: number;
  totalUsedAmount: string;
  avgUsageAmount: string;
  uniqueClients: number;
  usagesByAuthorizer: {
    [key: string]: {
      name: string;
      count: number;
      totalAmount: string;
    };
  };
}

interface CashbackUsagePagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface CashbackUsageResponse {
  success: boolean;
  data: {
    usages: CashbackUsageItem[];
    pagination: CashbackUsagePagination;
    statistics: CashbackUsageStatistics;
  };
}

interface CashbackUsageFilters {
  search: string;
  userId: string;
  authorizedById: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  sortBy:
    | "clientName"
    | "usedAmount"
    | "authorizedBy"
    | "createdAt"
    | "description";
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CashbackUsageListProps {
  formatCurrency: (value: string | number) => string;
  users?: User[];
}

export function CashbackUsageList({
  formatCurrency,
  users = [],
}: CashbackUsageListProps) {
  const [filters, setFilters] = useState<CashbackUsageFilters>({
    search: "",
    userId: "all",
    authorizedById: "all",
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
    filters.userId,
    filters.authorizedById,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
    filters.sortBy,
    filters.sortOrder,
  ]);

  // Query para buscar resgates
  const {
    data: usageData,
    isLoading,
    isError,
    error,
  } = useQuery<CashbackUsageResponse>({
    queryKey: [
      "cashback-usage-list",
      debouncedSearch,
      filters.userId,
      filters.authorizedById,
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
      if (filters.userId !== "all") {
        params.append("userId", filters.userId);
      }
      if (filters.authorizedById !== "all") {
        params.append("authorizedById", filters.authorizedById);
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

      const response = await fetch(`/api/cashback-settings/usage?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao buscar resgates");
      }

      return response.json();
    },
    staleTime: 30000, // Cache por 30 segundos
    refetchOnWindowFocus: false,
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const handleSort = (column: CashbackUsageFilters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder:
        prev.sortBy === column && prev.sortOrder === "asc" ? "desc" : "asc",
      page: 1,
    }));
  };

  const getSortIcon = (column: CashbackUsageFilters["sortBy"]) => {
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

  const usages = usageData?.data?.usages || [];
  const pagination = usageData?.data?.pagination;
  const statistics = usageData?.data?.statistics;

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 hover:shadow-lg transition-all duration-300 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2 dark:text-slate-400">
                <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700">
                  <BarChart3 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                Total de Resgates
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {statistics.totalUsages.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                Resgates realizados
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300 dark:from-red-900/20 dark:to-red-800/20 dark:border-red-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2 dark:text-red-400">
                <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-800/50">
                  <DollarSign className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                Total Resgatado
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(statistics.totalUsedAmount)}
              </div>
              <p className="text-xs text-red-500 mt-1 dark:text-red-400">
                Valor total resgatado
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-lg transition-all duration-300 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-amber-600 flex items-center gap-2 dark:text-amber-400">
                <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-800/50">
                  <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                Valor Médio
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                {formatCurrency(statistics.avgUsageAmount)}
              </div>
              <p className="text-xs text-amber-500 mt-1 dark:text-amber-400">
                Por resgate
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-2 dark:text-blue-400">
                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-800/50">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                Clientes Únicos
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {statistics.uniqueClients.toLocaleString()}
              </div>
              <p className="text-xs text-blue-500 mt-1 dark:text-blue-400">
                Clientes diferentes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estatísticas por Autorizador */}
      {statistics && Object.keys(statistics.usagesByAuthorizer).length > 0 && (
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 dark:border-purple-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-800/50">
                <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              Resgates por Autorizador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(statistics.usagesByAuthorizer).map(
                ([id, data]) => (
                  <div
                    key={id}
                    className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700/30 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 ring-2 ring-purple-100 dark:ring-purple-800">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-purple-600 text-white font-semibold text-sm">
                          {getInitials(data.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                          {data.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {data.count} resgates
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(data.totalAmount)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        total
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
              <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Linha 1: Busca e Vendedor */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" />
                Buscar Resgates
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Nome, CPF, telefone, email ou descrição..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="pl-10 border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                Vendedor Responsável
              </label>
              <Select
                value={filters.userId}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, userId: value, page: 1 }));
                }}
              >
                <SelectTrigger className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500">
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

          {/* Linha 2: Autorizador e Período */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-500" />
                Autorizado por
              </label>
              <Select
                value={filters.authorizedById}
                onValueChange={(value) => {
                  setFilters((prev) => ({
                    ...prev,
                    authorizedById: value,
                    page: 1,
                  }));
                }}
              >
                <SelectTrigger className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500">
                  <SelectValue placeholder="Filtrar por autorizador..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os autorizadores</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Período
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
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
                    className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
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
                    className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Linha 3: Valores e Ordenação */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-500" />
                Valor Mínimo
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
                className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-500" />
                Valor Máximo
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
                className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-slate-500" />
                Ordenar por
              </label>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-");
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: sortBy as CashbackUsageFilters["sortBy"],
                    sortOrder: sortOrder as "asc" | "desc",
                    page: 1,
                  }));
                }}
              >
                <SelectTrigger className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Mais Recentes</SelectItem>
                  <SelectItem value="createdAt-asc">Mais Antigos</SelectItem>
                  <SelectItem value="usedAmount-desc">Maior Valor</SelectItem>
                  <SelectItem value="usedAmount-asc">Menor Valor</SelectItem>
                  <SelectItem value="clientName-asc">Cliente (A-Z)</SelectItem>
                  <SelectItem value="clientName-desc">Cliente (Z-A)</SelectItem>
                  <SelectItem value="authorizedBy-asc">
                    Autorizador (A-Z)
                  </SelectItem>
                  <SelectItem value="authorizedBy-desc">
                    Autorizador (Z-A)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  search: "",
                  userId: "all",
                  authorizedById: "all",
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
              className="border-slate-300 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:hover:bg-slate-700 dark:hover:border-slate-500"
            >
              <Filter className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Resgates */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Histórico de Resgates</CardTitle>
            {pagination && (
              <div className="text-sm text-muted-foreground">
                {pagination.totalItems} resgates encontrados
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="text-red-600 p-4 text-center">
              <p>Erro ao carregar resgates: {error?.message}</p>
              <p className="text-sm mt-2">
                Verifique o console para mais detalhes
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-6">
              {/* Skeleton para desktop */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-6 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600" />
                  <Skeleton className="h-4 bg-red-200 dark:bg-red-900/50" />
                  <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600" />
                  <Skeleton className="h-4 bg-purple-200 dark:bg-purple-900/50" />
                  <Skeleton className="h-4 bg-blue-200 dark:bg-blue-900/50" />
                  <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-6 gap-4 p-4 border-b border-slate-200 dark:border-slate-700"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600" />
                      <Skeleton className="h-3 bg-slate-200 dark:bg-slate-700 w-3/4" />
                    </div>
                    <Skeleton className="h-4 bg-red-200 dark:bg-red-900/50" />
                    <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full bg-purple-200 dark:bg-purple-900/50" />
                      <Skeleton className="h-4 bg-purple-200 dark:bg-purple-900/50 flex-1" />
                    </div>
                    <Skeleton className="h-4 bg-blue-200 dark:bg-blue-900/50" />
                    <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600" />
                  </div>
                ))}
              </div>

              {/* Skeleton para mobile */}
              <div className="lg:hidden space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24 bg-slate-300 dark:bg-slate-600" />
                          <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-700" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-20 bg-red-200 dark:bg-red-900/50 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-700" />
                        <Skeleton className="h-4 bg-purple-200 dark:bg-purple-900/50" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-12 bg-slate-200 dark:bg-slate-700" />
                        <Skeleton className="h-4 bg-blue-200 dark:bg-blue-900/50" />
                      </div>
                    </div>
                    <Skeleton className="h-4 bg-slate-300 dark:bg-slate-600 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ) : usages.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum resgate encontrado
              </h3>
              <p className="text-gray-500">
                Não há resgates de cashback que correspondam aos filtros
                aplicados.
              </p>
            </div>
          ) : (
            <>
              {/* Tabela Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <TableHead
                        className="cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        onClick={() => handleSort("clientName")}
                      >
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          Cliente
                          {getSortIcon("clientName")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        onClick={() => handleSort("usedAmount")}
                      >
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          Valor Resgatado
                          {getSortIcon("usedAmount")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        onClick={() => handleSort("description")}
                      >
                        <div className="flex items-center gap-1">
                          Descrição
                          {getSortIcon("description")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        onClick={() => handleSort("authorizedBy")}
                      >
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-4 h-4" />
                          Autorizado por
                          {getSortIcon("authorizedBy")}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Vendedor
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        onClick={() => handleSort("createdAt")}
                      >
                        <div className="flex items-center gap-1">
                          Data
                          {getSortIcon("createdAt")}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usages.map((usage) => (
                      <TableRow
                        key={usage.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 ring-2 ring-slate-200 dark:ring-slate-700">
                              <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white font-semibold text-sm">
                                {getInitials(usage.clientName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {usage.clientName}
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                {usage.clientPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {usage.clientPhone}
                                  </span>
                                )}
                                {usage.clientCpf && (
                                  <span>CPF: {usage.clientCpf}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant="destructive"
                            className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 font-bold text-sm px-3 py-1"
                          >
                            {formatCurrency(usage.usedAmount)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 max-w-xs">
                          <p
                            className="text-sm text-slate-600 dark:text-slate-400 truncate"
                            title={usage.description}
                          >
                            {usage.description}
                          </p>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8 ring-2 ring-purple-200 dark:ring-purple-700">
                              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-purple-600 text-white font-semibold text-xs">
                                {getInitials(usage.authorizedBy.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {usage.authorizedBy.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            {usage.responsibleUser ? (
                              <>
                                <Avatar className="w-8 h-8 ring-2 ring-blue-200 dark:ring-blue-700">
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-xs">
                                    {getInitials(usage.responsibleUser.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {usage.responsibleUser.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400 dark:text-slate-500 italic">
                                N/A
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                            {formatDate(usage.createdAt)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cards Mobile */}
              <div className="lg:hidden space-y-4">
                {usages.map((usage) => (
                  <Card
                    key={usage.id}
                    className="p-4 hover:shadow-md transition-all duration-300 border-slate-200 dark:border-slate-700"
                  >
                    <div className="space-y-4">
                      {/* Header do Card */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12 ring-2 ring-slate-200 dark:ring-slate-700">
                            <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white font-bold">
                              {getInitials(usage.clientName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                              {usage.clientName}
                            </h3>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {usage.clientPhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {usage.clientPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="destructive"
                          className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold"
                        >
                          {formatCurrency(usage.usedAmount)}
                        </Badge>
                      </div>

                      {/* Informações do Resgate */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Autorizado por
                          </p>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-purple-600 text-white text-xs font-semibold">
                                {getInitials(usage.authorizedBy.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                              {usage.authorizedBy.name}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Vendedor
                          </p>
                          {usage.responsibleUser ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold">
                                  {getInitials(usage.responsibleUser.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {usage.responsibleUser.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 dark:text-slate-500 italic">
                              N/A
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Descrição */}
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Descrição
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {usage.description}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(usage.createdAt)}
                        </span>
                        {usage.clientCpf && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            CPF: {usage.clientCpf}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Paginação */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 gap-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Mostrando página {pagination.page} de {pagination.totalPages} (
                {pagination.totalItems.toLocaleString()} resgates)
              </div>
              <div className="flex items-center gap-2">
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
                  className="border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>

                {/* Números das páginas */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }

                      const isCurrentPage = pageNum === pagination.page;
                      return (
                        <Button
                          key={pageNum}
                          variant={isCurrentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, page: pageNum }))
                          }
                          className={`w-10 h-8 p-0 ${
                            isCurrentPage
                              ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                              : "border-slate-300 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:hover:bg-slate-700"
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
                  className="border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  Próxima
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
