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

const telemarketingGoalSchema = z.object({
  userId: z.string().min(1, "Vendedor é obrigatório"),
  targetResult: z.string().min(1, "Resultado esperado é obrigatória"),
  targetQuantity: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(1, "Mínimo 1"),
  month: z.coerce.number().min(1, "Mês inválido").max(12, "Mês inválido"),
  year: z.coerce.number().min(2000, "Ano inválido"),
});

type TelemarketingGoalFormData = z.infer<typeof telemarketingGoalSchema>;

interface TelemarketingGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGoal: any | null;
  users: any[];
  selectedMonth: number;
  selectedYear: number;
}

export function TelemarketingGoalModal({
  open,
  onOpenChange,
  editingGoal,
  users,
  selectedMonth,
  selectedYear,
}: TelemarketingGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TelemarketingGoalFormData>({
    resolver: zodResolver(telemarketingGoalSchema),
  });

  useEffect(() => {
    if (editingGoal) {
      setValue("userId", editingGoal.userId);
      setValue("targetResult", editingGoal.targetResult);
      setValue("targetQuantity", editingGoal.targetQuantity);
      setValue("month", editingGoal.month);
      setValue("year", editingGoal.year);
    } else {
      reset({
        userId: "",
        targetResult: "",
        targetQuantity: 0,
        month: selectedMonth,
        year: selectedYear,
      });
    }
  }, [editingGoal, open, reset, setValue, selectedMonth, selectedYear]);

  const mutation = useMutation({
    mutationFn: async (data: TelemarketingGoalFormData) => {
      if (editingGoal) {
        return apiRequest(
          "PUT",
          `/api/telemarketing-goals/${editingGoal.id}`,
          data
        );
      }
      return apiRequest("POST", "/api/telemarketing-goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/telemarketing-goals/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: editingGoal ? "Meta atualizada" : "Meta criada",
        description: "Meta de telemarketing salva com sucesso.",
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

  const onSubmit = (data: TelemarketingGoalFormData) => {
    mutation.mutate(data);
  };

  const currentDate = new Date();
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-purple-600 to-violet-700 p-8 text-white relative">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight relative z-10 text-balance">
            {editingGoal ? "Editar Ligação" : "Nova Meta de Ligação"}
          </DialogTitle>
          <p className="text-purple-100/80 text-sm font-medium mt-1 relative z-10">
            Foco em produtividade e conversão de chamadas
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendedor</Label>
            <select
              {...register("userId")}
              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all disabled:opacity-50"
              disabled={!!editingGoal}
            >
              <option value="">Selecione um usuário</option>
              {users.map((u: any) => (
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

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Resultado Esperado</Label>
            <select
              {...register("targetResult")}
              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
            >
              <option value="">Selecione um resultado</option>
              <option value="COM SUCESSO">COM SUCESSO</option>
              <option value="NÃO ATENDIDA">NÃO ATENDIDA</option>
              <option value="SEM INTERESSE">SEM INTERESSE</option>
              <option value="NÃO LIGAR MAIS">NÃO LIGAR MAIS</option>
              <option value="EM OCUPADO">EM OCUPADO</option>
              <option value="OUTROS">OUTROS</option>
            </select>
            {errors.targetResult && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.targetResult.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quantidade Meta</Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 50 chamadas"
              {...register("targetQuantity")}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
            />
            {errors.targetQuantity && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.targetQuantity.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mês</Label>
              <select
                {...register("month")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all disabled:opacity-50"
                disabled={!!editingGoal}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleDateString("pt-BR", { month: "long" })}
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
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ano</Label>
              <select
                {...register("year")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all disabled:opacity-50"
                disabled={!!editingGoal}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
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
              disabled={mutation.isPending}
              className="h-12 px-8 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-purple-500/20 transition-all active:scale-95"
            >
              {mutation.isPending ? "Salvando..." : "Salvar Meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
