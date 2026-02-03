import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { BlingOrder } from "@/hooks/use-bling-orders";
import { EyeIcon, InboxIcon } from "lucide-react";
import { useState } from "react";
import { OrderDetailsDialog } from "./order-details-dialog";

interface OrdersTableProps {
  orders: BlingOrder[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasMore: boolean;
  totalOrders?: number;
}

// Helper to get badge color based on status text (since we don't have IDs mapping handy for all)
// This is a heuristic approach. Ideal would be to map specific IDs.
function getStatusVariant(statusName: string | undefined): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (!statusName) return "outline";
  
  const status = statusName.toLowerCase();
  
  if (status.includes("cancelado")) return "destructive";
  if (status.includes("atendido") || status.includes("verificado") || status.includes("concluído")) return "success"; // 'success' requires custom badge or standard 'default' with class
  if (status.includes("pendente") || status.includes("em aberto")) return "warning"; // 'warning' requires custom badge or standard 'secondary'
  
  return "secondary";
}

// Custom Badge component wrapper if needed, or just use Badge with className
function StatusBadge({ name }: { name: string }) {
  const variant = getStatusVariant(name);
  let className = "";
  
  if (variant === "success") className = "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60 border-transparent";
  if (variant === "warning") className = "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60 border-transparent";
  if (variant === "destructive") className = "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 border-transparent";
  
  return <Badge variant={variant === "success" || variant === "warning" || variant === "destructive" ? "outline" : variant} className={className}>{name}</Badge>;
}

export function OrdersTable({
  orders,
  isLoading,
  page,
  onPageChange,
  hasMore,
  totalOrders = 0,
}: OrdersTableProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleViewDetails = (blingOrderId: string) => {
    setSelectedOrderId(blingOrderId);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border shadow-sm bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border shadow-sm bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold text-foreground">Número</TableHead>
              <TableHead className="font-semibold text-foreground">Data</TableHead>
              <TableHead className="font-semibold text-foreground">Cliente</TableHead>
              <TableHead className="font-semibold text-foreground">Vendedor</TableHead>
              <TableHead className="font-semibold text-foreground">Situação</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Valor</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-64 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="rounded-full bg-muted p-4">
                      <InboxIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-medium text-foreground">
                        Nenhum pedido encontrado
                      </p>
                      <p className="text-sm">
                        Não há pedidos que correspondam aos filtros selecionados.
                      </p>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <p>💡 Dicas:</p>
                      <ul className="list-disc list-inside text-left">
                        <li>Tente ajustar o período de datas</li>
                        <li>Remova alguns filtros para ampliar a busca</li>
                        <li>Verifique se os filtros estão configurados corretamente</li>
                      </ul>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium font-mono text-xs">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(order.saleDate + 'T12:00:00'), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{order.contactName || "Não informado"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{order.sellerName || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge name={order.situationName || order.situationId || "-"} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(parseFloat(order.totalValue))}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => handleViewDetails(order.blingOrderId)}
                      title="Ver detalhes"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground space-y-1">
          <div>
            Mostrando {orders.length} pedido{orders.length !== 1 ? "s" : ""} (Página {page})
          </div>
          {totalOrders > 0 && (
            <div className="font-medium">
              Total de {totalOrders} pedido{totalOrders !== 1 ? "s" : ""} encontrado{totalOrders !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={
                  page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                }
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>{page}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(page + 1)}
                className={
                  !hasMore ? "pointer-events-none opacity-50" : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <OrderDetailsDialog
        blingOrderId={selectedOrderId}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedOrderId(null);
        }}
      />
    </div>
  );
}

