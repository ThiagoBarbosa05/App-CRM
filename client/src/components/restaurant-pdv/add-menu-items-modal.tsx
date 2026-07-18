import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Plus, Search } from "lucide-react";
import type { Product, RestaurantMenuItem } from "@shared/schema";

interface ProductsResponse {
  data: Product[];
}

interface AddMenuItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  existingMenuItems: RestaurantMenuItem[];
}

export function AddMenuItemsModal({
  open,
  onOpenChange,
  connectionId,
  existingMenuItems,
}: AddMenuItemsModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  // O filtro por conta Bling é feito na query do backend (EXISTS contra
  // bling_product_mappings em storage.getProducts) — nunca no cliente.
  const { data: productsResponse, isFetching } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", { connectionId, name: debouncedSearch }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("connectionId", connectionId);
      if (debouncedSearch) params.append("name", debouncedSearch);
      params.append("pageSize", "50");
      const res = await fetch(`/api/products?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar produtos");
      return res.json();
    },
    enabled: open && !!connectionId,
  });
  const products = productsResponse?.data ?? [];

  const addedBlingProductIds = new Set(
    existingMenuItems.map((item) => item.blingProductId).filter((id): id is string => !!id),
  );

  const addMutation = useMutation({
    mutationFn: async (product: Product) => {
      await apiRequest("POST", "/api/restaurant-pdv/menu-items", {
        name: product.name,
        price: product.negotiatedPrice,
        category: product.category,
        blingProductId: product.blingProductId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/menu-items"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar item", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Adicionar Itens ao Cardápio</DialogTitle>
          <DialogDescription>
            Selecione produtos vinculados à conta Bling do restaurante para adicioná-los ao
            cardápio.
          </DialogDescription>
        </DialogHeader>

        {!connectionId ? (
          <p className="text-sm text-muted-foreground">
            Selecione uma conexão Bling em "Integração com Bling" para listar os produtos
            disponíveis.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto">
              {products.map((product) => {
                const alreadyAdded =
                  !!product.blingProductId && addedBlingProductIds.has(product.blingProductId);

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={alreadyAdded || addMutation.isPending}
                    onClick={() => addMutation.mutate(product)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                      alreadyAdded
                        ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "hover:border-primary/40 hover:bg-accent",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.winery && (
                        <span className="text-xs text-muted-foreground">{product.winery}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-sm shrink-0">
                      {formatCurrency(product.negotiatedPrice)}
                      {alreadyAdded ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                );
              })}
              {!isFetching && products.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum produto encontrado vinculado a esta conta Bling.
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
