import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ProductFormModal } from "@/components/product-form-modal";
import { ProductClientsModal } from "@/components/product-clients-modal";
import ProductImportModal from "@/components/product-import-modal";
import { BlingProductSyncModal } from "@/components/bling-product-sync-modal";
import { queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Wine,
  MapPin,
  Ruler,
  Tag,
  DollarSign,
  Users,
  Calendar,
  User,
} from "lucide-react";

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
  imageUrl?: string | null;
}

export default function Products() {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBlingModalOpen, setIsBlingModalOpen] = useState(false);
  const [selectedProductForClients, setSelectedProductForClients] =
    useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForDetail, setSelectedProductForDetail] =
    useState<Product | null>(null);
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
    setSelectedProductForClients(product);
    setIsClientsModalOpen(true);
  }, []);

  const handleViewDetail = useCallback((product: Product) => {
    setSelectedProductForDetail(product);
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)] space-y-6 sm:space-y-8 pb-12">
      <ProductsHeader
        onImportClick={() => setIsImportModalOpen(true)}
        onExportClick={handleExportProducts}
        onNewProductClick={() => setIsProductModalOpen(true)}
        onBlingSync={() => setIsBlingModalOpen(true)}
        isExportPending={false} // Product export is synchronous here
        productsCount={totalProducts}
      />

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
          />

          <ProductsTable
            products={products}
            isFetching={isFetching}
            onEdit={handleEditProduct}
            onDelete={(id) => deleteProductMutation.mutate(id)}
            onViewClients={handleViewClients}
            onViewDetail={handleViewDetail}
            getCountryFlag={getCountryFlag}
            getTypeColor={getTypeColor}
            currentPage={currentPage}
            totalPages={totalPages}
            totalProducts={totalProducts}
            setCurrentPage={setCurrentPage}
          />
        </div>
      </div>

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

      <BlingProductSyncModal
        open={isBlingModalOpen}
        onOpenChange={setIsBlingModalOpen}
      />

      <Sheet
        open={!!selectedProductForDetail}
        onOpenChange={(open) => {
          if (!open) setSelectedProductForDetail(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedProductForDetail && (
            <>
              <SheetHeader className="mb-6">
                {selectedProductForDetail.imageUrl && (
                  <div className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 mb-5 bg-slate-50 dark:bg-slate-800/80 relative group shadow-sm flex items-center justify-center">
                    <img
                      src={selectedProductForDetail.imageUrl}
                      alt={selectedProductForDetail.name}
                      className="w-full h-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  {!selectedProductForDetail.imageUrl && (
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-blue-100/50 dark:border-slate-700/80 shrink-0 shadow-inner">
                      <Wine className="h-7 w-7 text-blue-500 dark:text-blue-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-left text-xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
                      {selectedProductForDetail.name}
                    </SheetTitle>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      REF: {selectedProductForDetail.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5">
                {/* Price highlight */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-3xl p-5 border border-emerald-100/60 dark:border-emerald-800/40 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay group-hover:bg-emerald-500/10 transition-colors" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                        Preço Unitário
                      </span>
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-300 tracking-tight">
                      R${" "}
                      {parseFloat(
                        selectedProductForDetail.negotiatedPrice,
                      ).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Origem
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl filter drop-shadow-sm">
                        {getCountryFlag(selectedProductForDetail.country)}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
                        {selectedProductForDetail.country}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Ruler className="h-4 w-4 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Volume
                      </span>
                    </div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                      {selectedProductForDetail.volume}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="h-4 w-4 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Variação
                      </span>
                    </div>
                    <Badge
                      className={`font-black uppercase text-[11px] tracking-widest shadow-sm ${getTypeColor(selectedProductForDetail.type)} border-0 px-2.5 py-1`}
                    >
                      {selectedProductForDetail.type}
                    </Badge>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl p-4 border border-blue-100/80 dark:border-blue-800/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay group-hover:bg-blue-500/10 transition-colors" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                          Vínculos
                        </span>
                      </div>
                      <p className="font-extrabold text-blue-800 dark:text-blue-300 text-2xl tracking-tight leading-none mb-1">
                        {selectedProductForDetail.clientCount}
                      </p>
                      <p className="text-[10px] font-black text-blue-600/70 dark:text-blue-400/80 uppercase tracking-widest">
                        clientes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Meta info */}
                <div className="space-y-3 pt-3">
                  <div className="flex items-center gap-4 py-3 px-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80">
                    <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-slate-600 shadow-sm">
                      <User className="h-4.5 w-4.5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Criado por
                      </p>
                      <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200">
                        {selectedProductForDetail.createdByName || "Sistema"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 py-3 px-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80">
                    <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-slate-600 shadow-sm">
                      <Calendar className="h-4.5 w-4.5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Data de criação
                      </p>
                      <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {new Date(
                          selectedProductForDetail.createdAt,
                        ).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
