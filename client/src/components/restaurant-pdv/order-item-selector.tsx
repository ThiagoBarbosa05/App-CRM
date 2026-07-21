import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, parseBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import type { Product, RestaurantMenuItem } from "@shared/schema";
import type { CartItem } from "@/pages/restaurant-pdv/pos";

interface ProductsResponse {
  data: Product[];
}

interface OrderItemSelectorProps {
  blingConnectionId: string | null;
  cart: CartItem[];
  onAddMenuItem: (menuItem: RestaurantMenuItem) => void;
  onAddProduct: (product: Product) => void;
  onAddCustomItem: (name: string, price: string) => void;
  onCartIncrement: (id: string) => void;
  onCartDecrement: (id: string) => void;
  onCartRemove: (id: string) => void;
  onCartNoteChange: (id: string, notes: string) => void;
  onSubmitCart: () => void;
  submitPending: boolean;
  cartSubtotal: number;
}

type ViewMode = "cardapio" | "produtos" | "avulso";

export function OrderItemSelector({
  blingConnectionId,
  cart,
  onAddMenuItem,
  onAddProduct,
  onAddCustomItem,
  onCartIncrement,
  onCartDecrement,
  onCartRemove,
  onCartNoteChange,
  onSubmitCart,
  submitPending,
  cartSubtotal,
}: OrderItemSelectorProps) {
  const { data: menuItems = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items"],
  });

  const [viewMode, setViewMode] = useState<ViewMode>("cardapio");
  const [selectedCategory, setSelectedCategory] = useState("TODOS");
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedProductSearch(productSearch), 400);
    return () => clearTimeout(handler);
  }, [productSearch]);

  const { data: productsResponse, isFetching: isFetchingProducts } =
    useQuery<ProductsResponse>({
      queryKey: ["/api/products", { connectionId: blingConnectionId, name: debouncedProductSearch }],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append("connectionId", blingConnectionId!);
        if (debouncedProductSearch) params.append("name", debouncedProductSearch);
        params.append("pageSize", "50");
        const res = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao buscar produtos");
        return res.json();
      },
      enabled: !!blingConnectionId,
    });
  const products = productsResponse?.data ?? [];

  // Unique sorted categories from menu items
  const categories = [
    "TODOS",
    ...Array.from(
      new Set(menuItems.map((i) => i.category).filter(Boolean) as string[])
    ).sort(),
  ];

  const visibleMenuItems =
    selectedCategory === "TODOS"
      ? menuItems
      : menuItems.filter((i) => i.category === selectedCategory);

  const handleAddCustomItem = () => {
    const price = parseBRL(customPrice);
    if (!customName.trim() || price === null || price <= 0) return;
    onAddCustomItem(customName.trim(), price.toFixed(2));
    setCustomName("");
    setCustomPrice("");
  };

  const getCartQty = (menuItemId?: string | null, productId?: string | null) => {
    if (menuItemId) return cart.find((c) => c.menuItemId === menuItemId)?.quantity ?? 0;
    if (productId) return cart.find((c) => c.productId === productId)?.quantity ?? 0;
    return 0;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Category / mode pills ─────────────────────────────────── */}
      <div className="shrink-0 border-b bg-muted/30 px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {/* Cardápio categories */}
          {viewMode === "cardapio" &&
            categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  selectedCategory === cat
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-900/20 dark:hover:text-orange-400 border"
                }`}
              >
                {cat}
              </button>
            ))}

          {/* Separator before mode buttons */}
          <div className="shrink-0 self-stretch border-l mx-1" />

          {/* Mode buttons */}
          <button
            onClick={() => { setViewMode("cardapio"); setSelectedCategory("TODOS"); }}
            className={`shrink-0 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === "cardapio"
                ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                : "border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <UtensilsCrossed className="h-3 w-3" />
            Cardápio
          </button>
          <button
            onClick={() => setViewMode("produtos")}
            className={`shrink-0 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === "produtos"
                ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                : "border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <ShoppingBag className="h-3 w-3" />
            Produtos
          </button>
          <button
            onClick={() => setViewMode("avulso")}
            className={`shrink-0 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === "avulso"
                ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                : "border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Plus className="h-3 w-3" />
            Avulso
          </button>
        </div>
      </div>

      {/* ── Item grid (scrollable) ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {viewMode === "cardapio" && (
          <>
            {visibleMenuItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {menuItems.length === 0
                    ? "Nenhum item no cardápio. Peça a um gestor para cadastrar."
                    : "Nenhum item nesta categoria."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleMenuItems.map((item) => {
                  const qty = getCartQty(item.id, null);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onAddMenuItem(item)}
                      disabled={submitPending}
                      className="relative flex flex-col items-center justify-center rounded-xl border-2 border-transparent bg-card p-3 text-center shadow-sm transition-all hover:border-orange-400 hover:shadow-md active:scale-95 dark:bg-card"
                    >
                      {/* Qty badge */}
                      {qty > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow">
                          {qty}
                        </span>
                      )}
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20">
                        <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                      </div>
                      <span className="line-clamp-2 text-xs font-semibold leading-tight">
                        {item.name}
                      </span>
                      <span className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                        {formatCurrency(item.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewMode === "produtos" && (
          <>
            {!blingConnectionId ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta Bling configurada. Configure em Cardápio → Integração com Bling.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    className="pl-8"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {isFetchingProducts && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {products.map((product) => {
                    const qty = getCartQty(null, product.id);
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
              </div>
            )}
          </>
        )}

        {viewMode === "avulso" && (
          <div className="max-w-sm space-y-3">
            <Label className="text-xs uppercase text-muted-foreground">Item avulso</Label>
            <Input
              placeholder="Nome do item"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={submitPending}
            />
            <Input
              placeholder="Valor (ex: 25,00)"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              disabled={submitPending}
            />
            <Button
              className="w-full"
              onClick={handleAddCustomItem}
              disabled={submitPending || !customName.trim() || !customPrice}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar ao Carrinho
            </Button>
          </div>
        )}
      </div>

      {/* ── Cart panel (expandable) ───────────────────────────────── */}
      <div className="shrink-0 border-t bg-card">
        {/* Cart toggle header */}
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

        {/* Expanded cart items */}
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

        {/* Launch button */}
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
