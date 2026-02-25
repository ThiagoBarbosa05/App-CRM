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

const weeklyResultSchema = z.object({
  goalId: z.string().min(1, "Meta é obrigatória"),
  week: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(1, "Mínimo 1")
    .max(5, "Máximo 5"),
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
});

type WeeklyResultFormData = z.infer<typeof weeklyResultSchema>;

interface WeeklyResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGoal: any | null;
  selectedMonth: number;
  selectedYear: number;
}

export function WeeklyResultModal({
  open,
  onOpenChange,
  selectedGoal,
  selectedMonth,
  selectedYear,
}: WeeklyResultModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<WeeklyResultFormData>({
    resolver: zodResolver(weeklyResultSchema),
  });

  useEffect(() => {
    if (selectedGoal) {
      reset({
        goalId: selectedGoal.id,
        week: 1,
        salesAchieved: "0,00",
        ticketAchieved: "0,00",
        itemsAchieved: 0,
      });
    }
  }, [selectedGoal, open, reset]);

  const resultMutation = useMutation({
    mutationFn: (data: WeeklyResultFormData) => {
      const payload = {
        ...data,
        salesAchieved: parseCurrency(data.salesAchieved),
        ticketAchieved: parseCurrency(data.ticketAchieved),
      };
      return apiRequest("POST", "/api/weekly-results", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/user-goals-with-results/${selectedMonth}/${selectedYear}`,
        ],
      });
      toast({
        title: "Resultado salvo",
        description: "O resultado semanal foi registrado com sucesso.",
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

  const onSubmit = (data: WeeklyResultFormData) => {
    resultMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white relative">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight relative z-10">
            Desempenho Semanal
          </DialogTitle>
          <p className="text-emerald-100/80 text-sm font-medium mt-1 relative z-10 text-balance">
            Registre os resultados atingidos pelo vendedor{" "}
            <span className="text-white font-black">
              {selectedGoal?.userName}
            </span>{" "}
            nesta semana.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Número da Semana
            </Label>
            <Input
              type="number"
              min="1"
              max="5"
              placeholder="Ex: 1, 2, 3..."
              {...register("week")}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
            />
            {errors.week && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.week.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Vendas Atingidas (R$)
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
              className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {resultMutation.isPending ? "Salvando..." : "Salvar Resultado"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
