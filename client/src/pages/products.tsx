import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ProductFormModal } from "@/components/product-form-modal";
import { ProductClientsModal } from "@/components/product-clients-modal";
import ProductImportModal from "@/components/product-import-modal";
import { queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Extracted Components
import { ProductsHeader } from "@/components/products/products-header";
import { ProductsStatistics } from "@/components/products/products-statistics";
import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsTable } from "@/components/products/products-table";

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

  const { data: statistics, isLoading: isLoadingStats, error: statisticsError } = useQuery({
    queryKey: ["/api/products/statistics"],
    queryFn: async () => {
      const response = await fetch("/api/products/statistics");
      if (!response.ok) throw new Error("Failed to fetch statistics");
      return response.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000,
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
      ESPUMANTE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      BRANCO: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
      ROSE: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
      TINTO: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      "PÓS-REFEIÇÃO": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };
    return colors[type] || "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6">
      <ProductsHeader
        onImportClick={() => setIsImportModalOpen(true)}
        onExportClick={handleExportProducts}
        onNewProductClick={() => setIsProductModalOpen(true)}
        isExportPending={false} // Product export is synchronous here
        productsCount={totalProducts}
      />

      <ProductsStatistics
        statistics={statistics}
        isLoading={isLoadingStats}
        error={statisticsError}
        getCountryFlag={getCountryFlag}
        getTypeColor={getTypeColor}
      />

      <ProductsFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        volumeFilter={volumeFilter}
        setVolumeFilter={setVolumeFilter}
      />

      <ProductsTable
        products={products}
        isFetching={isFetching}
        onEdit={handleEditProduct}
        onDelete={(id) => deleteProductMutation.mutate(id)}
        onViewClients={handleViewClients}
        getCountryFlag={getCountryFlag}
        getTypeColor={getTypeColor}
        currentPage={currentPage}
        totalPages={totalPages}
        totalProducts={totalProducts}
        setCurrentPage={setCurrentPage}
      />

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
