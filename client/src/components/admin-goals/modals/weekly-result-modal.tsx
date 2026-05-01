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
import { formatCurrencyInput, parseCurrency } from "@/lib/utils";

const monthlyResultSchema = z.object({
  goalId: z.string().min(1, "Meta é obrigatória"),
  week: z.number().default(1),
  salesAchieved: z
    .string()
    .min(1, "Vendas atingidas é obrigatória")
    .refine(
      (val) => !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo"
    ),
  ticketAchieved: z
    .string()
    .min(1, "Ticket atingido é obrigatório")
    .refine(
      (val) => !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo"
    ),
  itemsAchieved: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(0, "Mínimo 0"),
  totalGrfsMonth: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(0, "Mínimo 0"),
  avgGrfValue: z
    .string()
    .refine(
      (val) => !isNaN(Number(parseCurrency(val))) && Number(parseCurrency(val)) >= 0,
      "Deve ser um valor positivo"
    ),
});

type MonthlyResultFormData = z.infer<typeof monthlyResultSchema>;

interface WeeklyResult {
  id: string;
  goalId: string;
  week: number;
  salesAchieved: string;
  ticketAchieved: string;
  itemsAchieved: number;
  totalGrfsMonth: number;
  avgGrfValue: string;
}

interface WeeklyResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGoal: any | null;
  selectedMonth: number;
  selectedYear: number;
  existingResult?: WeeklyResult | null;
}

export function WeeklyResultModal({
  open,
  onOpenChange,
  selectedGoal,
  selectedMonth,
  selectedYear,
  existingResult,
}: WeeklyResultModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!existingResult;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MonthlyResultFormData>({
    resolver: zodResolver(monthlyResultSchema),
  });

  useEffect(() => {
    if (!open) return;
    if (isEditing && existingResult) {
      const formatVal = (v: string) => {
        const n = Number(v);
        return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      reset({
        goalId: existingResult.goalId,
        week: 1,
        salesAchieved: formatVal(existingResult.salesAchieved),
        ticketAchieved: formatVal(existingResult.ticketAchieved),
        itemsAchieved: existingResult.itemsAchieved,
        totalGrfsMonth: existingResult.totalGrfsMonth ?? 0,
        avgGrfValue: formatVal(existingResult.avgGrfValue ?? "0"),
      });
    } else if (selectedGoal) {
      reset({
        goalId: selectedGoal.id,
        week: 1,
        salesAchieved: "0,00",
        ticketAchieved: "0,00",
        itemsAchieved: 0,
        totalGrfsMonth: 0,
        avgGrfValue: "0,00",
      });
    }
  }, [selectedGoal, existingResult, open, reset, isEditing]);

  const resultMutation = useMutation({
    mutationFn: (data: MonthlyResultFormData) => {
      const payload = {
        ...data,
        week: 1,
        salesAchieved: parseCurrency(data.salesAchieved),
        ticketAchieved: parseCurrency(data.ticketAchieved),
        avgGrfValue: parseCurrency(data.avgGrfValue),
      };
      if (isEditing && existingResult) {
        return apiRequest("PUT", `/api/weekly-results/${existingResult.id}`, payload);
      }
      return apiRequest("POST", "/api/weekly-results", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: isEditing ? "Resultado atualizado" : "Resultado salvo",
        description: isEditing
          ? "O resultado mensal foi atualizado com sucesso."
          : "O resultado mensal foi registrado com sucesso.",
      });
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar resultado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MonthlyResultFormData) => {
    resultMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className={`p-8 text-white relative ${isEditing ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-emerald-600 to-teal-700"}`}>
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight relative z-10">
            {isEditing ? "Editar Resultado" : "Resultado Mensal"}
          </DialogTitle>
          <p className={`text-sm font-medium mt-1 relative z-10 text-balance ${isEditing ? "text-amber-100/80" : "text-emerald-100/80"}`}>
            {isEditing
              ? <>Editando resultado de <span className="text-white font-black">{selectedGoal?.userName}</span>.</>
              : <>Registre os resultados mensais de <span className="text-white font-black">{selectedGoal?.userName}</span>.</>
            }
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Vendas Atingidas no Mês (R$)
            </Label>
            <Input
              placeholder="0,00"
              {...register("salesAchieved")}
              onChange={(e) => {
                const formatted = formatCurrencyInput(e.target.value);
                setValue("salesAchieved", formatted, { shouldValidate: true });
              }}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
            />
            {errors.salesAchieved && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.salesAchieved.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Ticket Médio (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("ticketAchieved")}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setValue("ticketAchieved", formatted, { shouldValidate: true });
                }}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.ticketAchieved && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.ticketAchieved.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Itens/Venda
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                {...register("itemsAchieved")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.itemsAchieved && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.itemsAchieved.message}
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
                {...register("totalGrfsMonth")}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.totalGrfsMonth && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.totalGrfsMonth.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Valor Médio de GRFs (R$)
              </Label>
              <Input
                placeholder="0,00"
                {...register("avgGrfValue")}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setValue("avgGrfValue", formatted, { shouldValidate: true });
                }}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
              />
              {errors.avgGrfValue && (
                <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                  {errors.avgGrfValue.message}
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
              disabled={resultMutation.isPending}
              className={`h-12 px-8 rounded-xl text-white font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 ${isEditing ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"}`}
            >
              {resultMutation.isPending
                ? "Salvando..."
                : isEditing
                  ? "Atualizar Resultado"
                  : "Salvar Resultado"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
