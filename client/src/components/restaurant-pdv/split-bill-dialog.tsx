import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import type { RestaurantOrderItem } from "@shared/schema";

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
];

interface SplitPayment {
  method: string;
  amount: string;
  payerLabel: string;
}

interface SplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RestaurantOrderItem[];
  subtotal: number;
  discountAmount: number;
  serviceFee: number;
  total: number;
  isPending?: boolean;
  onConfirm: (payments: SplitPayment[]) => void;
}

export function SplitBillDialog({
  open,
  onOpenChange,
  items,
  subtotal,
  discountAmount,
  serviceFee,
  total,
  isPending = false,
  onConfirm,
}: SplitBillDialogProps) {
  const [numPeople, setNumPeople] = useState(2);
  const [peopleRows, setPeopleRows] = useState<SplitPayment[]>([]);
  const [itemGroups, setItemGroups] = useState<{ label: string; method: string }[]>([
    { label: "Pessoa 1", method: "" },
    { label: "Pessoa 2", method: "" },
  ]);
  const [itemAssignment, setItemAssignment] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const equalShare = (total / Math.max(numPeople, 1)).toFixed(2);
    setPeopleRows(
      Array.from({ length: numPeople }, (_, i) => ({
        method: "",
        amount: equalShare,
        payerLabel: `Pessoa ${i + 1}`,
      })),
    );
  }, [open, numPeople, total]);

  useEffect(() => {
    if (!open) {
      setItemAssignment({});
      setItemGroups([
        { label: "Pessoa 1", method: "" },
        { label: "Pessoa 2", method: "" },
      ]);
    }
  }, [open]);

  const peopleTotal = peopleRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const peopleValid =
    Math.abs(peopleTotal - total) < 0.01 && peopleRows.every((r) => r.method);

  const itemGroupTotals = useMemo(() => {
    if (subtotal === 0) return itemGroups.map(() => 0);
    const rawTotals = itemGroups.map((_, groupIndex) => {
      const groupSubtotal = items.reduce((sum, item) => {
        if (itemAssignment[item.id] !== groupIndex) return sum;
        return sum + Number(item.unitPrice) * item.quantity;
      }, 0);
      const proportion = groupSubtotal / subtotal;
      return groupSubtotal - discountAmount * proportion + serviceFee * proportion;
    });
    // Ajusta o arredondamento na última pessoa pra garantir soma exata
    const roundedAllButLast = rawTotals.slice(0, -1).map((v) => Math.round(v * 100) / 100);
    const sumAllButLast = roundedAllButLast.reduce((a, b) => a + b, 0);
    const last = Math.round((total - sumAllButLast) * 100) / 100;
    return rawTotals.length > 0 ? [...roundedAllButLast, last] : [];
  }, [items, itemAssignment, itemGroups, subtotal, discountAmount, serviceFee, total]);

  const allItemsAssigned = items.every((item) => itemAssignment[item.id] !== undefined);
  const itemsValid = allItemsAssigned && itemGroups.every((g) => g.method);

  const handleConfirmPeople = () => {
    onConfirm(
      peopleRows.map((r) => ({
        method: r.method,
        amount: r.amount,
        payerLabel: r.payerLabel,
      })),
    );
  };

  const handleConfirmItems = () => {
    onConfirm(
      itemGroups.map((g, i) => ({
        method: g.method,
        amount: itemGroupTotals[i].toFixed(2),
        payerLabel: g.label,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Dividir Conta — Total {formatCurrency(total)}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pessoas">
          <TabsList>
            <TabsTrigger value="pessoas">Por pessoas</TabsTrigger>
            <TabsTrigger value="itens">Por itens</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas" className="space-y-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="num-people" className="shrink-0">
                Número de pessoas
              </Label>
              <Input
                id="num-people"
                type="number"
                min="2"
                max="20"
                className="w-20"
                value={numPeople}
                onChange={(e) => setNumPeople(Math.max(2, Number(e.target.value) || 2))}
              />
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {peopleRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-sm text-muted-foreground">{row.payerLabel}</span>
                  <Input
                    className="w-24"
                    value={row.amount}
                    onChange={(e) => {
                      const next = [...peopleRows];
                      next[i] = { ...next[i], amount: e.target.value };
                      setPeopleRows(next);
                    }}
                  />
                  <Select
                    value={row.method}
                    onValueChange={(v) => {
                      const next = [...peopleRows];
                      next[i] = { ...next[i], method: v };
                      setPeopleRows(next);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Soma informada</span>
              <span className={Math.abs(peopleTotal - total) < 0.01 ? "text-emerald-600" : "text-red-500"}>
                {formatCurrency(peopleTotal)} / {formatCurrency(total)}
              </span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!peopleValid || isPending} onClick={handleConfirmPeople}>
                Confirmar e Fechar Comanda
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="itens" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Grupos</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setItemGroups((prev) => [
                    ...prev,
                    { label: `Pessoa ${prev.length + 1}`, method: "" },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar pessoa
              </Button>
            </div>
            <div className="space-y-2">
              {itemGroups.map((group, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-sm text-muted-foreground">{group.label}</span>
                  <Select
                    value={group.method}
                    onValueChange={(v) => {
                      const next = [...itemGroups];
                      next[i] = { ...next[i], method: v };
                      setItemGroups(next);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="w-24 shrink-0 text-right text-sm font-medium">
                    {formatCurrency(itemGroupTotals[i] ?? 0)}
                  </span>
                  {itemGroups.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-red-500"
                      onClick={() => {
                        setItemGroups((prev) => prev.filter((_, idx) => idx !== i));
                        setItemAssignment((prev) => {
                          const next = { ...prev };
                          for (const key in next) {
                            if (next[key] === i) delete next[key];
                            else if (next[key] > i) next[key] -= 1;
                          }
                          return next;
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto border-t pt-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm">
                    {item.quantity}x {item.name}
                  </span>
                  <div className="flex gap-3">
                    {itemGroups.map((group, i) => (
                      <label key={i} className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={itemAssignment[item.id] === i}
                          onCheckedChange={(checked) =>
                            setItemAssignment((prev) => ({
                              ...prev,
                              [item.id]: checked ? i : -1,
                            }))
                          }
                        />
                        {group.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!allItemsAssigned && (
              <p className="text-xs text-red-500">Atribua todos os itens a uma pessoa.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!itemsValid || isPending} onClick={handleConfirmItems}>
                Confirmar e Fechar Comanda
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
