import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ProductFormModal } from "@/components/product-form-modal";
import ProductImportModal from "@/components/product-import-modal";
import { BlingProductSyncModal } from "@/components/bling-product-sync-modal";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { Download, Merge, Pencil, Plus, RefreshCw, Upload, Wine, X, Copy } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { getCountryFlag } from "@/lib/country-flags";

// Extracted Components
import { ProductsStatistics } from "@/components/products/products-statistics";
import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsTable } from "@/components/products/products-table";
import { ProductsBulkEditModal } from "@/components/products/products-bulk-edit-modal";
import { MergeProductsModal } from "@/components/products/merge-products-modal";
import { Button } from "@/components/ui/button";

interface Product {
  id: string;
  name: string;
  winery?: string | null;
  category?: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
  imageUrl?: string | null;
}

export default function Products() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBlingModalOpen, setIsBlingModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [debouncedTypeFilter, setDebouncedTypeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [debouncedCountryFilter, setDebouncedCountryFilter] = useState("");
  const [volumeFilter, setVolumeFilter] = useState("");
  const [debouncedVolumeFilter, setDebouncedVolumeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [debouncedCategoryFilter, setDebouncedCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setDebouncedTypeFilter(typeFilter);
      setDebouncedCountryFilter(countryFilter);
      setDebouncedVolumeFilter(volumeFilter);
      setDebouncedCategoryFilter(categoryFilter);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, typeFilter, countryFilter, volumeFilter, categoryFilter]);

  const { data, isFetching } = useQuery({
    queryKey: [
      "/api/products",
      debouncedSearchQuery,
      debouncedTypeFilter,
      debouncedCountryFilter,
      debouncedVolumeFilter,
      debouncedCategoryFilter,
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
      if (debouncedCategoryFilter)
        params.append("category", debouncedCategoryFilter);
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

  // Seleção em massa vale só para a página visível — limpa ao trocar de página/filtro
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, debouncedSearchQuery, debouncedTypeFilter, debouncedCountryFilter, debouncedVolumeFilter, debouncedCategoryFilter]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const product of products as Product[]) {
        if (checked) {
          next.add(product.id);
        } else {
          next.delete(product.id);
        }
      }
      return next;
    });
  };

  const {
    data: statistics,
    isLoading: isLoadingStats,
    error: statisticsError,
  } = useQuery({
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
    navigate(`/products/${product.id}?tab=buyers`);
  }, [navigate]);

  const handleExportProducts = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("name", debouncedSearchQuery);
      if (debouncedTypeFilter) params.append("type", debouncedTypeFilter);
      if (debouncedCountryFilter) params.append("country", debouncedCountryFilter);
      if (debouncedVolumeFilter) params.append("volume", debouncedVolumeFilter);
      if (debouncedCategoryFilter) params.append("category", debouncedCategoryFilter);
      params.append("page", "1");
      params.append("pageSize", "10000");

      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error("Falha ao buscar produtos");
      const result = await response.json();
      const allProducts: Product[] = result.data || [];

      const exportData = allProducts.map((product: Product) => ({
        "Nome do Vinho": product.name,
        País: product.country,
        Volume: product.volume,
        Tipo: product.type,
        "Valor de Tabela": `R$ ${parseFloat(product.negotiatedPrice).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        "Criado Por": product.createdByName || "Sistema",
        "Data de Criação": new Date(product.createdAt).toLocaleDateString("pt-BR"),
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
        description: `${allProducts.length} produto(s) exportado(s) com sucesso.`,
      });
    } catch {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os produtos.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearchQuery, debouncedTypeFilter, debouncedCountryFilter, debouncedVolumeFilter, debouncedCategoryFilter, toast]);

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      ESPUMANTE:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      BRANCO:
        "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
      ROSE: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
      TINTO: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      "PÓS-REFEIÇÃO":
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };
    return (
      colors[type] ||
      "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300"
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Wine}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>Catálogo de Produtos</PageHeader.Title>
            <PageHeader.Description>
              Gerencie e explore seu portfólio de vinhos
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions className="flex-wrap w-full md:w-auto mt-4 md:mt-0 justify-start sm:justify-end gap-2">
          {isAdmin && (
            <Link href="/products/duplicatas">
              <Button
                variant="outline"
                size="sm"
                className="h-11 px-5 rounded-xl w-full sm:w-auto flex-1 sm:flex-none border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/20"
              >
                <Copy className="mr-2 h-4 w-4 shrink-0" />
                Duplicatas
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBlingModalOpen(true)}
            className="h-11 px-5 rounded-xl w-full sm:w-auto flex-1 sm:flex-none"
          >
            <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
            Sincronizar Bling
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="h-11 px-5 rounded-xl w-full sm:w-auto flex-1 sm:flex-none"
            >
              <Upload className="mr-2 h-4 w-4 shrink-0" />
              Importar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProducts}
            disabled={isExporting}
            className="h-11 px-5 rounded-xl w-full sm:w-auto flex-1 sm:flex-none"
          >
            <Download className={`mr-2 h-4 w-4 shrink-0 ${isExporting ? "animate-bounce" : ""}`} />
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
          {isAdmin && (
            <Button
              onClick={() => setIsProductModalOpen(true)}
              className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl w-full sm:w-auto flex-1 sm:flex-none"
            >
              <Plus className="mr-2 h-4 w-4 shrink-0" />
              Novo Produto
            </Button>
          )}
        </PageHeader.Actions>
      </PageHeader>

      <div className="flex flex-col gap-6">
        <ProductsStatistics
          statistics={statistics}
          isLoading={isLoadingStats}
          error={statisticsError}
          getCountryFlag={getCountryFlag}
          getTypeColor={getTypeColor}
        />

        <div className="space-y-5">
          <ProductsFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            countryFilter={countryFilter}
            setCountryFilter={setCountryFilter}
            volumeFilter={volumeFilter}
            setVolumeFilter={setVolumeFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
          />

          {isAdmin && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200/60 dark:border-violet-800/40">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
                {selectedIds.size} produto{selectedIds.size > 1 ? "s" : ""} selecionado
                {selectedIds.size > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="gap-1.5 text-slate-500"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar seleção
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsBulkEditModalOpen(true)}
                  variant="outline"
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar em massa
                </Button>
                {selectedIds.size >= 2 && (
                  <Button
                    size="sm"
                    onClick={() => setIsMergeModalOpen(true)}
                    className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Merge className="h-3.5 w-3.5" />
                    Unificar
                  </Button>
                )}
              </div>
            </div>
          )}

          <ProductsTable
            products={products}
            isFetching={isFetching}
            onEdit={handleEditProduct}
            onDelete={(id) => deleteProductMutation.mutate(id)}
            onViewClients={handleViewClients}
            onViewDetail={(product) => navigate(`/products/${product.id}`)}
            getCountryFlag={getCountryFlag}
            getTypeColor={getTypeColor}
            currentPage={currentPage}
            totalPages={totalPages}
            totalProducts={totalProducts}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={(size) => { setPageSize(size); setCurrentPage(1); }}
            selectable={isAdmin}
            canManage={isAdmin}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectPage={handleToggleSelectPage}
          />
        </div>
      </div>

      {isAdmin && (
        <ProductsBulkEditModal
          open={isBulkEditModalOpen}
          onOpenChange={setIsBulkEditModalOpen}
          productIds={Array.from(selectedIds)}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}

      {isAdmin && isMergeModalOpen && (
        <MergeProductsModal
          open={isMergeModalOpen}
          onOpenChange={setIsMergeModalOpen}
          products={(products as Product[]).filter((p) => selectedIds.has(p.id))}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}

      <ProductFormModal
        open={isProductModalOpen}
        onOpenChange={handleCloseModal}
        product={editingProduct}
      />

      <ProductImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
      />

      <BlingProductSyncModal
        open={isBlingModalOpen}
        onOpenChange={setIsBlingModalOpen}
      />
    </div>
  );
}
