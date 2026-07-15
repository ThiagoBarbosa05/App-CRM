import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Wine, X } from "lucide-react";
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

const schema = z.object({
  userGoalId: z.string().min(1, "Selecione um vendedor"),
  productGoalId: z.string().min(1, "Selecione um produto"),
  productGoalQty: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .int()
    .min(1, "Mínimo 1 unidade"),
});

type FormData = z.infer<typeof schema>;

interface ProductGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando não null → modo edição (vendedor já conhecido) */
  editingGoal: any | null;
  /** Todas as metas do mês — usadas no modo "nova meta" para seletor de vendedor */
  userGoals: any[];
  selectedMonth: number;
  selectedYear: number;
}

export function ProductGoalModal({
  open,
  onOpenChange,
  editingGoal,
  userGoals,
  selectedMonth,
  selectedYear,
}: ProductGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  const isEditing = !!editingGoal;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchProductGoalId = watch("productGoalId");

  const { data: productsData } = useQuery<{ data: { id: string; name: string; type?: string }[] }>({
    queryKey: ["/api/products", productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (productSearch.trim()) params.set("name", productSearch.trim());
      const res = await fetch(`/api/products?${params}`);
      return res.json();
    },
    enabled: open && (showProductList || !!watchProductGoalId),
  });
  const productOptions = productsData?.data ?? [];

  useEffect(() => {
    if (!open) return;
    if (editingGoal) {
      setValue("userGoalId", editingGoal.id);
      setValue("productGoalId", editingGoal.productGoalId ?? "");
      setValue("productGoalQty", editingGoal.productGoalQty ?? undefined);
      setSelectedProductName(editingGoal.productGoalName ?? "");
    } else {
      reset({ userGoalId: "", productGoalId: "", productGoalQty: undefined });
      setSelectedProductName("");
      setProductSearch("");
    }
  }, [editingGoal, open, reset, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("PUT", `/api/user-goals/${data.userGoalId}`, {
        productGoalId: data.productGoalId,
        productGoalQty: data.productGoalQty,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
      });
      toast({ title: "Meta de produto salva", description: "Produto alvo definido com sucesso." });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!editingGoal?.id) throw new Error("Meta não encontrada");
      return apiRequest("PUT", `/api/user-goals/${editingGoal.id}`, {
        productGoalId: null,
        productGoalQty: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
      });
      toast({ title: "Meta de produto removida" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectProduct = (product: { id: string; name: string }) => {
    setValue("productGoalId", product.id, { shouldValidate: true });
    setSelectedProductName(product.name);
    setShowProductList(false);
    setProductSearch("");
  };

  const handleClearProduct = () => {
    setValue("productGoalId", "");
    setValue("productGoalQty", undefined as any);
    setSelectedProductName("");
    setProductSearch("");
  };

  const isPending = mutation.isPending || clearMutation.isPending;

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
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
              {isEditing ? "Editar Meta de Produto" : "Nova Meta de Produto"}
            </DialogTitle>
            <p className="text-violet-200 text-sm font-medium mt-1 capitalize">
              {isEditing
                ? `${editingGoal.userName} · ${monthLabel}`
                : monthLabel}
            </p>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="p-8 space-y-6"
        >
          {/* Seletor de vendedor — só no modo "nova meta" */}
          {!isEditing && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Vendedor
              </Label>
              <select
                {...register("userGoalId")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all"
              >
                <option value="">Selecione um vendedor</option>
                {userGoals.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.userName}
                    {g.productGoalId ? " (já tem produto)" : ""}
                  </option>
                ))}
              </select>
              {errors.userGoalId && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.userGoalId.message}
                </p>
              )}
            </div>
          )}

          {/* Produto */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Vinho / Produto alvo
            </Label>

            {selectedProductName ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Wine className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                    {selectedProductName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearProduct}
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
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductList(true);
                  }}
                  onFocus={() => setShowProductList(true)}
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium focus:border-violet-400 focus:ring-violet-400/20"
                />
                {showProductList && productOptions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-52 overflow-y-auto">
                    {productOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-slate-50 dark:border-slate-800 last:border-0"
                        onClick={() => handleSelectProduct(p)}
                      >
                        <p className="font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
                        {p.type && (
                          <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{p.type}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.productGoalId && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.productGoalId.message}
              </p>
            )}
          </div>

          {/* Quantidade */}
          {selectedProductName && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Quantidade alvo (unidades)
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 10"
                {...register("productGoalQty")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold focus:border-violet-400 focus:ring-violet-400/20"
              />
              {errors.productGoalQty && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.productGoalQty.message}
                </p>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {isEditing && editingGoal?.productGoalId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => clearMutation.mutate()}
                disabled={isPending}
                className="h-12 px-5 rounded-xl font-black uppercase text-[10px] tracking-widest text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                Remover meta
              </Button>
            )}
            <div className="flex gap-3 ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-12 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-violet-500/20 transition-all active:scale-95"
              >
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
