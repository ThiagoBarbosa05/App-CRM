import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Merge } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name: string;
  type?: string;
  country?: string;
  volume?: string;
  negotiatedPrice?: string;
  clientCount?: number;
}

interface MergeProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onSuccess: () => void;
}

export function MergeProductsModal({
  open,
  onOpenChange,
  products,
  onSuccess,
}: MergeProductsModalProps) {
  const { toast } = useToast();
  const [canonicalId, setCanonicalId] = useState<string>(products[0]?.id ?? "");

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const duplicateIds = products.map((p) => p.id).filter((id) => id !== canonicalId);
      const res = await apiRequest("POST", "/api/products/batch-merge", {
        canonicalId,
        duplicateIds,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Erro ao unificar");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/duplicates"] });
      toast({
        title: "Produtos unificados!",
        description: `${data.merged} produto(s) foram fundidos no cadastro principal.`,
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao unificar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canonical = products.find((p) => p.id === canonicalId);
  const duplicates = products.filter((p) => p.id !== canonicalId);

  if (products.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-violet-600" />
            Unificar Produtos
          </DialogTitle>
          <DialogDescription>
            Escolha qual cadastro será mantido como <strong>principal</strong>.
            Os demais serão fundidos nele e removidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-medium">
            Selecione o produto principal:
          </p>

          <RadioGroup
            value={canonicalId}
            onValueChange={setCanonicalId}
            className="space-y-2"
          >
            {products.map((product) => {
              const isSelected = product.id === canonicalId;
              return (
                <label
                  key={product.id}
                  htmlFor={`product-${product.id}`}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-600"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <RadioGroupItem
                    value={product.id}
                    id={`product-${product.id}`}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{product.name}</span>
                      {isSelected && (
                        <Badge className="bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100 text-xs">
                          Principal
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {product.type && (
                        <span className="text-xs text-muted-foreground">{product.type}</span>
                      )}
                      {product.country && (
                        <span className="text-xs text-muted-foreground">· {product.country}</span>
                      )}
                      {product.volume && (
                        <span className="text-xs text-muted-foreground">· {product.volume}</span>
                      )}
                      {product.negotiatedPrice && (
                        <span className="text-xs text-muted-foreground">
                          · R$ {parseFloat(product.negotiatedPrice).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </div>
                    {typeof product.clientCount === "number" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.clientCount} empresa(s) vinculada(s)
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {canonical && duplicates.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                O que vai acontecer:
              </div>
              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5 pl-1">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />
                  <span><strong>{canonical.name}</strong> será mantido como cadastro principal</span>
                </li>
                {duplicates.map((d) => (
                  <li key={d.id} className="flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5 shrink-0 font-bold text-xs">✕</span>
                    <span>
                      <strong>{d.name}</strong> será removido; seus vínculos (empresas, pedidos) migram para o principal
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending || !canonicalId}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Merge className="h-4 w-4" />
            {mergeMutation.isPending
              ? "Unificando..."
              : `Unificar ${products.length} produtos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
