import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Client } from "@shared/schema";

interface CpfVerificationDialogProps {
  client: Client;
  mapped: { name?: string; birthday?: string };
  raw: unknown;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiffItem {
  key: "name" | "birthday";
  label: string;
  currentDisplay: string;
  newDisplay: string;
  newValue: string;
  differs: boolean;
}

function formatBirthdayDisplay(value: string | null | undefined): string {
  if (!value) return "Não informado";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

export function CpfVerificationDialog({
  client,
  mapped,
  raw,
  open,
  onOpenChange,
}: CpfVerificationDialogProps) {
  const { toast } = useToast();
  const [showRaw, setShowRaw] = useState(false);

  const items = useMemo<DiffItem[]>(() => {
    const result: DiffItem[] = [];

    if (mapped.name) {
      const current = (client.name ?? "").trim();
      const next = mapped.name.trim();
      result.push({
        key: "name",
        label: "Nome",
        currentDisplay: current || "Não informado",
        newDisplay: next,
        newValue: next,
        differs: current.toLowerCase() !== next.toLowerCase(),
      });
    }

    if (mapped.birthday) {
      const current = client.birthday ?? "";
      result.push({
        key: "birthday",
        label: "Data de nascimento",
        currentDisplay: formatBirthdayDisplay(client.birthday),
        newDisplay: formatBirthdayDisplay(mapped.birthday),
        newValue: mapped.birthday,
        differs: current !== mapped.birthday,
      });
    }

    return result;
  }, [client.name, client.birthday, mapped]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter((i) => i.differs).map((i) => [i.key, true])),
  );

  const divergent = items.filter((i) => i.differs);
  const matching = items.filter((i) => !i.differs);
  const selectedCount = divergent.filter((i) => selected[i.key]).length;

  const applyMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      for (const item of divergent) {
        if (selected[item.key]) payload[item.key] = item.newValue;
      }
      const res = await apiRequest(
        "POST",
        `/api/clients/${client.id}/apply-cpf-data`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Dados atualizados",
        description: "O cadastro foi atualizado com os dados da Assertiva.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erro ao aplicar dados",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            Dados da Assertiva
          </DialogTitle>
          <DialogDescription>
            Compare os dados retornados pela Receita Federal com o cadastro atual antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {divergent.length === 0 && matching.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A Assertiva não retornou nome ou data de nascimento para este CPF.
            </p>
          )}

          {divergent.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/20 cursor-pointer"
            >
              <Checkbox
                checked={!!selected[item.key]}
                onCheckedChange={(checked) =>
                  setSelected((prev) => ({ ...prev, [item.key]: !!checked }))
                }
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-through">
                  {item.currentDisplay}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {item.newDisplay}
                </p>
              </div>
            </label>
          ))}

          {matching.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {item.label}: confere com o cadastro
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:underline dark:text-slate-400"
          >
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Ver resposta completa da Assertiva
          </button>
          {showRaw && (
            <pre className="max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] text-slate-100">
              {JSON.stringify(raw, null, 2)}
            </pre>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={selectedCount === 0 || applyMutation.isPending}
          >
            {applyMutation.isPending
              ? "Aplicando..."
              : `Aplicar ${selectedCount} alteração${selectedCount === 1 ? "" : "ões"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
