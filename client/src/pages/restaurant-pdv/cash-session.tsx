import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Lock,
  Wallet,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RestaurantCashSession } from "@shared/schema";
import type { CashSessionSummary } from "@shared/restaurant-cash-session";
import {
  CashMovementDialog,
  type CashMovementType,
} from "@/components/restaurant-pdv/cash-movement-dialog";
import { CloseCashSessionDialog } from "@/components/restaurant-pdv/close-cash-session-dialog";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
};

interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: string;
  reason: string;
  createdAt: string;
}

interface SessionOrderRow {
  id: string;
  orderNumber: number;
  tableNumber: number;
  waiterName: string | null;
  paymentMethod: string | null;
  total: string | null;
  closedAt: string | null;
}

export interface CashSessionDetail extends RestaurantCashSession {
  movements: CashMovement[];
  summary: CashSessionSummary;
  closedOrders: SessionOrderRow[];
  openedByName: string | null;
  closedByName: string | null;
}

const CURRENT_KEY = ["/api/restaurant-pdv/cash-sessions/current"];
const LIST_KEY = ["/api/restaurant-pdv/cash-sessions"];

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Dentro da sessão do dia, só a hora importa. */
function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RestaurantCashSessionPage() {
  const [openingFloat, setOpeningFloat] = useState("");
  const [movementType, setMovementType] = useState<CashMovementType | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<{ session: CashSessionDetail | null }>({
    queryKey: CURRENT_KEY,
    refetchInterval: 30000,
  });
  const session = data?.session ?? null;

  const { data: history = [] } = useQuery<RestaurantCashSession[]>({
    queryKey: LIST_KEY,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CURRENT_KEY });
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
    // O mapa de mesas mostra o bloqueio de caixa fechado.
    queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
  };

  const openMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/restaurant-pdv/cash-sessions", {
        openingFloat: openingFloat.replace(",", ".") || "0",
      });
    },
    onSuccess: () => {
      toast({ title: "Caixa aberto", description: "O PDV está liberado para operar." });
      setOpeningFloat("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao abrir o caixa", description: err.message, variant: "destructive" });
    },
  });

  const movementMutation = useMutation({
    mutationFn: async (data: { amount: string; reason: string }) => {
      await apiRequest("POST", "/api/restaurant-pdv/cash-sessions/movements", {
        type: movementType,
        ...data,
      });
    },
    onSuccess: () => {
      toast({ title: "Movimento registrado" });
      setMovementType(null);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao registrar movimento", description: err.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (data: { countedCash: string; countedByMethod: Record<string, string>; notes?: string }) => {
      await apiRequest(
        "POST",
        `/api/restaurant-pdv/cash-sessions/${session?.id}/close`,
        data,
      );
    },
    onSuccess: () => {
      toast({ title: "Caixa fechado", description: "Conferência registrada." });
      setCloseDialogOpen(false);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao fechar o caixa", description: err.message, variant: "destructive" });
    },
  });

  const summary = session?.summary;
  const expectedCash = Number(summary?.cash.expected ?? 0);
  const divergence = Number(summary?.divergence ?? 0);

  return (
    <div className="w-full space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Wallet}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Caixa</PageHeader.Title>
            <PageHeader.Description>
              {session
                ? `Caixa #${session.sessionNumber} aberto por ${session.openedByName ?? "—"}`
                : "Nenhum caixa aberto no momento"}
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        {session && (
          <PageHeader.Actions>
            <Button variant="outline" size="sm" onClick={() => setMovementType("suprimento")}>
              <ArrowUpCircle className="mr-1.5 h-4 w-4" />
              Suprimento
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovementType("sangria")}>
              <ArrowDownCircle className="mr-1.5 h-4 w-4" />
              Sangria
            </Button>
            <Button size="sm" onClick={() => setCloseDialogOpen(true)}>
              <Lock className="mr-1.5 h-4 w-4" />
              Fechar caixa
            </Button>
          </PageHeader.Actions>
        )}
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando caixa...</p>
      ) : !session ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="font-semibold">Nenhum caixa aberto</p>
              <p className="text-sm text-muted-foreground">
                Enquanto o caixa estiver fechado, não é possível abrir mesas no PDV.
              </p>
            </div>
            <form
              className="flex w-full max-w-xs flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                openMutation.mutate();
              }}
            >
              <Label htmlFor="opening-float" className="text-left">
                Fundo de troco
              </Label>
              <Input
                id="opening-float"
                inputMode="decimal"
                placeholder="0,00"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
              />
              <Button type="submit" disabled={openMutation.isPending}>
                {openMutation.isPending ? "Abrindo..." : "Abrir Caixa"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Vendas na sessão</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary?.ordersTotal ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary?.orderCount ?? 0} comanda(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Dinheiro em caixa</p>
                <p className="text-2xl font-bold">{formatCurrency(expectedCash)}</p>
                <p className="mt-1 text-xs text-muted-foreground">esperado na gaveta</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Aberto há</p>
                <p className="flex items-center gap-1.5 text-2xl font-bold">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  {formatDistanceToNowStrict(new Date(session.openedAt), { locale: ptBR })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  desde {formatDateTime(session.openedAt)}
                </p>
              </CardContent>
            </Card>
            <Card className={cn(divergence !== 0 && "border-red-300 dark:border-red-900")}>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Divergência</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    divergence !== 0 && "text-red-600 dark:text-red-400",
                  )}
                >
                  {formatCurrency(divergence)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  pagamentos × total das comandas
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Composição do dinheiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fundo de troco</span>
                  <span>{formatCurrency(summary?.cash.openingFloat ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recebido em dinheiro</span>
                  <span>+{formatCurrency(summary?.cash.cashPayments ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suprimentos</span>
                  <span>+{formatCurrency(summary?.cash.suprimentos ?? 0)}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>Sangrias</span>
                  <span>-{formatCurrency(summary?.cash.sangrias ?? 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Esperado na gaveta</span>
                  <span>{formatCurrency(expectedCash)}</span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Cartão e Pix não entram na contagem — só o que está fisicamente na gaveta.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por forma de pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {(summary?.byPaymentMethod ?? []).map((p) => (
                      <TableRow key={p.method}>
                        <TableCell>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.total)}</TableCell>
                      </TableRow>
                    ))}
                    {(summary?.byPaymentMethod ?? []).length === 0 && (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground">
                          Nenhuma comanda fechada nesta sessão
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {summary && (Number(summary.discountTotal) > 0 || summary.cancelledOrderCount > 0) && (
                  <div className="mt-4 space-y-1 border-t pt-3 text-sm">
                    {Number(summary.discountTotal) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Descontos concedidos</span>
                        <span>{formatCurrency(summary.discountTotal)}</span>
                      </div>
                    )}
                    {summary.cancelledOrderCount > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        {/* "em itens": sem taxa de serviço, que nunca foi
                            cobrada — não é comparável com "Vendas na sessão". */}
                        <span>
                          {summary.cancelledOrderCount} comanda(s) cancelada(s), em itens
                        </span>
                        <span>{formatCurrency(summary.cancelledTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Últimas vendas fechadas</CardTitle>
              <span className="text-sm text-muted-foreground">
                {summary?.orderCount ?? 0} comanda(s) · {formatCurrency(summary?.ordersTotal ?? 0)}
              </span>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comanda</TableHead>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Garçom</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Fechada às</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.closedOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                      <TableCell>Mesa {o.tableNumber}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.waiterName ?? "—"}
                      </TableCell>
                      <TableCell>
                        {o.paymentMethod ? (
                          <Badge variant="outline">
                            {PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}
                          </Badge>
                        ) : (
                          // `paymentMethod` nulo = conta dividida entre formas diferentes.
                          <Badge variant="outline" className="text-blue-600 dark:text-blue-400">
                            Dividido
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.closedAt ? formatTime(o.closedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(o.total ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {session.closedOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                        Nenhuma comanda fechada nesta sessão
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {(summary?.orderCount ?? 0) > session.closedOrders.length && (
                <p className="pt-3 text-xs text-muted-foreground">
                  Mostrando as {session.closedOrders.length} mais recentes. Veja todas em
                  Relatórios.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimentos de caixa</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.type === "sangria"
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {m.type === "sangria" ? "Sangria" : "Suprimento"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(m.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{m.reason}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {session.movements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Nenhum movimento registrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Caixas anteriores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caixa</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history
                .filter((s) => s.status === "fechado")
                .map((s) => {
                  const diff = Number(s.difference ?? 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>#{s.sessionNumber}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(s.openedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.closedAt ? formatDateTime(s.closedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.expectedCash ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.countedCash ?? 0)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          diff !== 0 && "text-red-600 dark:text-red-400",
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatCurrency(diff)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {history.filter((s) => s.status === "fechado").length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Nenhum caixa fechado ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CashMovementDialog
        open={movementType !== null}
        onOpenChange={(open) => !open && setMovementType(null)}
        type={movementType ?? "sangria"}
        expectedCash={expectedCash}
        isPending={movementMutation.isPending}
        onConfirm={(data) => movementMutation.mutate(data)}
      />

      <CloseCashSessionDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        byPaymentMethod={summary?.byPaymentMethod ?? []}
        isPending={closeMutation.isPending}
        onConfirm={(data) => closeMutation.mutate(data)}
      />
    </div>
  );
}
