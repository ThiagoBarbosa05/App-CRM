import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  Wine,
  Search,
  Download,
  Upload,
  TrendingUp,
  Award,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ProductFormModal } from "@/components/product-form-modal";
import { ProductClientsModal } from "@/components/product-clients-modal";
import ProductImportModal from "@/components/product-import-modal";
import { queryClient } from "@/lib/queryClient";
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
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Product {
  id: string;
  name: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
}

export default function Products() {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedProductForClients, setSelectedProductForClients] =
    useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [debouncedTypeFilter, setDebouncedTypeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [debouncedCountryFilter, setDebouncedCountryFilter] = useState("");
  const [volumeFilter, setVolumeFilter] = useState("");
  const [debouncedVolumeFilter, setDebouncedVolumeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { toast } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setDebouncedTypeFilter(typeFilter);
      setDebouncedCountryFilter(countryFilter);
      setDebouncedVolumeFilter(volumeFilter);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, typeFilter, countryFilter, volumeFilter]);

  const { data, isFetching } = useQuery({
    queryKey: [
      "/api/products",
      debouncedSearchQuery,
      debouncedTypeFilter,
      debouncedCountryFilter,
      debouncedVolumeFilter,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("name", debouncedSearchQuery);
      if (debouncedTypeFilter) params.append("type", debouncedTypeFilter);
      if (debouncedCountryFilter)
        params.append("country", debouncedCountryFilter);
      if (debouncedVolumeFilter) params.append("volume", debouncedVolumeFilter);
      params.append("page", currentPage.toString());
      params.append("pageSize", pageSize.toString());

      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products = data?.data || [];
  const totalProducts = data?.totalItems || 0;
  const totalPages = data?.totalPages || 1;

  const { data: statistics, error: statisticsError } = useQuery({
    queryKey: ["/api/products/statistics"],
    queryFn: async () => {
      const response = await fetch("/api/products/statistics");
      if (!response.ok) throw new Error("Failed to fetch statistics");
      return response.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto excluído",
        description: "O produto foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o produto.",
        variant: "destructive",
      });
    },
  });

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  }, []);

  const handleViewClients = useCallback((product: Product) => {
    setSelectedProductForClients(product);
    setIsClientsModalOpen(true);
  }, []);

  const handleExportProducts = useCallback(() => {
    const exportData = products.map((product: Product) => ({
      "Nome do Vinho": product.name,
      País: product.country,
      Volume: product.volume,
      Tipo: product.type,
      "Valor de Tabela": `R$ ${parseFloat(
        product.negotiatedPrice,
      ).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      "Criado Por": product.createdByName || "Sistema",
      "Data de Criação": new Date(product.createdAt).toLocaleDateString(
        "pt-BR",
      ),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(dataBlob, `produtos_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast({
      title: "Exportação concluída",
      description: "Lista de produtos exportada com sucesso.",
    });
  }, [products, toast]);

  const getCountryFlag = (country: string) => {
    const flags: { [key: string]: string } = {
      CHILE: "🇨🇱",
      ARGENTINA: "🇦🇷",
      URUGUAI: "🇺🇾",
      BRASIL: "🇧🇷",
      EUA: "🇺🇸",
      FRANÇA: "🇫🇷",
      ITÁLIA: "🇮🇹",
      PORTUGAL: "🇵🇹",
      ESPANHA: "🇪🇸",
      ALEMANHA: "🇩🇪",
      OUTROS: "🌍",
    };
    return flags[country] || "🌍";
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      ESPUMANTE:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
      BRANCO:
        "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
      ROSE: "bg-pink-100 text-pink-800 dark:bg-pink-800 dark:text-pink-100",
      TINTO: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
      "PÓS-REFEIÇÃO":
        "bg-purple-100 text-purple-800 dark:bg-purple-100 dark:text-purple-100",
    };
    return colors[type] || "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-100";
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-700 dark:border px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-4">
            <Wine className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-200">
                Catálogo de Produtos
              </h2>
              <p className="text-gray-600 mt-1 dark:text-slate-400">
                Gerencie e explore o catálogo de vinhos e produtos.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            <Button
              onClick={handleExportProducts}
              variant="outline"
              disabled={products.length === 0}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button
              onClick={() => setIsProductModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>
      </div>

      {statisticsError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-700 font-medium">
              Erro ao carregar estatísticas: {statisticsError.message}
            </p>
          </CardContent>
        </Card>
      )}

      {statistics &&
        statistics.topCompaniesByProducts &&
        statistics.topProductsByCompanies && (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card className="border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-tl-md rounded-tr-md p-6">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-slate-200">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Clientes com Mais Vinhos
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1 dark:text-slate-400">
                  Top 10 clientes com maior variedade de produtos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {statistics.topCompaniesByProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-full mb-3">
                        <Award className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                      </div>
                      <p className="text-gray-900 font-medium dark:text-slate-200">
                        Nenhum dado disponível
                      </p>
                      <p className="text-gray-500 text-sm mt-1 dark:text-slate-400">
                        Aguarde clientes cadastrarem produtos
                      </p>
                    </div>
                  ) : (
                    statistics.topCompaniesByProducts.map(
                      (company: any, index: number) => (
                        <div
                          key={company.companyId}
                          className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-150"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                                index === 0
                                  ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400"
                                  : index === 1
                                    ? "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-400"
                                    : index === 2
                                      ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400"
                                      : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-slate-200">
                                {company.companyName}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-500 dark:text-slate-400">
                                  {company.companyCity}, {company.companyState}
                                </span>
                                {company.responsibleName && (
                                  <>
                                    <span className="text-gray-300 dark:text-slate-600">
                                      •
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-slate-400">
                                      {company.responsibleName}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900 dark:text-slate-200">
                              {company.productCount}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              vinhos
                            </div>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
              <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-6">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-slate-200">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  Vinhos Mais Populares
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-slate-400 mt-1">
                  Top 10 produtos mais presentes nas cartas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {statistics.topProductsByCompanies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-full mb-3">
                        <Wine className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                      </div>
                      <p className="text-gray-900 dark:text-slate-200 font-medium">
                        Nenhum dado disponível
                      </p>
                      <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                        Aguarde produtos serem adicionados às cartas
                      </p>
                    </div>
                  ) : (
                    statistics.topProductsByCompanies.map(
                      (product: any, index: number) => (
                        <div
                          key={product.productId}
                          className="flex items-start justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-150"
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-semibold mt-1 ${
                                index === 0
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-400"
                                  : index === 1
                                    ? "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-400"
                                    : index === 2
                                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-400"
                                      : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-slate-200 mb-2">
                                {product.productName}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 dark:bg-slate-800 dark:text-slate-400">
                                  {getCountryFlag(product.productCountry)}
                                  {product.productCountry}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {product.productVolume}
                                </Badge>
                                <Badge
                                  className={`text-xs ${getTypeColor(
                                    product.productType,
                                  )}`}
                                >
                                  {product.productType}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900 dark:text-slate-200">
                              {product.companyCount}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              clientes
                            </div>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      {!statistics && !statisticsError && !isFetching && (
        <Card className="border border-gray-200 dark:border-slate-700 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-full dark:bg-slate-800">
                <TrendingUp className="h-6 w-6 text-gray-400 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-gray-900 font-medium dark:text-slate-200">
                  Carregando estatísticas
                </p>
                <p className="text-gray-500 text-sm mt-1 dark:text-slate-400">
                  Analisando dados dos produtos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-gray-200 overflow-hidden dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-slate-200">
              <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                <Wine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Lista de Produtos ({totalProducts})
            </CardTitle>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 items-center gap-4 pt-6">
            <div className="relative sm:col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Todos os tipos</option>
              <option value="ESPUMANTE">Espumante</option>
              <option value="BRANCO">Branco</option>
              <option value="ROSE">Rose</option>
              <option value="TINTO">Tinto</option>
              <option value="PÓS-REFEIÇÃO">Pós-refeição</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Todos os países</option>
              <option value="CHILE">Chile</option>
              <option value="ARGENTINA">Argentina</option>
              <option value="URUGUAI">Uruguai</option>
              <option value="BRASIL">Brasil</option>
              <option value="EUA">EUA</option>
              <option value="FRANÇA">França</option>
              <option value="ITÁLIA">Itália</option>
              <option value="PORTUGAL">Portugal</option>
              <option value="ESPANHA">Espanha</option>
              <option value="ALEMANHA">Alemanha</option>
              <option value="OUTROS">Outros</option>
            </select>
            <select
              value={volumeFilter}
              onChange={(e) => setVolumeFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Todos os volumes</option>
              <option value="187ml">187ml</option>
              <option value="375ml">375ml</option>
              <option value="750ml">750ml</option>
              <option value="1.5L">1.5L</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0 ">
          <div className="border border-gray-200 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50 dark:bg-slate-800">
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4">
                    Nome do Vinho
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4 hidden sm:table-cell">
                    País
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4 hidden md:table-cell">
                    Volume
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4 hidden lg:table-cell">
                    Tipo
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4">
                    Valor
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4 hidden lg:table-cell">
                    Clientes
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4 hidden md:table-cell">
                    Criado por
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-900 dark:text-slate-200 px-6 py-4">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 px-6">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 dark:border-slate-700 border-t-blue-600"></div>
                        <div>
                          <p className="text-gray-900 dark:text-slate-200 font-medium">
                            Carregando produtos
                          </p>
                          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                            Aguarde alguns momentos
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : totalProducts === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 px-6">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-full">
                          <Wine className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="text-gray-900 dark:text-slate-200 font-medium">
                            {searchQuery ||
                            typeFilter ||
                            countryFilter ||
                            volumeFilter
                              ? "Nenhum produto encontrado"
                              : "Nenhum produto cadastrado"}
                          </p>
                          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                            {searchQuery ||
                            typeFilter ||
                            countryFilter ||
                            volumeFilter
                              ? "Tente ajustar os filtros de busca"
                              : "Comece adicionando seus primeiros produtos"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: Product) => (
                    <TableRow
                      key={product.id}
                      className="hover:bg-gray-50 border-b dark:hover:bg-slate-800 dark:border-slate-700 border-gray-100 transition-colors duration-150"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-slate-200 px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Wine className="h-4 w-4 text-gray-400 dark:text-slate-400 flex-shrink-0" />
                          <span className="truncate">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-slate-400">
                          <span className="text-lg">
                            {getCountryFlag(product.country)}
                          </span>
                          <span>{product.country}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell px-6 py-4">
                        <Badge
                          variant="outline"
                          className="border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-400"
                        >
                          {product.volume}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell px-6 py-4">
                        <Badge
                          className={`${getTypeColor(product.type)} border-0`}
                        >
                          {product.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900 dark:text-slate-200 px-6 py-4">
                        <span className="text-green-600">
                          R${" "}
                          {parseFloat(product.negotiatedPrice).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              product.clientCount > 0 ? "default" : "secondary"
                            }
                            className="cursor-pointer hover:bg-blue-600 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => handleViewClients(product)}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {product.clientCount}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewClients(product)}
                            className="text-xs h-6 px-2 text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800"
                          >
                            Ver clientes
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell px-6 py-4 text-gray-600 dark:text-slate-400">
                        <span className="text-sm">
                          {product.createdByName || "Sistema"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProduct(product)}
                            className="h-8 w-8 text-gray-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-slate-800"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-slate-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Excluir produto
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o produto "
                                  {product.name}"? Esta ação não pode ser
                                  desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteProductMutation.mutate(product.id)
                                  }
                                  className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 px-6 pb-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
              <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
                Mostrando {products.length} de {totalProducts} produtos
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      }
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem
                        className="hidden sm:flex"
                        key={pageNumber}
                      >
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className={`cursor-pointer ${
                            currentPage === pageNumber
                              ? "bg-blue-600 text-white hover:bg-blue-700 dark:text-slate-400 dark:bg-blue-700 dark:hover:bg-blue-800"
                              : "hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          }`}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductFormModal
        open={isProductModalOpen}
        onOpenChange={handleCloseModal}
        product={editingProduct}
      />

      {selectedProductForClients && (
        <ProductClientsModal
          open={isClientsModalOpen}
          onOpenChange={setIsClientsModalOpen}
          productId={selectedProductForClients.id}
          productName={selectedProductForClients.name}
        />
      )}

      <ProductImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
      />
    </div>
  );
}
