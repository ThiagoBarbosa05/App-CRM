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
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
] as const;

type MethodValue = (typeof PAYMENT_METHODS)[number]["value"];

interface CloseCashSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O que o sistema registrou por forma de pagamento nesta sessão. */
  byPaymentMethod: { method: string; total: string }[];
  isPending: boolean;
  onConfirm: (data: {
    countedCash: string;
    countedByMethod: Record<string, string>;
    notes?: string;
  }) => void;
}

function parseMoney(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

export function CloseCashSessionDialog({
  open,
  onOpenChange,
  byPaymentMethod,
  isPending,
  onConfirm,
}: CloseCashSessionDialogProps) {
  const [counted, setCounted] = useState<Record<MethodValue, string>>({
    dinheiro: "",
    pix: "",
    cartao_credito: "",
    cartao_debito: "",
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setCounted({ dinheiro: "", pix: "", cartao_credito: "", cartao_debito: "" });
      setNotes("");
    }
  }, [open]);

  /** Quanto o sistema registrou para cada método (em reais). */
  function systemAmount(method: string): number {
    const row = byPaymentMethod.find((p) => p.method === method);
    return row ? Number(row.total) : 0;
  }

  /** Rows calculadas: sistema, contado, diferença em centavos. */
  const rows = PAYMENT_METHODS.map((m) => {
    const sys = systemAmount(m.value);
    const cnt = parseMoney(counted[m.value]);
    const hasCounted = counted[m.value].trim() !== "";
    const diffCents = hasCounted ? toCents(cnt) - toCents(sys) : null;
    return { ...m, sys, cnt, hasCounted, diffCents };
  });

  const anyFilled = rows.some((r) => r.hasCounted);

  // Totais gerais (apenas linhas preenchidas)
  const totalSysCents = rows
    .filter((r) => r.hasCounted)
    .reduce((s, r) => s + toCents(r.sys), 0);
  const totalCntCents = rows
    .filter((r) => r.hasCounted)
    .reduce((s, r) => s + toCents(r.cnt), 0);
  const totalDiffCents = anyFilled ? totalCntCents - totalSysCents : null;

  const hasDifference =
    totalDiffCents !== null && totalDiffCents !== 0;

  const valid =
    anyFilled && (!hasDifference || notes.trim().length >= 3) && !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const countedByMethod: Record<string, string> = {};
    for (const m of PAYMENT_METHODS) {
      if (counted[m.value].trim() !== "") {
        countedByMethod[m.value] = String(parseMoney(counted[m.value]));
      }
    }
    onConfirm({
      countedCash: String(parseMoney(counted.dinheiro)),
      countedByMethod,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Fechar o caixa — Conferência</DialogTitle>
          <DialogDescription>
            Informe o valor que você tem em mãos de cada forma de pagamento. O sistema calcula a
            diferença automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 py-2" onSubmit={handleSubmit}>
          {/* Tabela de conferência por método */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="py-2 pl-3 text-left font-semibold text-muted-foreground">
                    Forma de pagamento
                  </th>
                  <th className="py-2 text-right font-semibold text-muted-foreground">
                    Sistema
                  </th>
                  <th className="py-2 text-right font-semibold text-muted-foreground">
                    Em mãos
                  </th>
                  <th className="py-2 pr-3 text-right font-semibold text-muted-foreground">
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.value} className="hover:bg-muted/20">
                    <td className="py-2 pl-3 font-medium">{row.label}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {row.sys > 0 ? formatCurrency(row.sys) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Input
                        className="h-7 w-28 text-right text-xs tabular-nums ml-auto"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={counted[row.value]}
                        onChange={(e) =>
                          setCounted((prev) => ({ ...prev, [row.value]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.diffCents === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.diffCents === 0 ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          OK
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-semibold",
                            row.diffCents < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {row.diffCents > 0 ? "+" : ""}
                          {formatCurrency(row.diffCents / 100)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resultado geral */}
          {anyFilled && totalDiffCents !== null && (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                totalDiffCents === 0
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
                  : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {totalDiffCents === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {totalDiffCents === 0
                  ? "Caixa conferido — sem divergências"
                  : totalDiffCents < 0
                    ? "Quebra de caixa (faltou)"
                    : "Sobra de caixa"}
              </span>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  Sistema: {formatCurrency(totalSysCents / 100)} · Em mãos:{" "}
                  {formatCurrency(totalCntCents / 100)}
                </div>
                <div
                  className={cn(
                    "font-bold tabular-nums",
                    totalDiffCents === 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400",
                  )}
                >
                  {totalDiffCents > 0 ? "+" : ""}
                  {formatCurrency(totalDiffCents / 100)}
                </div>
              </div>
            </div>
          )}

          {/* Justificativa obrigatória se houver divergência */}
          {hasDifference && (
            <div className="space-y-2">
              <Label htmlFor="close-notes">
                Justificativa da divergência{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="close-notes"
                placeholder="Ex: troco dado a mais na mesa 12, quebrado na conta 5..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Obrigatória quando o valor contado difere do registrado.
              </p>
            </div>
          )}

          {!anyFilled && (
            <p className="text-center text-xs text-muted-foreground">
              Preencha ao menos uma forma de pagamento para fechar o caixa.
            </p>
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
