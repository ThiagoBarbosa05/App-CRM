import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const markerGoalSchema = z.object({
  userId: z.string().min(1, "Vendedor é obrigatório"),
  markerName: z.string().min(1, "Nome do marcador é obrigatório"),
  targetQuantity: z.coerce
    .number({ invalid_type_error: "Deve ser um número" })
    .min(1, "Mínimo 1"),
  month: z.coerce.number().min(1, "Mês inválido").max(12, "Mês inválido"),
  year: z.coerce.number().min(2000, "Ano inválido"),
});

type MarkerGoalFormData = z.infer<typeof markerGoalSchema>;

interface MarkerGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGoal: any | null;
  users: any[];
  availableMarkers: any[];
  selectedMonth: number;
  selectedYear: number;
}

export function MarkerGoalModal({
  open,
  onOpenChange,
  editingGoal,
  users,
  availableMarkers,
  selectedMonth,
  selectedYear,
}: MarkerGoalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<MarkerGoalFormData>({
    resolver: zodResolver(markerGoalSchema),
  });

  useEffect(() => {
    if (editingGoal) {
      setValue("userId", editingGoal.userId);
      setValue("markerName", editingGoal.markerName);
      setValue("targetQuantity", editingGoal.targetQuantity);
      setValue("month", editingGoal.month);
      setValue("year", editingGoal.year);
    } else {
      reset({
        userId: "",
        markerName: "",
        targetQuantity: 0,
        month: selectedMonth,
        year: selectedYear,
      });
    }
  }, [editingGoal, open, reset, setValue, selectedMonth, selectedYear]);

  const mutation = useMutation({
    mutationFn: async (data: MarkerGoalFormData) => {
      if (editingGoal) {
        return apiRequest("PUT", `/api/marker-goals/${editingGoal.id}`, data);
      }
      return apiRequest("POST", "/api/marker-goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/marker-goals/${selectedMonth}/${selectedYear}`],
      });
      toast({
        title: editingGoal ? "Meta atualizada" : "Meta criada",
        description: "Meta de marcador salva com sucesso.",
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

  const onSubmit = (data: MarkerGoalFormData) => {
    mutation.mutate(data);
  };

  const currentDate = new Date();
  const years = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - 2 + i
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-white relative">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight relative z-10 text-balance">
            {editingGoal ? "Editar Marcador" : "Nova Meta de Marcador"}
          </DialogTitle>
          <p className="text-amber-100/80 text-sm font-medium mt-1 relative z-10">
            Foque em segmentos específicos do seu mercado
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Vendedor
            </Label>
            <select
              {...register("userId")}
              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-50"
              disabled={!!editingGoal}
            >
              <option value="">Selecione um usuário</option>
              {users.map((u) => (
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
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Marcador (Tag)
            </Label>
            <Controller
              name="markerName"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold">
                    <SelectValue placeholder="Selecione um marcador" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                    {availableMarkers.map((marker) => (
                      <SelectItem
                        key={marker.id}
                        value={marker.name}
                        className="focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded-lg py-3"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: marker.color }}
                          />
                          <span className="font-bold text-sm tracking-tight">
                            {marker.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.markerName && (
              <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase">
                {errors.markerName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Quantidade Meta
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 30 clientes marcados"
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
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Mês
              </Label>
              <select
                {...register("month")}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-50"
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
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-50"
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
              disabled={mutation.isPending}
              className="h-12 px-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              {mutation.isPending ? "Salvando..." : "Salvar Meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
