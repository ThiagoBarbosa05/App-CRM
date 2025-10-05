import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  CreditCardIcon,
  CircleDollarSignIcon,
  ActivityIcon,
  SearchIcon,
  FilterIcon,
  BarChart3,
  DollarSign,
  Award,
  Target,
  TrendingUp,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useDebounce } from "../hooks/use-debounce";

interface DashboardStats {
  totalDistributed: number;
  totalUsed: number;
  totalPendingBalance: number;
  totalTransactions: number;
  totalUsageCount: number;
  totalClientsWithBalance: number;
}

interface TopClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalEarned: number;
  totalUsed: number;
  currentBalance: number;
  responsibleUser: {
    id: string;
    name: string;
    email: string;
  };
}

interface ActiveSetting {
  id: string;
  name: string;
  percentageRate: number;
  minimumPurchase: number;
  maximumCashback?: number;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

interface MonthlyTrend {
  month: string;
  totalDistributed: number;
  totalTransactions: number;
  avgTransactionValue: number;
}

interface SellerPerformance {
  id: string;
  name: string;
  email: string;
  totalDistributed: number;
  totalTransactions: number;
  totalClients: number;
  avgTransactionValue: number;
  totalClientsWithBalance: number;
}

interface CashbackReportsData {
  dashboardStats: DashboardStats;
  topClients: TopClient[];
  activeSettings: ActiveSetting[];
  monthlyTrends: MonthlyTrend[];
  monthlyUsageTrends: MonthlyTrend[];
  sellersPerformance: SellerPerformance[];
}

interface CashbackReportsFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  clientId?: string;
  hasActiveSettings?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function CashbackReports() {
  const [search, setSearch] = useState("");
  const [sellerId, setSellerId] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState("totalEarned");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebounce(search, 300);

  const buildFilters = (): CashbackReportsFilters => {
    return {
      search: debouncedSearch || undefined,
      sellerId: sellerId && sellerId !== "all" ? sellerId : undefined,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      sortBy,
      sortOrder,
      limit: 10,
      page: 1,
    };
  };

  // Query para buscar vendedores
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        console.log("Fetching users from /api/users..."); // Debug log
        const response = await fetch("/api/users");
        console.log("Response status:", response.status); // Debug log

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: Falha ao buscar vendedores`
          );
        }

        const data = await response.json();
        console.log("Users data received:", data); // Debug log
        console.log(
          "Users count:",
          Array.isArray(data) ? data.length : "Not an array"
        );
        return data;
      } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: true, // Sempre tentar buscar
  });

  const {
    data: reportsData,
    isLoading,
    error,
    refetch,
  } = useQuery<{ success: boolean; data: CashbackReportsData }>({
    queryKey: ["cashback-reports", buildFilters()],
    queryFn: async () => {
      const params = new URLSearchParams();
      const filters = buildFilters();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/cashback-reports?${params}`);
      if (!response.ok) {
        throw new Error("Falha ao buscar dados dos reports");
      }
      return response.json();
    },
  });

  const handleClearFilters = () => {
    setSearch("");
    setSellerId("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSortBy("totalEarned");
    setSortOrder("desc");
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-500">
              Erro ao carregar dados: {error.message}
            </p>
            <Button onClick={() => refetch()} className="mt-2">
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = reportsData?.data.dashboardStats;
  const topClients = reportsData?.data.topClients || [];
  const activeSettings = reportsData?.data.activeSettings || [];
  const monthlyTrends = reportsData?.data.monthlyTrends || [];
  const sellersPerformance = reportsData?.data.sellersPerformance || [];

  // Debug: mostrar erro de users se houver
  if (usersError) {
    console.error("Error loading users:", usersError);
  }

  // Fallback: usar vendedores dos dados de performance se a API de users falhar
  const availableSellers =
    usersData && usersData.length > 0
      ? usersData
      : sellersPerformance.map((seller) => ({
          id: seller.id,
          name: seller.name,
        }));

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
              <FilterIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            Filtros de Reports
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Configure os filtros para personalizar os relatórios de cashback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <SearchIcon className="w-4 h-4 text-slate-500" />
                Buscar Clientes
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Nome do cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-slate-500" />
                Vendedor
              </label>
              <Select value={sellerId} onValueChange={setSellerId}>
                <SelectTrigger className="border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500">
                  <SelectValue
                    placeholder={
                      isLoadingUsers
                        ? "Carregando vendedores..."
                        : "Selecionar vendedor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {isLoadingUsers ? (
                    <SelectItem value="loading" disabled>
                      Carregando...
                    </SelectItem>
                  ) : availableSellers && availableSellers.length > 0 ? (
                    availableSellers.map((seller: any) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-sellers" disabled>
                      Nenhum vendedor encontrado
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                Data Início
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                Data Fim
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-slate-300 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-600 dark:focus:border-slate-500",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4 xl:col-span-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FilterIcon className="w-4 h-4 text-slate-500" />
                Ações
              </label>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full border-slate-300 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:hover:bg-slate-700 dark:hover:border-slate-500"
              >
                <FilterIcon className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Statistics Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/10"></div>
              <CardHeader className="relative pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 bg-slate-300 dark:bg-slate-600" />
                  <Skeleton className="h-4 w-4 rounded bg-slate-300 dark:bg-slate-600" />
                </div>
              </CardHeader>
              <CardContent className="relative pb-4">
                <Skeleton className="h-8 w-32 mb-2 bg-slate-300 dark:bg-slate-600" />
                <Skeleton className="h-3 w-20 bg-slate-200 dark:bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-lg transition-all duration-300 dark:from-emerald-900/20 dark:to-emerald-800/20 dark:border-emerald-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-emerald-600 flex items-center gap-2 dark:text-emerald-400">
                <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-800/50">
                  <CircleDollarSignIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                Total Distribuído
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(stats?.totalDistributed || 0)}
              </div>
              <p className="text-xs text-emerald-500 mt-1 dark:text-emerald-400">
                em {(stats?.totalTransactions || 0).toLocaleString()} transações
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300 dark:from-red-900/20 dark:to-red-800/20 dark:border-red-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2 dark:text-red-400">
                <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-800/50">
                  <CreditCardIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                Total Resgatado
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(stats?.totalUsed || 0)}
              </div>
              <p className="text-xs text-red-500 mt-1 dark:text-red-400">
                em {(stats?.totalUsageCount || 0).toLocaleString()} resgates
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-lg transition-all duration-300 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-amber-600 flex items-center gap-2 dark:text-amber-400">
                <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-800/50">
                  <ActivityIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Saldo Pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                {formatCurrency(stats?.totalPendingBalance || 0)}
              </div>
              <p className="text-xs text-amber-500 mt-1 dark:text-amber-400">
                disponível para resgate
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10"></div>
            <CardHeader className="relative pb-3">
              <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-2 dark:text-blue-400">
                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-800/50">
                  <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Clientes Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="relative pb-4">
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {(stats?.totalClientsWithBalance || 0).toLocaleString()}
              </div>
              <p className="text-xs text-blue-500 mt-1 dark:text-blue-400">
                com saldo de cashback
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 5 Clientes */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-900/20 dark:to-emerald-800/20 dark:border-emerald-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-800/50">
                <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Top 5 Clientes
            </CardTitle>
            <CardDescription className="text-emerald-600 dark:text-emerald-400">
              Clientes com maior valor em cashback acumulado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-full bg-emerald-200 dark:bg-emerald-800" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2 bg-emerald-200 dark:bg-emerald-800" />
                        <Skeleton className="h-3 w-20 bg-emerald-200/70 dark:bg-emerald-800/70" />
                      </div>
                      <Skeleton className="h-4 w-16 bg-emerald-200 dark:bg-emerald-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {topClients.slice(0, 5).map((client, index) => {
                    const rankColors = [
                      "from-yellow-500 to-yellow-600", // 1º lugar - ouro
                      "from-gray-400 to-gray-500", // 2º lugar - prata
                      "from-orange-500 to-orange-600", // 3º lugar - bronze
                      "from-emerald-500 to-emerald-600", // 4º lugar
                      "from-blue-500 to-blue-600", // 5º lugar
                    ];

                    return (
                      <div
                        key={client.id}
                        className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700/30 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-full bg-gradient-to-br ${rankColors[index]} flex items-center justify-center text-sm font-bold text-white shadow-md`}
                          >
                            {index + 1}
                          </div>
                          <Avatar className="w-10 h-10 ring-2 ring-emerald-200 dark:ring-emerald-700">
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-semibold text-sm">
                              {getInitials(client.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                              {client.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Saldo:{" "}
                              {formatCurrency(client.currentBalance || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCurrency(client.totalEarned || 0)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            total ganho
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {topClients.length === 0 && (
                    <div className="text-center py-8">
                      <Award className="h-12 w-12 text-emerald-400 mx-auto mb-4 opacity-50" />
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Nenhum cliente com cashback ainda
                      </p>
                      <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-1">
                        Os clientes aparecerão aqui conforme acumulam cashback
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configurações Ativas */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 dark:border-purple-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-800/50">
                <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              Configurações Ativas
            </CardTitle>
            <CardDescription className="text-purple-600 dark:text-purple-400">
              Regras de cashback em vigência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-700/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-2 bg-purple-200 dark:bg-purple-800" />
                          <Skeleton className="h-3 w-40 bg-purple-200/70 dark:bg-purple-800/70" />
                        </div>
                        <Skeleton className="h-6 w-12 rounded-full bg-purple-200 dark:bg-purple-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {activeSettings.map((setting) => (
                    <div
                      key={setting.id}
                      className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700/30 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-800/50">
                          <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                            {setting.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Mín: {formatCurrency(setting.minimumPurchase || 0)}
                            {setting.maximumCashback &&
                              ` • Máx: ${formatCurrency(
                                setting.maximumCashback
                              )}`}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 font-bold px-3 py-1">
                        {parseFloat(setting.percentageRate.toString()).toFixed(
                          1
                        )}
                        %
                      </Badge>
                    </div>
                  ))}
                  {activeSettings.length === 0 && (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 text-purple-400 mx-auto mb-4 opacity-50" />
                      <p className="text-purple-600 dark:text-purple-400 font-medium">
                        Nenhuma regra ativa
                      </p>
                      <p className="text-xs text-purple-500 dark:text-purple-500 mt-1">
                        Configure regras de cashback para começar
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance dos Vendedores */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-800/50">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Performance dos Vendedores
          </CardTitle>
          <CardDescription className="text-blue-600 dark:text-blue-400">
            Ranking de performance por distribuição de cashback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-700/30"
                  >
                    {/* Skeleton Desktop */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full bg-blue-200 dark:bg-blue-800" />
                        <Skeleton className="h-12 w-12 rounded-full bg-blue-200 dark:bg-blue-800" />
                        <div>
                          <Skeleton className="h-4 w-32 mb-2 bg-blue-200 dark:bg-blue-800" />
                          <Skeleton className="h-3 w-40 bg-blue-200/70 dark:bg-blue-800/70" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-20 mb-2 bg-blue-200 dark:bg-blue-800" />
                        <Skeleton className="h-3 w-16 bg-blue-200/70 dark:bg-blue-800/70" />
                      </div>
                    </div>

                    {/* Skeleton Mobile */}
                    <div className="sm:hidden space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-800" />
                          <Skeleton className="h-10 w-10 rounded-full bg-blue-200 dark:bg-blue-800" />
                          <Skeleton className="h-4 w-24 bg-blue-200 dark:bg-blue-800" />
                        </div>
                        <Skeleton className="h-4 w-16 bg-blue-200 dark:bg-blue-800" />
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-blue-100 dark:border-blue-800/30">
                        <div className="text-center space-y-2">
                          <Skeleton className="h-3 w-12 mx-auto bg-blue-200/70 dark:bg-blue-800/70" />
                          <Skeleton className="h-4 w-8 mx-auto bg-blue-200 dark:bg-blue-800" />
                        </div>
                        <div className="text-center space-y-2">
                          <Skeleton className="h-3 w-16 mx-auto bg-blue-200/70 dark:bg-blue-800/70" />
                          <Skeleton className="h-4 w-8 mx-auto bg-blue-200 dark:bg-blue-800" />
                        </div>
                        <div className="text-center space-y-2">
                          <Skeleton className="h-3 w-14 mx-auto bg-blue-200/70 dark:bg-blue-800/70" />
                          <Skeleton className="h-3 w-12 mx-auto bg-blue-200/70 dark:bg-blue-800/70" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {sellersPerformance.map((seller, index) => {
                  const rankColors = [
                    "from-yellow-500 to-yellow-600", // 1º lugar
                    "from-gray-400 to-gray-500", // 2º lugar
                    "from-orange-500 to-orange-600", // 3º lugar
                  ];
                  const defaultColor = "from-blue-500 to-blue-600";

                  return (
                    <div
                      key={seller.id}
                      className="group p-4 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700/30 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                    >
                      {/* Layout Desktop */}
                      <div className="hidden sm:flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-full bg-gradient-to-br ${
                              index < 3 ? rankColors[index] : defaultColor
                            } flex items-center justify-center text-sm font-bold text-white shadow-md`}
                          >
                            {index + 1}
                          </div>
                          <Avatar className="w-12 h-12 ring-2 ring-blue-200 dark:ring-blue-700">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm">
                              {getInitials(seller.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                              {seller.name}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <UsersIcon className="w-3 h-3" />
                                {seller.totalClients} clientes
                              </span>
                              <span className="flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" />
                                {seller.totalTransactions} transações
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                            {formatCurrency(seller.totalDistributed || 0)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Média:{" "}
                            {formatCurrency(seller.avgTransactionValue || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Layout Mobile */}
                      <div className="sm:hidden space-y-4">
                        {/* Header do Card Mobile */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-8 w-8 rounded-full bg-gradient-to-br ${
                                index < 3 ? rankColors[index] : defaultColor
                              } flex items-center justify-center text-xs font-bold text-white shadow-md`}
                            >
                              {index + 1}
                            </div>
                            <Avatar className="w-10 h-10 ring-2 ring-blue-200 dark:ring-blue-700">
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm">
                                {getInitials(seller.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors text-sm">
                                {seller.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                              {formatCurrency(seller.totalDistributed || 0)}
                            </p>
                          </div>
                        </div>

                        {/* Métricas Mobile */}
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-blue-100 dark:border-blue-800/30">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-1">
                              <UsersIcon className="w-3 h-3" />
                              <span>Clientes</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {seller.totalClients}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-1">
                              <BarChart3 className="w-3 h-3" />
                              <span>Transações</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {seller.totalTransactions}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              Valor Médio
                            </div>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              {formatCurrency(seller.avgTransactionValue || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sellersPerformance.length === 0 && (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-blue-400 mx-auto mb-4 opacity-50" />
                    <p className="text-blue-600 dark:text-blue-400 font-medium">
                      Nenhum vendedor com performance registrada
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                      Os dados de performance aparecerão conforme as vendas são
                      realizadas
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
