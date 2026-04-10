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
import { Wine, MapPin, Ruler, Tag, DollarSign, Users, Calendar, User } from "lucide-react";

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
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
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
        onBlingSync={() => setIsBlingModalOpen(true)}
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
        onViewDetail={handleViewDetail}
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

      <BlingProductSyncModal
        open={isBlingModalOpen}
        onOpenChange={setIsBlingModalOpen}
      />

      <Sheet
        open={!!selectedProductForDetail}
        onOpenChange={(open) => { if (!open) setSelectedProductForDetail(null); }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedProductForDetail && (
            <>
              <SheetHeader className="mb-6">
                {selectedProductForDetail.imageUrl && (
                  <div className="w-full h-52 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 mb-4 bg-slate-50 dark:bg-slate-800">
                    <img
                      src={selectedProductForDetail.imageUrl}
                      alt={selectedProductForDetail.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {!selectedProductForDetail.imageUrl && (
                    <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shrink-0">
                      <Wine className="h-6 w-6 text-blue-500 dark:text-blue-400" />
                    </div>
                  )}
                  <div>
                    <SheetTitle className="text-left text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                      {selectedProductForDetail.name}
                    </SheetTitle>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      REF: {selectedProductForDetail.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {/* Price highlight */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Preço Unitário</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    R$ {parseFloat(selectedProductForDetail.negotiatedPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Origem</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCountryFlag(selectedProductForDetail.country)}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">
                        {selectedProductForDetail.country}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Ruler className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volume</span>
                    </div>
                    <p className="font-black text-slate-700 dark:text-slate-300 text-sm">{selectedProductForDetail.volume}</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Variação</span>
                    </div>
                    <Badge className={`font-black uppercase text-[10px] shadow-sm ${getTypeColor(selectedProductForDetail.type)} border-0`}>
                      {selectedProductForDetail.type}
                    </Badge>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/40">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Vínculos</span>
                    </div>
                    <p className="font-black text-blue-700 dark:text-blue-300 text-xl">{selectedProductForDetail.clientCount}</p>
                    <p className="text-[10px] font-bold text-blue-500/70 uppercase">clientes</p>
                  </div>
                </div>

                {/* Meta info */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3 py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <User className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Criado por</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {selectedProductForDetail.createdByName || "Sistema"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de criação</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {new Date(selectedProductForDetail.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
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
