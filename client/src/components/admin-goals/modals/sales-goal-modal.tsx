import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrency } from "@/lib/utils";
import { Wine, X } from "lucide-react";

const goalSchema = z.object({
  userId: z.string().min(1, "Vendedor é obrigatório"),
  salesGoal: z
    .string()
    .min(1, "Meta de vendas é obrigatória")
    .refine(
      (val) =>
        !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo",
    ),
  averageTicket: z
    .string()
    .min(1, "Ticket médio é obrigatório")
    .refine(
      (val) =>
        !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo",
    ),
  ordersGoal: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(0, "Mínimo 0"),
  itemsPerSale: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === "number" ? val : Number(String(val).replace(",", "."));
      return isNaN(num) ? 0 : num;
    })
    .pipe(z.number().min(0, "Mínimo 0")),
  positivityGoal: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(0, "Mínimo 0")
    .max(100, "Máximo 100"),
  avgBottleValueGoal: z
    .string()
    .min(1, "Valor médio por garrafa é obrigatório")
    .refine(
      (val) =>
        !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo",
    ),
  productGoalId: z.string().nullable().optional(),
  productGoalQty: z.coerce.number().int().min(1).nullable().optional(),
  month: z.coerce.number().min(1, "Mês inválido").max(12, "Mês inválido"),
  year: z.coerce.number().min(2000, "Ano inválido"),
});

type GoalFormData = z.infer<typeof goalSchema>;

interface SalesGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGoal: any | null;
  users: any[];
  usersWithoutGoals: any[];
  selectedMonth: number;
  selectedYear: number;
}

