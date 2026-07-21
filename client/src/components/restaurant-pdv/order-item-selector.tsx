import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UtensilsCrossed } from "lucide-react";
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

  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedProductSearch(productSearch), 400);
    return () => clearTimeout(handler);
  }, [productSearch]);

  const { data: productsResponse, isFetching: isFetchingProducts } =
    useQuery<ProductsResponse>({
      queryKey: [
        "/api/products",
        { connectionId: blingConnectionId, name: debouncedProductSearch },
      ],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append("connectionId", blingConnectionId!);
        if (debouncedProductSearch) params.append("name", debouncedProductSearch);
        params.append("pageSize", "50");
        const res = await fetch(`/api/products?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Erro ao buscar produtos");
        return res.json();
      },
      enabled: !!blingConnectionId,
    });
  const products = productsResponse?.data ?? [];

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const handleAddCustomItem = () => {
    const price = customPrice.replace(",", ".");
    if (!customName.trim() || !price || Number(price) <= 0) return;
    onAddCustomItem(customName.trim(), price);
    setCustomName("");
    setCustomPrice("");
  };

  const toggleNote = (id: string) => {
    setExpandedNoteId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 pb-2">
        <Tabs defaultValue="cardapio">
          <TabsList className="w-full">
            <TabsTrigger value="cardapio" className="flex-1 gap-1.5">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Cardápio
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex-1 gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="avulso" className="flex-1 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Item Avulso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cardapio" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {menuItems.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  className="h-auto flex-col items-start p-3 text-left transition-transform hover:scale-[1.02] hover:border-primary/40 active:scale-[0.98]"
                  onClick={() => onAddMenuItem(item)}
                  disabled={submitPending}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)}
                  </span>
                </Button>
              ))}
              {menuItems.length === 0 && (
                <div className="col-span-2 flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum item cadastrado no cardápio. Peça a um gestor para
                    cadastrar em Cardápio → Itens do Cardápio.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="produtos" className="mt-3 space-y-3">
            {!blingConnectionId ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta Bling configurada para este PDV. Configure em
                  Cardápio → Integração com Bling.
                </p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    className="pl-8 pr-8"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {isFetchingProducts && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto">
                  {products.map((product) => (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="h-auto items-center justify-between p-3 text-left transition-transform hover:scale-[1.01] hover:border-primary/40 active:scale-[0.98]"
                      onClick={() => onAddProduct(product)}
                      disabled={submitPending}
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-medium">{product.name}</span>
                        {product.winery && (
                          <span className="text-xs text-muted-foreground">
                            {product.winery}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(product.negotiatedPrice)}
                      </span>
                    </Button>
                  ))}
                  {!isFetchingProducts && products.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum produto vinculado a esta conta Bling. Vincule produtos
                        em Produtos → Sincronizar com Bling.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="avulso" className="mt-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Item avulso
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                disabled={submitPending}
              />
              <Input
                placeholder="Valor"
                className="w-28"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                disabled={submitPending}
              />
              <Button variant="secondary" onClick={handleAddCustomItem} disabled={submitPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {cart.length > 0 && (
          <div className="mt-4 border-t pt-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              Itens selecionados ({cart.length})
            </p>
            <div className="space-y-1.5">
              {cart.map((item) => (
                <div key={item.id} className="rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatCurrency(item.unitPrice)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onCartDecrement(item.id)}
                        disabled={submitPending}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onCartIncrement(item.id)}
                        disabled={submitPending}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-6 w-6 shrink-0 ${item.notes ? "text-orange-500 hover:text-orange-600" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => toggleNote(item.id)}
                      disabled={submitPending}
                      title="Adicionar observação"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-600 shrink-0"
                      onClick={() => onCartRemove(item.id)}
                      disabled={submitPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {expandedNoteId === item.id && (
                    <div className="px-3 pb-2">
                      <Input
                        placeholder="Observação (ex: sem cebola, bem passado...)"
                        className="h-7 text-xs"
                        value={item.notes ?? ""}
                        onChange={(e) => onCartNoteChange(item.id, e.target.value)}
                        disabled={submitPending}
                        autoFocus
                      />
                    </div>
                  )}
                  {expandedNoteId !== item.id && item.notes && (
                    <p className="px-3 pb-2 text-xs text-orange-600 dark:text-orange-400">
                      📝 {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-card px-6 py-4">
        {cart.length > 0 && (
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal do pedido</span>
            <span className="font-semibold">{formatCurrency(cartSubtotal)}</span>
          </div>
        )}
        <Button
          className="w-full font-semibold"
          size="lg"
          disabled={cart.length === 0 || submitPending}
          onClick={onSubmitCart}
        >
          {submitPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Lançando...
            </>
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
  );
}
