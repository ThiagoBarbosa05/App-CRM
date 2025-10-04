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
} from "lucide-react";

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
      "/api/cashback-expiring",
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

      const response = await fetch(`/api/cashback-expiring?${params}`);
      if (!response.ok) {
        throw new Error("Erro ao buscar cashbacks vencendo");
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    refetchOnWindowFocus: false,
  });

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0); // Reset para primeira página
  };

  const handleSortChange = (
    newSortBy: "amount" | "expiresAt" | "clientName" | "sellerName"
  ) => {
    if (sortBy === newSortBy) {
      // Se já está ordenando pela mesma coluna, inverte a ordem
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Se mudou a coluna, usa ordem ascendente por padrão
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
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-red-50/30 dark:from-gray-900 dark:to-red-900/10">
        <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-b border-red-100 dark:border-red-800/30">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl font-semibold text-red-700 dark:text-red-300">
              Erro ao Carregar Dados
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400 mb-4">
            Não foi possível carregar os cashbacks vencendo.
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-red-200 dark:border-red-700/50 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 text-red-700 dark:text-red-300"
          >
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-950">
      <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
              <AlertTriangle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Cashback Vencendo
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Cashbacks que vencem nos próximos 7 dias
                {expiringData?.statistics && (
                  <span className="block sm:inline sm:ml-2 font-medium mt-1 sm:mt-0">
                    <span className="text-blue-600 dark:text-blue-400">
                      {expiringData.statistics.totalRecords}
                    </span>{" "}
                    registros •{" "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatCurrency(expiringData.statistics.totalAmount)}
                    </span>{" "}
                    total
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Filtros e Ordenação */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente ou vendedor..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 border-gray-200 dark:border-gray-800 focus:border-gray-400 dark:focus:border-gray-600 focus:ring-gray-400/10"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select
              value={sortBy}
              onValueChange={(value: any) => handleSortChange(value)}
            >
              <SelectTrigger className="w-full sm:w-[180px] border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
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
              title={`Ordenação ${
                sortOrder === "asc" ? "crescente" : "decrescente"
              }`}
              className="shrink-0 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
            >
              {getSortIcon(sortBy) || <SortAsc className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Lista de Cashbacks */}
        {isLoading ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !expiringData?.data || expiringData.data.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Clock className="h-8 w-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchTerm
                ? "Nenhum resultado encontrado"
                : "Nenhum cashback vencendo"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {searchTerm
                ? "Tente ajustar os filtros de busca para encontrar os cashbacks desejados."
                : "Não há cashbacks próximos do vencimento nos próximos 7 dias. Ótimo trabalho!"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {expiringData.data.map((cashback) => (
                <div
                  key={cashback.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          cashback.daysUntilExpiry === 0
                            ? "bg-red-100 dark:bg-red-900/30"
                            : cashback.daysUntilExpiry <= 2
                            ? "bg-orange-100 dark:bg-orange-900/30"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        <AlertTriangle
                          className={`h-5 w-5 ${
                            cashback.daysUntilExpiry === 0
                              ? "text-red-600 dark:text-red-400"
                              : cashback.daysUntilExpiry <= 2
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {cashback.client.name}
                        </p>
                        <div
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            cashback.daysUntilExpiry === 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : cashback.daysUntilExpiry <= 2
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}
                        >
                          {cashback.daysUntilExpiry === 0
                            ? "Vence hoje!"
                            : cashback.daysUntilExpiry === 1
                            ? "Vence amanhã!"
                            : `${cashback.daysUntilExpiry} dias`}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                          <span>
                            Compra:{" "}
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(cashback.purchaseAmount)}
                            </span>
                          </span>
                        </div>
                        {cashback.seller && (
                          <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-blue-500" />
                            <span className="truncate">
                              Vendedor:{" "}
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {cashback.seller.name}
                              </span>
                            </span>
                          </div>
                        )}
                        {cashback.invoiceNumber && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            NF: {cashback.invoiceNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-0 sm:text-right sm:ml-4 flex sm:flex-col items-center sm:items-end gap-2">
                    <div className="flex items-center gap-1">
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-1.5">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                          {formatCurrency(cashback.cashbackAmount)}
                        </span>
                      </div>
                    </div>
                    <p
                      className={`text-xs font-medium ${
                        cashback.daysUntilExpiry === 0
                          ? "text-red-600 dark:text-red-400"
                          : cashback.daysUntilExpiry <= 2
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Vence:{" "}
                      {new Date(cashback.expiresAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paginação */}
        {expiringData?.pagination &&
          expiringData.pagination.total > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-800 gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {Math.min(
                    currentPage * itemsPerPage + 1,
                    expiringData.pagination.total
                  )}
                </span>{" "}
                -{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {Math.min(
                    (currentPage + 1) * itemsPerPage,
                    expiringData.pagination.total
                  )}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {expiringData.pagination.total}
                </span>{" "}
                registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!expiringData.pagination.hasMore}
                  className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
