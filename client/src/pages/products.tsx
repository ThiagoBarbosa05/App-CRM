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
        product.negotiatedPrice
      ).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      "Criado Por": product.createdByName || "Sistema",
      "Data de Criação": new Date(product.createdAt).toLocaleDateString(
        "pt-BR"
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
      ESPUMANTE: "bg-yellow-100 text-yellow-800",
      BRANCO: "bg-green-100 text-green-800",
      ROSE: "bg-pink-100 text-pink-800",
      TINTO: "bg-red-100 text-red-800",
      "PÓS-REFEIÇÃO": "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Catálogo de Produtos
            </h2>
            <p className="text-gray-600 mt-1">
              Gerencie e explore o catálogo de vinhos e produtos.
            </p>
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
            <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-blue-600" />
                  Clientes com Mais Vinhos
                </CardTitle>
                <CardDescription>
                  Top 10 clientes com maior variedade de produtos na carta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statistics.topCompaniesByProducts.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    statistics.topCompaniesByProducts.map(
                      (company: any, index: number) => (
                        <div
                          key={company.companyId}
                          className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0
                                  ? "bg-yellow-400 text-white"
                                  : index === 1
                                  ? "bg-gray-400 text-white"
                                  : index === 2
                                  ? "bg-orange-400 text-white"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {company.companyName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {company.companyCity}, {company.companyState}
                              </p>
                              {company.responsibleName && (
                                <p className="text-xs text-gray-500">
                                  Resp.: {company.responsibleName}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="font-bold text-sm"
                          >
                            {company.productCount} vinhos
                          </Badge>
                        </div>
                      )
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md border-gray-200 transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-wine-600" />
                  Vinhos Mais Populares
                </CardTitle>
                <CardDescription>
                  Top 10 produtos mais presentes nas cartas dos clientes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statistics.topProductsByCompanies.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    statistics.topProductsByCompanies.map(
                      (product: any, index: number) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0
                                  ? "bg-yellow-400 text-white"
                                  : index === 1
                                  ? "bg-gray-400 text-white"
                                  : index === 2
                                  ? "bg-orange-400 text-white"
                                  : "bg-wine-100 text-wine-700"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {product.productName}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>
                                  {getCountryFlag(product.productCountry)}{" "}
                                  {product.productCountry}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {product.productVolume}
                                </Badge>
                                <Badge
                                  className={`text-xs ${getTypeColor(
                                    product.productType
                                  )}`}
                                >
                                  {product.productType}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="font-bold text-sm"
                          >
                            {product.companyCount} clientes
                          </Badge>
                        </div>
                      )
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      {!statistics && !statisticsError && !isFetching && (
        <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Carregando estatísticas...</p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Lista de Produtos ({totalProducts})</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 items-center gap-4 pt-4">
            <div className="relative  sm:col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10  w-full"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Todos os volumes</option>
              <option value="187ml">187ml</option>
              <option value="375ml">375ml</option>
              <option value="750ml">750ml</option>
              <option value="1.5L">1.5L</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-300 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-300">
                  <TableHead className="font-semibold">Nome do Vinho</TableHead>
                  <TableHead className="font-semibold hidden sm:table-cell">
                    País
                  </TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">
                    Volume
                  </TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">
                    Tipo
                  </TableHead>
                  <TableHead className="font-semibold">Valor</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">
                    Clientes
                  </TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">
                    Criado por
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="ml-4 text-gray-600">
                          Carregando produtos...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : totalProducts === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <p className="text-lg text-gray-500">
                        {searchQuery ||
                        typeFilter ||
                        countryFilter ||
                        volumeFilter
                          ? "Nenhum produto encontrado com os filtros aplicados."
                          : "Nenhum produto cadastrado."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: Product) => (
                    <TableRow
                      key={product.id}
                      className="hover:bg-gray-50 text-xs sm:text-sm border-gray-300 transition-colors"
                    >
                      <TableCell className="font-medium truncate text-gray-800">
                        {product.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <span>{getCountryFlag(product.country)}</span>
                          {product.country}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{product.volume}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className={getTypeColor(product.type)}>
                          {product.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold truncate">
                        R${" "}
                        {parseFloat(product.negotiatedPrice).toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center">
                          <Badge
                            variant={
                              product.clientCount > 0 ? "default" : "secondary"
                            }
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleViewClients(product)}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {product.clientCount}
                          </Badge>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleViewClients(product)}
                            className="text-xs px-2 py-1 h-6 text-blue-600 hover:text-blue-800"
                          >
                            Ver clientes
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600">
                        {product.createdByName || "Sistema"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProduct(product)}
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700"
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
                                  className="bg-red-600 hover:bg-red-700"
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
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
              <p className="text-sm text-gray-600">
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
                          : "cursor-pointer"
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
                          className="cursor-pointer"
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
                          : "cursor-pointer"
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
