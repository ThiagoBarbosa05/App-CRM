import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const goalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  salesGoal: z
    .string()
    .min(1, "Meta de vendas é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo"
    ),
  averageTicket: z
    .string()
    .min(1, "Ticket médio é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Valor deve ser um número positivo"
    ),
  itemsPerSale: z
    .string()
    .min(1, "Itens por venda é obrigatório")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1"
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
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
      setValue("salesGoal", editingGoal.salesGoal.toString());
      setValue("averageTicket", editingGoal.averageTicket.toString());
      setValue("itemsPerSale", editingGoal.itemsPerSale.toString());
      setValue("month", editingGoal.month.toString());
      setValue("year", editingGoal.year.toString());
    } else {
      reset({
        userId: "",
        salesGoal: "",
        averageTicket: "",
        itemsPerSale: "1",
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
    }
  }, [editingGoal, open, reset, setValue, selectedMonth, selectedYear]);

  const goalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      if (editingGoal) {
        return apiRequest("PATCH", `/api/user-goals/${editingGoal.id}`, data);
      }
      return apiRequest("POST", "/api/user-goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-goals-with-results/${selectedMonth}/${selectedYear}`] });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight relative z-10">
            {editingGoal ? "Editar Meta" : "Nova Meta"}
          </DialogTitle>
          <p className="text-blue-100/80 text-sm font-medium mt-1 relative z-10">
            {editingGoal ? "Ajuste os indicadores de performance" : "Defina os objetivos comerciais do vendedor"}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendedor</Label>
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
            {errors.userId && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">{errors.userId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Meta Vendas (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("salesGoal")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ticket Médio (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("averageTicket")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Itens por Venda</Label>
            <Input
              type="number"
              min="1"
              placeholder="1"
              {...register("itemsPerSale")}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
            />
          </div>

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
              {goalMutation.isPending ? "Salvando..." : (editingGoal ? "Atualizar" : "Salvar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
