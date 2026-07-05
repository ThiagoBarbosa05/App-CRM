import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AlertTriangle } from "lucide-react";

interface ProductCategory {
  id: string;
  name: string;
}

interface ProductsBulkEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onSuccess: () => void;
}

// Sentinela para "não alterar este campo"
const KEEP = "__keep__";

const COUNTRY_OPTIONS = [
  { value: "CHILE", label: "🇨🇱 Chile" },
  { value: "ARGENTINA", label: "🇦🇷 Argentina" },
  { value: "URUGUAI", label: "🇺🇾 Uruguai" },
  { value: "BRASIL", label: "🇧🇷 Brasil" },
  { value: "EUA", label: "🇺🇸 EUA" },
  { value: "FRANÇA", label: "🇫🇷 França" },
  { value: "ITÁLIA", label: "🇮🇹 Itália" },
  { value: "PORTUGAL", label: "🇵🇹 Portugal" },
  { value: "ESPANHA", label: "🇪🇸 Espanha" },
  { value: "ALEMANHA", label: "🇩🇪 Alemanha" },
  { value: "OUTROS", label: "🌍 Outros" },
];

const VOLUME_OPTIONS = ["187ml", "375ml", "750ml", "1500ml"];

const TYPE_OPTIONS = ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"];

export function ProductsBulkEditModal({
  open,
  onOpenChange,
  productIds,
  onSuccess,
}: ProductsBulkEditModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState(KEEP);
  const [country, setCountry] = useState(KEEP);
  const [volume, setVolume] = useState(KEEP);
  const [type, setType] = useState(KEEP);

  const { data: productCategories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories"],
    staleTime: 5 * 60 * 1000,
  });

  const hasChanges =
    category !== KEEP || country !== KEEP || volume !== KEEP || type !== KEEP;

  const resetFields = () => {
    setCategory(KEEP);
    setCountry(KEEP);
    setVolume(KEEP);
    setType(KEEP);
  };

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, string> = {};
      if (category !== KEEP) updates.category = category;
      if (country !== KEEP) updates.country = country;
      if (volume !== KEEP) updates.volume = volume;
      if (type !== KEEP) updates.type = type;

      const response = await fetch("/api/products/bulk-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productIds, updates }),
      });

      if (!response.ok) {
        let errorMessage = "Erro ao atualizar produtos";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = `Erro ${response.status}: ${response.statusText || "Falha na requisição"}`;
        }
        throw new Error(errorMessage);
      }

      return response.json() as Promise<{ updated: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/statistics"] });
      toast({
        title: "Produtos atualizados",
        description: `${data.updated} produto(s) alterado(s) com sucesso.`,
      });
      resetFields();
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edição em massa</DialogTitle>
          <DialogDescription>
            Somente os campos preenchidos serão aplicados aos {productIds.length}{" "}
            produtos selecionados. Campos em "Não alterar" ficam como estão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Não alterar</SelectItem>
                {productCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>País</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Não alterar</SelectItem>
                {COUNTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Volume</Label>
            <Select value={volume} onValueChange={setVolume}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Não alterar</SelectItem>
                {VOLUME_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Não alterar</SelectItem>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasChanges && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Esta alteração será aplicada a {productIds.length} produto(s) de
                uma só vez e não pode ser desfeita automaticamente.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => bulkMutation.mutate()}
            disabled={!hasChanges || bulkMutation.isPending}
          >
            {bulkMutation.isPending
              ? "Aplicando..."
              : `Aplicar a ${productIds.length} produto(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
