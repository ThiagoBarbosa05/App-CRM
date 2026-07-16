import { useState, useEffect } from "react";
import { Wine, X, Plus, Trash2, Factory, CalendarDays, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Seller {
  id: string;
  name: string;
  role: string;
}

interface ProductGoalRow {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productGoalQty: number;
  achieved: number;
}

interface WineryGoalRow {
  id: string;
  userId: string;
  wineryName: string;
  goalQty: number;
  startDate: string;
  endDate: string;
  achieved: number;
}

interface CategoryGoalRow {
  id: string;
  userId: string;
  categoryName: string;
  goalQty: number;
  startDate: string;
  endDate: string;
  achieved: number;
}

interface ProductGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSellerId: string | null;
  editingSellerName: string | null;
  existingGoals: ProductGoalRow[];
  wineryGoals: WineryGoalRow[];
  categoryGoals: CategoryGoalRow[];
  sellers: Seller[];
  selectedMonth: number;
  selectedYear: number;
}

function formatDateBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ProductGoalModal({
  open,
  onOpenChange,
  editingSellerId,
  editingSellerName,
  existingGoals,
  wineryGoals,
  categoryGoals,
  sellers,
  selectedMonth,
  selectedYear,
}: ProductGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Produto ───────────────────────────────────────────────────
  const [selectedSellerId, setSelectedSellerId] = useState(editingSellerId ?? "");
  const [selectedSellerName, setSelectedSellerName] = useState(editingSellerName ?? "");
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addProductName, setAddProductName] = useState("");
  const [addQty, setAddQty] = useState("1");

  // ─── Vinícola ──────────────────────────────────────────────────
  const [winerySearch, setWinerySearch] = useState("");
  const [showWineryList, setShowWineryList] = useState(false);
  const [addWineryName, setAddWineryName] = useState("");
  const [wineryQty, setWineryQty] = useState("1");
  const [wineryStartDate, setWineryStartDate] = useState("");
  const [wineryEndDate, setWineryEndDate] = useState("");

  // ─── Categoria ─────────────────────────────────────────────────
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [addCategoryName, setAddCategoryName] = useState("");
  const [categoryQty, setCategoryQty] = useState("1");
  const [categoryStartDate, setCategoryStartDate] = useState("");
  const [categoryEndDate, setCategoryEndDate] = useState("");

  const sellerList = sellers.filter((u) => u.role === "vendedor");
  const isEditing = !!editingSellerId;

  useEffect(() => {
    if (open) {
      setSelectedSellerId(editingSellerId ?? "");
      setSelectedSellerName(editingSellerName ?? "");
      setProductSearch("");
      setShowProductList(false);
      setAddProductId("");
      setAddProductName("");
      setAddQty("1");
      setWinerySearch("");
      setShowWineryList(false);
      setAddWineryName("");
      setWineryQty("1");
      setWineryStartDate("");
      setWineryEndDate("");
      setCategorySearch("");
      setShowCategoryList(false);
      setAddCategoryName("");
      setCategoryQty("1");
      setCategoryStartDate("");
      setCategoryEndDate("");
    }
  }, [open, editingSellerId, editingSellerName]);

  // ─── Queries ───────────────────────────────────────────────────
  const { data: productsData } = useQuery<{ data: { id: string; name: string; type?: string }[] }>({
    queryKey: ["/api/products", productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (productSearch.trim()) params.set("name", productSearch.trim());
      const res = await fetch(`/api/products?${params}`);
      return res.json();
    },
    enabled: open && showProductList && productSearch.trim().length >= 3,
  });
  const productOptions = productsData?.data ?? [];

  const { data: wineriesData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/wineries"],
    enabled: open,
  });
  const wineryOptions = winerySearch.trim().length >= 3
    ? (wineriesData ?? []).filter((w) =>
        w.name.toLowerCase().includes(winerySearch.toLowerCase())
      )
    : [];

  const { data: categoriesData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/product-categories"],
    enabled: open,
  });
  const categoryOptions = categorySearch.trim().length >= 3
    ? (categoriesData ?? []).filter((c) =>
        c.name.toLowerCase().includes(categorySearch.toLowerCase())
      )
    : [];

  // ─── Mutations produto ─────────────────────────────────────────
  const addProductMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/product-goals", {
        userId: selectedSellerId,
        month: selectedMonth,
        year: selectedYear,
        productId: addProductId,
        productGoalQty: Number(addQty),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/product-goals/${selectedMonth}/${selectedYear}`] });
      toast({ title: "Produto adicionado", description: `${addProductName} adicionado como meta.` });
      setAddProductId("");
      setAddProductName("");
      setAddQty("1");
      setProductSearch("");
      setShowProductList(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (goalId: string) => apiRequest("DELETE", `/api/product-goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/product-goals/${selectedMonth}/${selectedYear}`] });
      toast({ title: "Meta removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ─── Mutations vinícola ────────────────────────────────────────
  const addWineryMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/winery-goals", {
        userId: selectedSellerId,
        wineryName: addWineryName,
        goalQty: Number(wineryQty),
        startDate: wineryStartDate,
        endDate: wineryEndDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/winery-goals"] });
      toast({ title: "Meta de vinícola adicionada", description: `Meta para ${addWineryName} criada.` });
      setAddWineryName("");
      setWineryQty("1");
      setWineryStartDate("");
      setWineryEndDate("");
      setWinerySearch("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteWineryMutation = useMutation({
    mutationFn: (goalId: string) => apiRequest("DELETE", `/api/winery-goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/winery-goals"] });
      toast({ title: "Meta de vinícola removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ─── Mutations categoria ───────────────────────────────────────
  const addCategoryMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/category-goals", {
        userId: selectedSellerId,
        categoryName: addCategoryName,
        goalQty: Number(categoryQty),
        startDate: categoryStartDate,
        endDate: categoryEndDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/category-goals"] });
      toast({ title: "Meta de categoria adicionada", description: `Meta para ${addCategoryName} criada.` });
      setAddCategoryName("");
      setCategoryQty("1");
      setCategoryStartDate("");
      setCategoryEndDate("");
      setCategorySearch("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (goalId: string) => apiRequest("DELETE", `/api/category-goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/category-goals"] });
      toast({ title: "Meta de categoria removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const canAddProduct = selectedSellerId && addProductId && Number(addQty) >= 1;
  const canAddWinery =
    selectedSellerId &&
    addWineryName &&
    Number(wineryQty) >= 1 &&
    wineryStartDate &&
    wineryEndDate &&
    wineryStartDate <= wineryEndDate;
  const canAddCategory =
    selectedSellerId &&
    addCategoryName &&
    Number(categoryQty) >= 1 &&
    categoryStartDate &&
    categoryEndDate &&
    categoryStartDate <= categoryEndDate;

  const sellerProductGoals = existingGoals.filter((g) => g.userId === selectedSellerId);
  const sellerWineryGoals = wineryGoals.filter((g) => g.userId === selectedSellerId);
  const sellerCategoryGoals = categoryGoals.filter((g) => g.userId === selectedSellerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-28 h-28 bg-white/5 rounded-full blur-2xl" />
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
                <Wine className="h-5 w-5 text-white" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white text-balance">
              {isEditing ? "Metas de Produto" : "Nova Meta de Produto"}
            </DialogTitle>
            <p className="text-violet-200 text-sm font-medium mt-1 capitalize">
              {isEditing && editingSellerName
                ? `${editingSellerName} · ${monthLabel}`
                : monthLabel}
            </p>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Seletor de vendedor — apenas no modo "nova meta" */}
          {!isEditing && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Vendedor
              </Label>
              <select
                value={selectedSellerId}
                onChange={(e) => {
                  const seller = sellerList.find((s) => s.id === e.target.value);
                  setSelectedSellerId(e.target.value);
                  setSelectedSellerName(seller?.name ?? "");
                }}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all"
              >
                <option value="">Selecione um vendedor</option>
                {sellerList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedSellerId && (
            <>
              {/* ══════════════ SEÇÃO: PRODUTO ══════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Wine className="h-4 w-4 text-violet-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">
                    Meta por Produto
                  </span>
                </div>

                {/* Produtos já adicionados */}
                {sellerProductGoals.length > 0 && (
                  <div className="space-y-2">
                    {sellerProductGoals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 dark:border-violet-900/30 bg-violet-50/60 dark:bg-violet-900/10 px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Wine className="h-4 w-4 text-violet-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                              {g.productName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Meta: {g.productGoalQty} un · Realizado: {g.achieved} un
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteProductMutation.mutate(g.id)}
                          disabled={deleteProductMutation.isPending}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form adicionar produto */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-violet-500" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Adicionar produto
                    </Label>
                  </div>

                  {addProductName ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wine className="h-4 w-4 text-violet-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {addProductName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setAddProductId(""); setAddProductName(""); setProductSearch(""); }}
                        className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Digite 3 letras para buscar..."
                        value={productSearch}
                        onChange={(e) => {
                          const v = e.target.value;
                          setProductSearch(v);
                          setShowProductList(v.trim().length >= 3);
                        }}
                        className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium focus:border-violet-400 focus:ring-violet-400/20"
                      />
                      {showProductList && productOptions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-48 overflow-y-auto">
                          {productOptions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-slate-50 dark:border-slate-800 last:border-0"
                              onClick={() => {
                                setAddProductId(p.id);
                                setAddProductName(p.name);
                                setShowProductList(false);
                                setProductSearch("");
                              }}
                            >
                              <p className="font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
                              {p.type && <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{p.type}</p>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {addProductName && (
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                          Quantidade alvo (un)
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={addQty}
                          onChange={(e) => setAddQty(e.target.value)}
                          placeholder="Ex: 10"
                          className="h-11 rounded-xl bg-white dark:bg-slate-900 font-bold"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => addProductMutation.mutate()}
                        disabled={!canAddProduct || addProductMutation.isPending}
                        className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-widest shadow-md shadow-violet-500/20 shrink-0"
                      >
                        {addProductMutation.isPending ? "Adicionando..." : "Adicionar"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Divisor */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ou</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* ══════════════ SEÇÃO: VINÍCOLA ══════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                    Meta por Vinícola
                  </span>
                </div>

                {/* Vinícolas já adicionadas */}
                {sellerWineryGoals.length > 0 && (
                  <div className="space-y-2">
                    {sellerWineryGoals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-900/10 px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Factory className="h-4 w-4 text-amber-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                              {g.wineryName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Meta: {g.goalQty} un · Realizado: {g.achieved} un · {formatDateBR(g.startDate)} → {formatDateBR(g.endDate)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteWineryMutation.mutate(g.id)}
                          disabled={deleteWineryMutation.isPending}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form adicionar vinícola */}
                <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/10 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-amber-500" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Adicionar meta por vinícola
                    </Label>
                  </div>

                  {/* Seletor de vinícola */}
                  {addWineryName ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Factory className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {addWineryName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setAddWineryName(""); setWinerySearch(""); }}
                        className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Digite 3 letras para buscar..."
                        value={winerySearch}
                        onChange={(e) => {
                          const v = e.target.value;
                          setWinerySearch(v);
                          setShowWineryList(v.trim().length >= 3);
                        }}
                        className="h-11 rounded-xl bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 font-medium focus:border-amber-400 focus:ring-amber-400/20"
                      />
                      {showWineryList && wineryOptions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-48 overflow-y-auto">
                          {wineryOptions.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-slate-50 dark:border-slate-800 last:border-0"
                              onClick={() => {
                                setAddWineryName(w.name);
                                setShowWineryList(false);
                                setWinerySearch("");
                              }}
                            >
                              <p className="font-bold text-slate-800 dark:text-slate-200">{w.name}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {showWineryList && wineryOptions.length === 0 && winerySearch.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl px-4 py-3">
                          <p className="text-xs text-slate-400 font-medium">Nenhuma vinícola encontrada.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Datas e quantidade */}
                  {addWineryName && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Data início
                          </Label>
                          <Input
                            type="date"
                            value={wineryStartDate}
                            onChange={(e) => setWineryStartDate(e.target.value)}
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 font-bold text-sm focus:border-amber-400"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Data fim
                          </Label>
                          <Input
                            type="date"
                            value={wineryEndDate}
                            min={wineryStartDate}
                            onChange={(e) => setWineryEndDate(e.target.value)}
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 font-bold text-sm focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            Quantidade alvo (un)
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={wineryQty}
                            onChange={(e) => setWineryQty(e.target.value)}
                            placeholder="Ex: 50"
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 font-bold border-amber-200 dark:border-amber-900/50"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => addWineryMutation.mutate()}
                          disabled={!canAddWinery || addWineryMutation.isPending}
                          className="h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest shadow-md shadow-amber-500/20 shrink-0"
                        >
                          {addWineryMutation.isPending ? "Adicionando..." : "Adicionar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Divisor */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ou</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* ══════════════ SEÇÃO: CATEGORIA ══════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Meta por Categoria
                  </span>
                </div>

                {/* Categorias já adicionadas */}
                {sellerCategoryGoals.length > 0 && (
                  <div className="space-y-2">
                    {sellerCategoryGoals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-900/10 px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Tag className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                              {g.categoryName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Meta: {g.goalQty} un · Realizado: {g.achieved} un · {formatDateBR(g.startDate)} → {formatDateBR(g.endDate)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCategoryMutation.mutate(g.id)}
                          disabled={deleteCategoryMutation.isPending}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form adicionar categoria */}
                <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-900/10 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-emerald-500" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Adicionar meta por categoria
                    </Label>
                  </div>

                  {addCategoryName ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {addCategoryName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setAddCategoryName(""); setCategorySearch(""); }}
                        className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Digite 3 letras para buscar..."
                        value={categorySearch}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCategorySearch(v);
                          setShowCategoryList(v.trim().length >= 3);
                        }}
                        className="h-11 rounded-xl bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50 font-medium focus:border-emerald-400 focus:ring-emerald-400/20"
                      />
                      {showCategoryList && categoryOptions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-48 overflow-y-auto">
                          {categoryOptions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-slate-50 dark:border-slate-800 last:border-0"
                              onClick={() => {
                                setAddCategoryName(c.name);
                                setShowCategoryList(false);
                                setCategorySearch("");
                              }}
                            >
                              <p className="font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {showCategoryList && categoryOptions.length === 0 && categorySearch.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl px-4 py-3">
                          <p className="text-xs text-slate-400 font-medium">Nenhuma categoria encontrada.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {addCategoryName && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Data início
                          </Label>
                          <Input
                            type="date"
                            value={categoryStartDate}
                            onChange={(e) => setCategoryStartDate(e.target.value)}
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50 font-bold text-sm focus:border-emerald-400"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Data fim
                          </Label>
                          <Input
                            type="date"
                            value={categoryEndDate}
                            min={categoryStartDate}
                            onChange={(e) => setCategoryEndDate(e.target.value)}
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50 font-bold text-sm focus:border-emerald-400"
                          />
                        </div>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            Quantidade alvo (un)
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={categoryQty}
                            onChange={(e) => setCategoryQty(e.target.value)}
                            placeholder="Ex: 30"
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 font-bold border-emerald-200 dark:border-emerald-900/50"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => addCategoryMutation.mutate()}
                          disabled={!canAddCategory || addCategoryMutation.isPending}
                          className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-md shadow-emerald-500/20 shrink-0"
                        >
                          {addCategoryMutation.isPending ? "Adicionando..." : "Adicionar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Rodapé */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
