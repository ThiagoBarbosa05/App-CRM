import { useState, useEffect } from "react";
import { Wine, X, Plus, Trash2 } from "lucide-react";
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

interface ProductGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSellerId: string | null;
  editingSellerName: string | null;
  existingGoals: ProductGoalRow[];
  sellers: Seller[];
  selectedMonth: number;
  selectedYear: number;
}

export function ProductGoalModal({
  open,
  onOpenChange,
  editingSellerId,
  editingSellerName,
  existingGoals,
  sellers,
  selectedMonth,
  selectedYear,
}: ProductGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSellerId, setSelectedSellerId] = useState(editingSellerId ?? "");
  const [selectedSellerName, setSelectedSellerName] = useState(editingSellerName ?? "");
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addProductName, setAddProductName] = useState("");
  const [addQty, setAddQty] = useState("1");

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
    }
  }, [open, editingSellerId, editingSellerName]);

  const { data: productsData } = useQuery<{ data: { id: string; name: string; type?: string }[] }>({
    queryKey: ["/api/products", productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (productSearch.trim()) params.set("name", productSearch.trim());
      const res = await fetch(`/api/products?${params}`);
      return res.json();
    },
    enabled: open && showProductList,
  });
  const productOptions = productsData?.data ?? [];

  const addMutation = useMutation({
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

  const deleteMutation = useMutation({
    mutationFn: (goalId: string) => apiRequest("DELETE", `/api/product-goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/product-goals/${selectedMonth}/${selectedYear}`] });
      toast({ title: "Meta removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const canAdd = selectedSellerId && addProductId && Number(addQty) >= 1;

  const sellerGoals = existingGoals.filter((g) => g.userId === selectedSellerId);

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

          {/* Conteúdo visível apenas depois de escolher o vendedor */}
          {selectedSellerId && (
            <>
              {/* Produtos já adicionados */}
              {sellerGoals.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Produtos na meta ({sellerGoals.length})
                  </Label>
                  <div className="space-y-2">
                    {sellerGoals.map((g) => (
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
                          onClick={() => deleteMutation.mutate(g.id)}
                          disabled={deleteMutation.isPending}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulário para adicionar novo produto */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-violet-500" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Adicionar produto
                  </Label>
                </div>

                {/* Produto selecionado */}
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
                      placeholder="Buscar vinho por nome..."
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setShowProductList(true); }}
                      onFocus={() => setShowProductList(true)}
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

                {/* Quantidade */}
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
                      onClick={() => addMutation.mutate()}
                      disabled={!canAdd || addMutation.isPending}
                      className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-widest shadow-md shadow-violet-500/20 shrink-0"
                    >
                      {addMutation.isPending ? "Adicionando..." : "Adicionar"}
                    </Button>
                  </div>
                )}
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
