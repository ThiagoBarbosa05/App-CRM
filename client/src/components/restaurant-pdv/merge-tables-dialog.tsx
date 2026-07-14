import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RestaurantTableWithStatus } from "@/pages/restaurant-pdv/table-map";

interface MergeTablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTableId: string | null;
  currentTableNumber: number;
  isPending?: boolean;
  onConfirm: (targetOrderId: string) => void;
}

export function MergeTablesDialog({
  open,
  onOpenChange,
  currentTableId,
  currentTableNumber,
  isPending = false,
  onConfirm,
}: MergeTablesDialogProps) {
  const [targetOrderId, setTargetOrderId] = useState("");

  const { data: tables = [] } = useQuery<RestaurantTableWithStatus[]>({
    queryKey: ["/api/restaurant-pdv/tables/map"],
    enabled: open,
  });

  useEffect(() => {
    if (!open) setTargetOrderId("");
  }, [open]);

  const targetOptions = tables.filter(
    (t) => t.id !== currentTableId && t.orderId && t.status !== "livre",
  );
  const targetTable = targetOptions.find((t) => t.orderId === targetOrderId);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Juntar Mesa {currentTableNumber} com outra mesa</AlertDialogTitle>
          <AlertDialogDescription>
            Todos os itens desta mesa serão movidos para a mesa selecionada, e a Mesa{" "}
            {currentTableNumber} será liberada. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!targetOrderId || isPending}
            onClick={() => targetTable && onConfirm(targetOrderId)}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