export function SalesGoalModal({
  open,
  onOpenChange,
  editingGoal,
  users,
  usersWithoutGoals,
  selectedMonth,
  selectedYear,
}: SalesGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  });

  const watchProductGoalId = watch("productGoalId");

  // Busca de produtos para o seletor
  const { data: productsData } = useQuery<{ data: { id: string; name: string; type?: string }[] }>({
    queryKey: ["/api/products", productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (productSearch.trim()) params.set("name", productSearch.trim());
      const res = await fetch(`/api/products?${params}`);
      return res.json();
    },
    enabled: showProductList || !!watchProductGoalId,
  });

  const productOptions = productsData?.data ?? [];

  useEffect(() => {
    if (editingGoal) {
      setValue("userId", editingGoal.userId);
      setValue("salesGoal", formatCurrencyInput(editingGoal.salesGoal));
      setValue("averageTicket", formatCurrencyInput(editingGoal.averageTicket));
      setValue("ordersGoal", editingGoal.ordersGoal ?? 0);
      setValue("itemsPerSale", editingGoal.itemsPerSale ?? 0);
      setValue("positivityGoal", editingGoal.positivityGoal ?? 0);
      setValue("avgBottleValueGoal", formatCurrencyInput(editingGoal.avgBottleValueGoal ?? "0"));
      setValue("productGoalId", editingGoal.productGoalId ?? null);
      setValue("productGoalQty", editingGoal.productGoalQty ?? null);
      setValue("month", editingGoal.month);
      setValue("year", editingGoal.year);
      // Restaura nome do produto ao editar
      if (editingGoal.productGoalId) {
        setSelectedProductName(editingGoal.productGoalName ?? "");
      }
    } else {
      reset({
        userId: "",
        salesGoal: "0,00",
        averageTicket: "0,00",
        ordersGoal: 0,
        itemsPerSale: 0,
        positivityGoal: 0,
        avgBottleValueGoal: "0,00",
        productGoalId: null,
        productGoalQty: null,
        month: selectedMonth,
        year: selectedYear,
      });
      setSelectedProductName("");
      setProductSearch("");
    }
  }, [editingGoal, open, reset, setValue, selectedMonth, selectedYear]);

  const goalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const payload = {
        ...data,
        salesGoal: parseCurrency(data.salesGoal),
        averageTicket: parseCurrency(data.averageTicket),
        avgBottleValueGoal: parseCurrency(data.avgBottleValueGoal),
        productGoalId: data.productGoalId || null,
        productGoalQty: data.productGoalQty || null,
      };

      if (editingGoal) {
        return apiRequest("PUT", `/api/user-goals/${editingGoal.id}`, payload);
      }
      return apiRequest("POST", "/api/user-goals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: editingGoal ? "Meta atualizada" : "Meta criada",
        description: `A meta foi ${editingGoal ? "atualizada" : "criada"} com sucesso.`,
      });
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GoalFormData) => {
    goalMutation.mutate(data);
  };

  const currentDate = new Date();
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleSelectProduct = (product: { id: string; name: string }) => {
    setValue("productGoalId", product.id, { shouldValidate: true });
    setSelectedProductName(product.name);
    setShowProductList(false);
    setProductSearch("");
  };

  const handleClearProduct = () => {
    setValue("productGoalId", null);
    setValue("productGoalQty", null);
    setSelectedProductName("");
    setProductSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight relative z-10">
            {editingGoal ? "Editar Meta" : "Nova Meta"}
          </DialogTitle>
          <p className="text-white text-sm font-medium mt-1 relative z-10">
            {editingGoal
              ? "Ajuste os indicadores de performance"
              : "Defina os objetivos comerciais do vendedor"}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Vendedor */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Vendedor
            </Label>
            <select
              {...register("userId")}
              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
              disabled={!!editingGoal}
            >
              <option value="">Selecione um usuário</option>
              {editingGoal
                ? users
                    .filter((u) => u.id === editingGoal.userId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))
                : usersWithoutGoals.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
            </select>
            {errors.userId && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.userId.message}</p>
            )}
          </div>

          {/* Meta Vendas + Ticket */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Meta Vendas (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("salesGoal")}
                onChange={(e) => setValue("salesGoal", formatCurrencyInput(e.target.value), { shouldValidate: true })}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.salesGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.salesGoal.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Ticket Médio (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("averageTicket")}
                onChange={(e) => setValue("averageTicket", formatCurrencyInput(e.target.value), { shouldValidate: true })}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.averageTicket && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.averageTicket.message}</p>
              )}
            </div>
          </div>

          {/* GRFs + Itens */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Total de GRFs no Mês
              </Label>
              <Input
                type="number" min="0" placeholder="0"
                {...register("ordersGoal")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.ordersGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.ordersGoal.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Itens por Venda
              </Label>
              <Input
                type="text" inputMode="decimal" placeholder="0"
                {...register("itemsPerSale")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.itemsPerSale && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.itemsPerSale.message}</p>
              )}
            </div>
          </div>

          {/* Positivação + Valor médio garrafa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Meta Positivação (%)
              </Label>
              <Input
                type="number" min="0" max="100" placeholder="0"
                {...register("positivityGoal")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.positivityGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.positivityGoal.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Valor Médio por Garrafa (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("avgBottleValueGoal")}
                onChange={(e) => setValue("avgBottleValueGoal", formatCurrencyInput(e.target.value), { shouldValidate: true })}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.avgBottleValueGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.avgBottleValueGoal.message}</p>
              )}
            </div>
          </div>

          {/* Meta de Produto específico */}
          <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-900/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wine className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <Label className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                Meta de Produto (opcional)
              </Label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
              Defina um vinho específico e a quantidade a ser vendida no mês.
            </p>

            {/* Produto selecionado */}
            {selectedProductName ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Wine className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                    {selectedProductName}
                  </span>
                </div>
                <button type="button" onClick={handleClearProduct} className="text-slate-400 hover:text-rose-500 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Buscar vinho..."
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setShowProductList(true); }}
                  onFocus={() => setShowProductList(true)}
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 border-violet-200 dark:border-violet-800 font-medium"
                />
                {showProductList && productOptions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-48 overflow-y-auto">
                    {productOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => handleSelectProduct(p)}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.type && <span className="text-xs text-muted-foreground ml-2">{p.type}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quantidade meta */}
            {(selectedProductName || watchProductGoalId) && (
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Quantidade (unidades)
                </Label>
                <Input
                  type="number" min="1" placeholder="Ex: 50"
                  {...register("productGoalQty")}
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 border-violet-200 dark:border-violet-800 font-bold"
                />
                {errors.productGoalQty && (
                  <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.productGoalQty.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Mês + Ano */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mês</Label>
              <select
                {...register("month")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
                disabled={!!editingGoal}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleDateString("pt-BR", { month: "long" })}
                  </option>
                ))}
              </select>
              {errors.month && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.month.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ano</Label>
              <select
                {...register("year")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
                disabled={!!editingGoal}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {errors.year && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.year.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button" variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={goalMutation.isPending}
              className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              {goalMutation.isPending ? "Salvando..." : editingGoal ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
