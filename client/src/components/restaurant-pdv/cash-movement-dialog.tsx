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
import { formatCurrency, parseBRL } from "@/lib/utils";

export type CashMovementType = "sangria" | "suprimento";

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CashMovementType;
  /** Dinheiro em caixa agora — limite para sangria. */
  expectedCash: number;
  isPending: boolean;
  onConfirm: (data: { amount: string; reason: string }) => void;
}

export function CashMovementDialog({
  open,
  onOpenChange,
  type,
  expectedCash,
  isPending,
  onConfirm,
}: CashMovementDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setAmount("");
      setReason("");
    }
  }, [open]);

  const isSangria = type === "sangria";
  const numericAmount = parseBRL(amount);
  const exceedsCash =
    isSangria && numericAmount !== null && numericAmount > expectedCash;
  const valid =
    numericAmount !== null &&
    numericAmount > 0 &&
    reason.trim().length >= 3 &&
    !exceedsCash &&
    !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isSangria ? "Registrar sangria" : "Registrar suprimento"}</DialogTitle>
          <DialogDescription>
            {isSangria
              ? "Retirada de dinheiro da gaveta. O valor sai do total esperado no fechamento."
              : "Reforço de dinheiro na gaveta. O valor entra no total esperado no fechamento."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && numericAmount !== null) {
              onConfirm({ amount: numericAmount.toFixed(2), reason: reason.trim() });
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="movement-amount">Valor</Label>
            <Input
              id="movement-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {isSangria && (
              <p className={exceedsCash ? "text-xs text-red-500" : "text-xs text-muted-foreground"}>
                Dinheiro em caixa: {formatCurrency(expectedCash)}
                {exceedsCash && " — a sangria não pode ser maior"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-reason">Motivo</Label>
            <Textarea
              id="movement-reason"
              placeholder={
                isSangria ? "Ex: depósito bancário" : "Ex: reforço de troco para o turno da noite"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Obrigatório — todo movimento de dinheiro fica registrado com autor e motivo.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid}>
              {isPending ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
