import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import type { Product, RestaurantMenuItem } from "@shared/schema";

interface ProductsResponse {
  data: Product[];
}

interface OrderItemSelectorProps {
  blingConnectionId: string | null;
  addingDisabled: boolean;
  onAddMenuItem: (menuItem: RestaurantMenuItem) => void;
  onAddProduct: (product: Product) => void;
  onAddCustomItem: (name: string, price: string) => void;
}

export function OrderItemSelector({
  blingConnectionId,
  addingDisabled,
  onAddMenuItem,
  onAddProduct,
  onAddCustomItem,
}: OrderItemSelectorProps) {
  const { data: dailyMenuItems = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/daily-menu"],
  });

  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");

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

  return (
    <Tabs defaultValue="cardapio-dia">
      <TabsList className="w-full">
        <TabsTrigger value="cardapio-dia" className="flex-1">
          Cardápio do Dia
        </TabsTrigger>
        <TabsTrigger value="produtos" className="flex-1">
          Produtos
        </TabsTrigger>
        <TabsTrigger value="avulso" className="flex-1">
          Item Avulso
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cardapio-dia" className="mt-3">
        <div className="grid grid-cols-2 gap-2">
          {dailyMenuItems.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              className="h-auto flex-col items-start p-3 text-left"
              onClick={() => onAddMenuItem(item)}
              disabled={addingDisabled}
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(item.price)}
              </span>
            </Button>
          ))}
          {dailyMenuItems.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground">
              Nenhum item marcado para o cardápio de hoje. Peça a um gestor para
              configurar em Cardápio → Cardápio do Dia.
            </p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="produtos" className="mt-3 space-y-3">
        {!blingConnectionId ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta Bling configurada para este PDV. Configure em
            Cardápio → Integração com Bling.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                className="pl-8"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
            <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto">
              {products.map((product) => (
                <Button
                  key={product.id}
                  variant="outline"
                  className="h-auto items-center justify-between p-3 text-left"
                  onClick={() => onAddProduct(product)}
                  disabled={addingDisabled}
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
                <p className="text-sm text-muted-foreground">
                  Nenhum produto vinculado a esta conta Bling. Vincule produtos
                  em Produtos → Sincronizar com Bling.
                </p>
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
          />
          <Input
            placeholder="Valor"
            className="w-28"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
          <Button variant="secondary" onClick={handleAddCustomItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
