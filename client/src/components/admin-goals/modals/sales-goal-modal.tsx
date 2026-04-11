import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrency } from "@/lib/utils";

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
  positivityGoal: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(0, "Mínimo 0"),
  avgBottleValueGoal: z
    .string()
    .min(1, "Valor médio por garrafa é obrigatório")
    .refine(
      (val) =>
        !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo",
    ),
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
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  });

  useEffect(() => {
    if (editingGoal) {
      setValue("userId", editingGoal.userId);
      setValue("salesGoal", formatCurrencyInput(editingGoal.salesGoal));
      setValue("averageTicket", formatCurrencyInput(editingGoal.averageTicket));
      setValue("ordersGoal", editingGoal.ordersGoal ?? 0);
      setValue("positivityGoal", editingGoal.positivityGoal ?? 0);
      setValue(
        "avgBottleValueGoal",
        formatCurrencyInput(editingGoal.avgBottleValueGoal ?? "0"),
      );
      setValue("month", editingGoal.month);
      setValue("year", editingGoal.year);
    } else {
      reset({
        userId: "",
        salesGoal: "0,00",
        averageTicket: "0,00",
        ordersGoal: 0,
        positivityGoal: 0,
        avgBottleValueGoal: "0,00",
        month: selectedMonth,
        year: selectedYear,
      });
    }
  }, [editingGoal, open, reset, setValue, selectedMonth, selectedYear]);

  const goalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const payload = {
        ...data,
        salesGoal: parseCurrency(data.salesGoal),
        averageTicket: parseCurrency(data.averageTicket),
        avgBottleValueGoal: parseCurrency(data.avgBottleValueGoal),
      };

      if (editingGoal) {
        return apiRequest("PUT", `/api/user-goals/${editingGoal.id}`, payload);
      }
      return apiRequest("POST", "/api/user-goals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: editingGoal ? "Meta atualizada" : "Meta criada",
        description: `A meta foi ${
          editingGoal ? "atualizada" : "criada"
        } com sucesso.`,
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
  const years = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - 2 + i,
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

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

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
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
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))
                : usersWithoutGoals.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
            </select>
            {errors.userId && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.userId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Meta Vendas (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("salesGoal")}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setValue("salesGoal", formatted, { shouldValidate: true });
                }}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.salesGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.salesGoal.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Ticket Médio (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("averageTicket")}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setValue("averageTicket", formatted, {
                    shouldValidate: true,
                  });
                }}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.averageTicket && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.averageTicket.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Total de GRFs no Mês
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                {...register("ordersGoal")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.ordersGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.ordersGoal.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Positivação (clientes únicos)
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                {...register("positivityGoal")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.positivityGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.positivityGoal.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Valor Médio por Garrafa (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("avgBottleValueGoal")}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setValue("avgBottleValueGoal", formatted, {
                    shouldValidate: true,
                  });
                }}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.avgBottleValueGoal && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.avgBottleValueGoal.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Mês
              </Label>
              <select
                {...register("month")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
                disabled={!!editingGoal}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleDateString("pt-BR", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
              {errors.month && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.month.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Ano
              </Label>
              <select
                {...register("year")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
                disabled={!!editingGoal}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {errors.year && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.year.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
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
              disabled={goalMutation.isPending}
              className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              {goalMutation.isPending
                ? "Salvando..."
                : editingGoal
                  ? "Atualizar"
                  : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
