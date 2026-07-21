import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface CloseCashSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedCash: number;
  isPending: boolean;
  onConfirm: (data: { countedCash: string; notes?: string }) => void;
}

export function CloseCashSessionDialog({
  open,
  onOpenChange,
  expectedCash,
  isPending,
  onConfirm,
}: CloseCashSessionDialogProps) {
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setCountedCash("");
      setNotes("");
    }
  }, [open]);

  const counted = Number(countedCash.replace(",", "."));
  const hasCount = countedCash.trim() !== "" && !Number.isNaN(counted) && counted >= 0;
  // Em centavos: comparar floats deixaria "sem divergência" virar 0,004.
  const differenceCents = hasCount
    ? Math.round(counted * 100) - Math.round(expectedCash * 100)
    : 0;
  const hasDifference = hasCount && differenceCents !== 0;

  // Divergência sem explicação é o que ninguém consegue auditar depois.
  const valid = hasCount && (!hasDifference || notes.trim().length >= 3) && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Fechar o caixa</DialogTitle>
          <DialogDescription>
            Conte o dinheiro da gaveta e informe o valor. A conferência fica registrada e não
            pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            onConfirm({
              countedCash: countedCash.replace(",", "."),
              notes: notes.trim() || undefined,
            });
          }}
        >
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Esperado em espécie</span>
            <span className="font-semibold tabular-nums">{formatCurrency(expectedCash)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="counted-cash">Valor contado na gaveta</Label>
            <Input
              id="counted-cash"
              inputMode="decimal"
              placeholder="0,00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              autoFocus
            />
          </div>

          {hasCount && (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                differenceCents === 0
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
                  : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {differenceCents !== 0 && <AlertTriangle className="h-4 w-4" />}
                {differenceCents === 0
                  ? "Caixa confere"
                  : differenceCents < 0
                    ? "Quebra de caixa (faltou)"
                    : "Sobra de caixa"}
              </span>
              <span className="font-semibold tabular-nums">
                {differenceCents > 0 ? "+" : ""}
                {formatCurrency(differenceCents / 100)}
              </span>
            </div>
          )}

          {hasDifference && (
            <div className="space-y-2">
              <Label htmlFor="close-notes">Justificativa da divergência</Label>
              <Textarea
                id="close-notes"
                placeholder="Ex: troco dado a mais na mesa 12"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Obrigatória quando o valor contado difere do esperado.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid}>
              {isPending ? "Fechando..." : "Fechar caixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
