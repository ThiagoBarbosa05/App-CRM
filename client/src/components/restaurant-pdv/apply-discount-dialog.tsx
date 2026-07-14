import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApplyDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending?: boolean;
  onConfirm: (data: { discountPercent?: string; discountAmount?: string; reason: string }) => void;
}

export function ApplyDiscountDialog({
  open,
  onOpenChange,
  isPending = false,
  onConfirm,
}: ApplyDiscountDialogProps) {
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setMode("percent");
      setValue("");
      setReason("");
    }
  }, [open]);

  const canConfirm = value.trim().length > 0 && Number(value.replace(",", ".")) > 0 && reason.trim().length > 0;

  const handleConfirm = () => {
    const numericValue = value.replace(",", ".");
    onConfirm({
      discountPercent: mode === "percent" ? numericValue : undefined,
      discountAmount: mode === "amount" ? numericValue : undefined,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Aplicar Desconto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "percent" | "amount")}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="percent" id="discount-percent" />
              <Label htmlFor="discount-percent" className="font-normal">
                Percentual (%)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="amount" id="discount-amount" />
              <Label htmlFor="discount-amount" className="font-normal">
                Valor fixo (R$)
              </Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="discount-value">
              {mode === "percent" ? "Percentual de desconto" : "Valor do desconto"}
            </Label>
            <Input
              id="discount-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "percent" ? "Ex: 10" : "Ex: 20,00"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-reason">Motivo</Label>
            <Textarea
              id="discount-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo do desconto..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canConfirm || isPending} onClick={handleConfirm}>
            Aplicar Desconto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
