import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import type { Product } from "@shared/schema";
import type { CartItem } from "@/pages/restaurant-pdv/pos";

interface ProductsResponse {
  data: Product[];
}

interface CategoriesResponse {
  categories: string[];
}

interface OrderItemSelectorProps {
  blingConnectionId: string | null;
  cart: CartItem[];
  onAddProduct: (product: Product) => void;
  onCartIncrement: (id: string) => void;
  onCartDecrement: (id: string) => void;
  onCartRemove: (id: string) => void;
  onCartNoteChange: (id: string, notes: string) => void;
  onSubmitCart: () => void;
  submitPending: boolean;
  cartSubtotal: number;
}

export function OrderItemSelector({
  blingConnectionId,
  cart,
  onAddProduct,
  onCartIncrement,
  onCartDecrement,
  onCartRemove,
  onCartNoteChange,
  onSubmitCart,
  submitPending,
  cartSubtotal,
}: OrderItemSelectorProps) {
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedProductSearch(productSearch), 400);
    return () => clearTimeout(handler);
  }, [productSearch]);

  // Limpa a categoria selecionada quando o usuário digita uma busca
  useEffect(() => {
    if (productSearch) setSelectedCategory(null);
  }, [productSearch]);

  const { data: categoriesResponse } = useQuery<CategoriesResponse>({
    queryKey: ["/api/restaurant-pdv/products/categories", { connectionId: blingConnectionId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("connectionId", blingConnectionId!);
      const res = await fetch(`/api/restaurant-pdv/products/categories?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar categorias");
      return res.json();
    },
    enabled: !!blingConnectionId,
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoriesResponse?.categories ?? [];

  const { data: productsResponse, isFetching: isFetchingProducts } =
    useQuery<ProductsResponse>({
      queryKey: ["/api/restaurant-pdv/products", { connectionId: blingConnectionId, name: debouncedProductSearch, category: selectedCategory }],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append("connectionId", blingConnectionId!);
        if (debouncedProductSearch) params.append("name", debouncedProductSearch);
        if (selectedCategory) params.append("category", selectedCategory);
        params.append("pageSize", "100");
        const res = await fetch(`/api/restaurant-pdv/products?${params.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao buscar produtos");
        return res.json();
      },
      enabled: !!blingConnectionId,
    });
  const products = productsResponse?.data ?? [];

  const getCartQty = (productId: string) =>
    cart.find((c) => c.productId === productId)?.quantity ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Barra de busca ───────────────────────────────────────── */}
      <div className="shrink-0 border-b bg-muted/30 px-3 py-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            className="pl-8"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            disabled={!blingConnectionId}
          />
          {isFetchingProducts && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* ── Chips de categoria ────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedCategory === null
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setProductSearch("");
                  setSelectedCategory(cat === selectedCategory ? null : cat);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedCategory === cat
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Grade de produtos ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {!blingConnectionId ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Nenhum catálogo Bling configurado. Configure em Configurações → editar unidade.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {products.map((product) => {
              const qty = getCartQty(product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => onAddProduct(product)}
                  disabled={submitPending}
                  className="relative flex flex-col items-start rounded-xl border-2 border-transparent bg-card p-3 shadow-sm transition-all hover:border-orange-400 hover:shadow-md active:scale-95 text-left"
                >
                  {qty > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow">
                      {qty}
                    </span>
                  )}
                  <span className="text-xs font-semibold leading-tight line-clamp-2">
                    {product.name}
                  </span>
                  {product.winery && (
                    <span className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                      {product.winery}
                    </span>
                  )}
                  <span className="mt-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                    {formatCurrency(product.negotiatedPrice)}
                  </span>
                </button>
              );
            })}
            {!isFetchingProducts && products.length === 0 && (
              <div className="col-span-3 flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Carrinho ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-t bg-card">
        {cart.length > 0 && (
          <button
            className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-muted/50"
            onClick={() => setShowCart((v) => !v)}
          >
            <span className="flex items-center gap-2 font-medium">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              Carrinho
              <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {cart.length}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(cartSubtotal)}
              <span className="ml-1 text-[10px]">{showCart ? "▲" : "▼"}</span>
            </span>
          </button>
        )}

        {showCart && cart.length > 0 && (
          <div className="max-h-52 overflow-y-auto border-t px-4 py-2 space-y-1.5">
            {cart.map((item) => (
              <div key={item.id} className="rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatCurrency(item.unitPrice)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCartDecrement(item.id)} disabled={submitPending}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCartIncrement(item.id)} disabled={submitPending}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="icon" variant="ghost"
                    className={`h-6 w-6 shrink-0 ${item.notes ? "text-orange-500" : "text-muted-foreground"}`}
                    onClick={() => setExpandedNoteId((p) => (p === item.id ? null : item.id))}
                    disabled={submitPending}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-50 shrink-0" onClick={() => onCartRemove(item.id)} disabled={submitPending}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {expandedNoteId === item.id && (
                  <div className="px-3 pb-2">
                    <Input
                      placeholder="Observação (ex: sem cebola...)"
                      className="h-7 text-xs"
                      value={item.notes ?? ""}
                      onChange={(e) => onCartNoteChange(item.id, e.target.value)}
                      disabled={submitPending}
                      autoFocus
                    />
                  </div>
                )}
                {expandedNoteId !== item.id && item.notes && (
                  <p className="px-3 pb-2 text-xs text-orange-600 dark:text-orange-400">📝 {item.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3">
          <Button
            className="w-full font-bold"
            size="lg"
            disabled={cart.length === 0 || submitPending}
            onClick={onSubmitCart}
          >
            {submitPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lançando...</>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                LANÇAR PEDIDO
                {cart.length > 0 && (
                  <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                    {cart.length}
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
