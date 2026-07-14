import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { RestaurantOrderItem } from "@shared/schema";
import type { RestaurantTableWithStatus } from "@/pages/restaurant-pdv/table-map";

interface TransferItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RestaurantOrderItem[];
  currentTableId: string | null;
  isPending?: boolean;
  onConfirm: (itemIds: string[], targetOrderId: string) => void;
}

export function TransferItemsDialog({
  open,
  onOpenChange,
  items,
  currentTableId,
  isPending = false,
  onConfirm,
}: TransferItemsDialogProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [targetOrderId, setTargetOrderId] = useState("");

  const { data: tables = [] } = useQuery<RestaurantTableWithStatus[]>({
    queryKey: ["/api/restaurant-pdv/tables/map"],
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedItemIds(new Set());
      setTargetOrderId("");
    }
  }, [open]);

  const targetOptions = tables.filter(
    (t) => t.id !== currentTableId && t.orderId && t.status !== "livre",
  );

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Transferir Itens</DialogTitle>
        </DialogHeader>
        <div className="max-h-56 space-y-2 overflow-y-auto py-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedItemIds.has(item.id)}
                onCheckedChange={() => toggleItem(item.id)}
              />
              {item.quantity}x {item.name}
            </label>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item na comanda.</p>
          )}
        </div>
        <Select value={targetOrderId} onValueChange={setTargetOrderId}>
          <SelectTrigger>
            <SelectValue placeholder="Mesa de destino" />
          </SelectTrigger>
          <SelectContent>
            {targetOptions.map((t) => (
              <SelectItem key={t.id} value={t.orderId as string}>
                Mesa {t.number}
              </SelectItem>
            ))}
            {targetOptions.length === 0 && (
              <SelectItem value="none" disabled>
                Nenhuma mesa ocupada disponível
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={selectedItemIds.size === 0 || !targetOrderId || isPending}
            onClick={() => onConfirm(Array.from(selectedItemIds), targetOrderId)}
          >
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
