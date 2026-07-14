import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History } from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  reason: string | null;
  actorName: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  item_cancelado: "Item cancelado",
  desconto_aplicado: "Desconto aplicado",
  desconto_removido: "Desconto removido",
  itens_transferidos: "Itens transferidos",
  mesas_mescladas: "Mesas mescladas",
  pagamento_solicitado: "Conta solicitada",
  pagamento_cancelado: "Pedido de conta cancelado",
  comanda_fechada: "Comanda fechada",
};

interface OrderAuditLogProps {
  orderId: string;
  trigger?: React.ReactNode;
}

export function OrderAuditLog({ orderId, trigger }: OrderAuditLogProps) {
  const { data: logs = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/restaurant-pdv/orders", orderId, "audit-log"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant-pdv/orders/${orderId}/audit-log`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar histórico");
      return res.json();
    },
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost">
            <History className="mr-1.5 h-3.5 w-3.5" />
            Ver histórico
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Histórico da Comanda</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{ACTION_LABELS[log.action] ?? log.action}</TableCell>
                  <TableCell>{log.reason ?? "—"}</TableCell>
                  <TableCell>{log.actorName}</TableCell>
                  <TableCell>
                    {new Date(log.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum registro de auditoria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
