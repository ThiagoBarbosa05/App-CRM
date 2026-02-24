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

const interactionGoalSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório"),
  interactionType: z.string().min(1, "Tipo de interação é obrigatório"),
  targetQuantity: z
    .string()
    .min(1, "Quantidade é obrigatória")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1,
      "Deve ser pelo menos 1"
    ),
  month: z.string().min(1, "Mês é obrigatório"),
  year: z.string().min(1, "Ano é obrigatório"),
});

type InteractionGoalFormData = z.infer<typeof interactionGoalSchema>;

interface InteractionGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGoal: any | null;
  users: any[];
  selectedMonth: number;
  selectedYear: number;
}

export function InteractionGoalModal({
  open,
  onOpenChange,
  editingGoal,
  users,
  selectedMonth,
  selectedYear,
}: InteractionGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InteractionGoalFormData>({
    resolver: zodResolver(interactionGoalSchema),
  });

  useEffect(() => {
    if (editingGoal) {
      setValue("userId", editingGoal.userId);
      setValue("interactionType", editingGoal.interactionType);
      setValue("targetQuantity", editingGoal.targetQuantity.toString());
      setValue("month", editingGoal.month.toString());
      setValue("year", editingGoal.year.toString());
    } else {
      reset({
        userId: "",
        interactionType: "",
        targetQuantity: "",
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
    }
  }, [editingGoal, open, reset, setValue, selectedMonth, selectedYear]);

  const mutation = useMutation({
    mutationFn: async (data: InteractionGoalFormData) => {
      if (editingGoal) {
        return apiRequest("PATCH", `/api/interaction-goals/${editingGoal.id}`, data);
      }
      return apiRequest("POST", "/api/interaction-goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/interaction-goals/${selectedMonth}/${selectedYear}`] });
      toast({
        title: editingGoal ? "Meta atualizada" : "Meta criada",
        description: "Meta de interação salva com sucesso.",
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

  const onSubmit = (data: InteractionGoalFormData) => {
    mutation.mutate(data);
  };

  const currentDate = new Date();
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 text-white relative">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight relative z-10 text-balance">
            {editingGoal ? "Editar Interação" : "Nova Meta de Interação"}
          </DialogTitle>
          <p className="text-indigo-100/80 text-sm font-medium mt-1 relative z-10">
            Monitore o engajamento e a qualidade do atendimento
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendedor</Label>
            <select
              {...register("userId")}
              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
              disabled={!!editingGoal}
            >
              <option value="">Selecione um usuário</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tipo de Atividade</Label>
            <select
              {...register("interactionType")}
              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="">Selecione um tipo</option>
              <option value="telemarketing">Ligação</option>
              <option value="email">E-mail</option>
              <option value="meeting">Reunião</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="visit">Visita</option>
              <option value="note">Anotação</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quantidade Meta</Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 100 mensagens/mês"
              {...register("targetQuantity")}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mês</Label>
              <select
                {...register("month")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
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
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
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
              disabled={mutation.isPending}
              className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              {mutation.isPending ? "Salvando..." : "Salvar Meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
