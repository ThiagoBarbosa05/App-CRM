import { useState, type CSSProperties } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn, formatCurrency, parseBRL } from "@/lib/utils";
import { PrintArea, printArea } from "@/components/restaurant-pdv/print-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2,
  Clock,
  Lock,
  Users,
  Wallet,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RestaurantCashSession } from "@shared/schema";
import type { CashSessionSummary } from "@shared/restaurant-cash-session";
import {
  CashMovementDialog,
  type CashMovementType,
} from "@/components/restaurant-pdv/cash-movement-dialog";
import { CloseCashSessionDialog } from "@/components/restaurant-pdv/close-cash-session-dialog";
import {
  CancelledItemsTable,
  cancelledItemValue,
  type CancelledItem,
} from "@/components/restaurant-pdv/cancelled-items-table";

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
  cancelledItems: CancelledItem[];
  openedByName: string | null;
  closedByName: string | null;
}

interface SessionOverviewRow {
  id: string;
  sessionNumber: number;
  status: string;
  openedBy: string;
  openedByName: string | null;
  unitId: string | null;
  unitName: string | null;
  openedAt: string;
  closedAt: string | null;
  expectedCash: string | null;
  countedCash: string | null;
  difference: string | null;
  openingFloat: string;
  totalBilled: string;
}

const CURRENT_KEY = ["/api/restaurant-pdv/cash-sessions/current"];
const LIST_KEY = ["/api/restaurant-pdv/cash-sessions"];
const OVERVIEW_KEY = ["/api/restaurant-pdv/cash-sessions/overview"];

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

type CloseFormData = { countedCash: string; countedByMethod: Record<string, string>; notes?: string };

interface PrintSnapshot {
  session: CashSessionDetail;
  formData: CloseFormData;
  closedAt: Date;
}

export default function RestaurantCashSessionPage() {
  const [openingFloat, setOpeningFloat] = useState("");
  const [movementType, setMovementType] = useState<CashMovementType | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<PrintSnapshot | null>(null);

  const { data, isLoading } = useQuery<{ session: CashSessionDetail | null }>({
    queryKey: CURRENT_KEY,
    refetchInterval: 30000,
  });
  const session = data?.session ?? null;

  const { data: history = [] } = useQuery<RestaurantCashSession[]>({
    queryKey: LIST_KEY,
  });

  const { data: overview = [] } = useQuery<SessionOverviewRow[]>({
    queryKey: OVERVIEW_KEY,
    refetchInterval: 20000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CURRENT_KEY });
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
    queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    // O mapa de mesas mostra o bloqueio de caixa fechado.
    queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
  };

  // Campo vazio = abrir sem fundo de troco. Preenchido, tem que ser um número:
  // antes, texto inválido virava NaN e chegava ao banco como erro 500 sem
  // explicação.
  const parsedOpeningFloat =
    openingFloat.trim() === "" ? 0 : parseBRL(openingFloat);
  const openingFloatValid = parsedOpeningFloat !== null && parsedOpeningFloat >= 0;

  const openMutation = useMutation({
    mutationFn: async () => {
      if (!openingFloatValid) return;
      await apiRequest("POST", "/api/restaurant-pdv/cash-sessions", {
        openingFloat: parsedOpeningFloat.toFixed(2),
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
    mutationFn: async (data: CloseFormData) => {
      // Captura snapshot antes da invalidação do cache
      if (session) {
        setPrintSnapshot({ session, formData: data, closedAt: new Date() });
      }
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
      // Aciona impressão automática após DOM atualizar
      setTimeout(() => printArea("close-session-print-area"), 300);
    },
    onError: (err: Error) => {
      setPrintSnapshot(null);
      toast({ title: "Erro ao fechar o caixa", description: err.message, variant: "destructive" });
    },
  });

  const summary = session?.summary;
  const expectedCash = Number(summary?.cash.expected ?? 0);
  const divergence = Number(summary?.divergence ?? 0);

  const openCount = overview.filter((s) => s.status === "aberto").length;

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

      <Tabs defaultValue="meu-caixa">
        <TabsList>
          <TabsTrigger value="meu-caixa">
            <Wallet className="mr-1.5 h-4 w-4" />
            Meu Caixa
          </TabsTrigger>
          <TabsTrigger value="visao-geral">
            <Users className="mr-1.5 h-4 w-4" />
            Visão Geral
            {openCount > 0 && (
              <span className="ml-1.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {openCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <OverviewTab sessions={overview} />
        </TabsContent>

        <TabsContent value="meu-caixa" className="mt-4 space-y-6">

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
                aria-invalid={!openingFloatValid}
              />
              {!openingFloatValid && (
                <p className="text-left text-xs text-red-600 dark:text-red-400">
                  Valor inválido. Use o formato 1.234,56.
                </p>
              )}
              <Button
                type="submit"
                disabled={openMutation.isPending || !openingFloatValid}
              >
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
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Itens cancelados no turno</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Padrão ao longo do tempo aparece em Relatórios → Cancelamentos.
                </p>
              </div>
              {session.cancelledItems.length > 0 && (
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(
                    session.cancelledItems.reduce((s, i) => s + cancelledItemValue(i), 0),
                  )}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <CancelledItemsTable
                items={session.cancelledItems}
                emptyMessage="Nenhum item cancelado neste turno"
              />
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
        </TabsContent>
      </Tabs>

      {printSnapshot && <CloseSessionPrintArea snapshot={printSnapshot} />}
    </div>
  );
}

const PAYMENT_METHOD_LABELS_PRINT: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartao Credito",
  cartao_debito: "Cartao Debito",
  dinheiro: "Dinheiro",
};

function CloseSessionPrintArea({ snapshot }: { snapshot: PrintSnapshot }) {
  const { session, formData, closedAt } = snapshot;
  const s = session.summary;
  const expectedCash = Number(s?.cash.expected ?? 0);
  const countedCash = Number(formData.countedCash ?? 0);
  const cashDiff = countedCash - expectedCash;

  const lineStyle: CSSProperties = { display: "flex", justifyContent: "space-between", margin: "2px 0" };
  const hrStyle: CSSProperties = { border: "none", borderTop: "1px dashed #000", margin: "6px 0" };
  const centerStyle: CSSProperties = { textAlign: "center", margin: "4px 0" };
  const boldStyle: CSSProperties = { fontWeight: "bold" };

  return (
    <PrintArea id="close-session-print-area">
      <div style={{ maxWidth: 320, margin: "0 auto", fontFamily: "monospace", fontSize: 12, color: "#000" }}>
        <div style={centerStyle}>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>FECHAMENTO DE CAIXA</div>
          <div style={{ fontSize: 13, fontWeight: "bold" }}>Caixa #{session.sessionNumber}</div>
        </div>
        <hr style={hrStyle} />
        <div style={lineStyle}><span>Abertura</span><span>{new Date(session.openedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>
        <div style={lineStyle}><span>Fechamento</span><span>{closedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>
        {session.openedByName && <div style={lineStyle}><span>Aberto por</span><span>{session.openedByName}</span></div>}
        <hr style={hrStyle} />

        {/* Vendas */}
        <div style={{ ...boldStyle, marginBottom: 4 }}>VENDAS</div>
        {(s?.byPaymentMethod ?? []).map((p) => (
          <div key={p.method} style={lineStyle}>
            <span>{PAYMENT_METHOD_LABELS_PRINT[p.method] ?? p.method}</span>
            <span>{formatCurrency(p.total)}</span>
          </div>
        ))}
        <div style={{ ...lineStyle, ...boldStyle, borderTop: "1px solid #000", paddingTop: 2, marginTop: 2 }}>
          <span>TOTAL VENDAS</span>
          <span>{formatCurrency(s?.ordersTotal ?? 0)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#333", margin: "2px 0 4px" }}>
          {s?.orderCount ?? 0} comanda(s) fechada(s)
        </div>
        <hr style={hrStyle} />

        {/* Composição do dinheiro */}
        <div style={{ ...boldStyle, marginBottom: 4 }}>COMPOSICAO DO DINHEIRO</div>
        <div style={lineStyle}><span>Fundo de troco</span><span>{formatCurrency(s?.cash.openingFloat ?? 0)}</span></div>
        <div style={lineStyle}><span>Recebido em dinheiro</span><span>+{formatCurrency(s?.cash.cashPayments ?? 0)}</span></div>
        {Number(s?.cash.suprimentos ?? 0) > 0 && (
          <div style={lineStyle}><span>Suprimentos</span><span>+{formatCurrency(s?.cash.suprimentos ?? 0)}</span></div>
        )}
        {Number(s?.cash.sangrias ?? 0) > 0 && (
          <div style={lineStyle}><span>Sangrias</span><span>-{formatCurrency(s?.cash.sangrias ?? 0)}</span></div>
        )}
        <div style={{ ...lineStyle, ...boldStyle, borderTop: "1px solid #000", paddingTop: 2, marginTop: 2 }}>
          <span>ESPERADO NA GAVETA</span><span>{formatCurrency(expectedCash)}</span>
        </div>
        <hr style={hrStyle} />

        {/* Conferência */}
        <div style={{ ...boldStyle, marginBottom: 4 }}>CONFERENCIA</div>
        {Object.entries(formData.countedByMethod).map(([method, val]) => (
          <div key={method} style={lineStyle}>
            <span>{PAYMENT_METHOD_LABELS_PRINT[method] ?? method} (contado)</span>
            <span>{formatCurrency(Number(val))}</span>
          </div>
        ))}
        <hr style={hrStyle} />
        <div style={lineStyle}><span>Esperado</span><span>{formatCurrency(expectedCash)}</span></div>
        <div style={lineStyle}><span>Contado (dinheiro)</span><span>{formatCurrency(countedCash)}</span></div>
        <div style={{ ...lineStyle, ...boldStyle, borderTop: "1px solid #000", paddingTop: 2, marginTop: 2, color: cashDiff !== 0 ? "#c00" : "#000" }}>
          <span>{cashDiff === 0 ? "CONFERIDO" : cashDiff < 0 ? "QUEBRA DE CAIXA" : "SOBRA DE CAIXA"}</span>
          <span>{cashDiff > 0 ? "+" : ""}{formatCurrency(cashDiff)}</span>
        </div>
        {formData.notes && (
          <>
            <hr style={hrStyle} />
            <div style={{ fontSize: 11 }}>Justificativa: {formData.notes}</div>
          </>
        )}

        {/* Cancelamentos */}
        {(s?.cancelledOrderCount ?? 0) > 0 && (
          <>
            <hr style={hrStyle} />
            <div style={lineStyle}>
              <span>Comandas canceladas</span>
              <span>{s?.cancelledOrderCount} · {formatCurrency(s?.cancelledTotal ?? 0)}</span>
            </div>
          </>
        )}
        {Number(s?.discountTotal ?? 0) > 0 && (
          <div style={lineStyle}><span>Descontos</span><span>{formatCurrency(s?.discountTotal ?? 0)}</span></div>
        )}

        <hr style={hrStyle} />
        <div style={centerStyle}>
          <div style={{ fontSize: 11 }}>
            {closedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </div>
        </div>
      </div>
    </PrintArea>
  );
}

function OverviewTab({ sessions }: { sessions: SessionOverviewRow[] }) {
  const open = sessions.filter((s) => s.status === "aberto");
  const closed = sessions.filter((s) => s.status === "fechado");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Caixas abertos agora</p>
            <p className="mt-1 text-3xl font-bold text-green-600 dark:text-green-400">
              {open.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Caixas fechados hoje</p>
            <p className="mt-1 text-3xl font-bold">{closed.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Total de sessões</p>
            <p className="mt-1 text-3xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
      </div>

      {open.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Abertos agora
            </h3>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Caixa</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Aberto às</TableHead>
                  <TableHead>Tempo aberto</TableHead>
                  <TableHead className="text-right">Fundo de troco</TableHead>
                  <TableHead className="text-right">Total faturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold">#{s.sessionNumber}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.unitName ?? "—"}</TableCell>
                    <TableCell>{s.openedByName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(s.openedAt), "HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(s.openedAt), { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(s.openingFloat ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(s.totalBilled ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico de sessões
          </h3>
        </div>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão fechada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Caixa</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Fechamento</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((s) => {
                  const diff = Number(s.difference ?? 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">#{s.sessionNumber}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{s.unitName ?? "—"}</TableCell>
                      <TableCell>{s.openedByName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(s.openedAt), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.closedAt
                          ? format(new Date(s.closedAt), "dd/MM HH:mm", { locale: ptBR })
                          : "—"}
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
                          diff < 0 && "text-red-600 dark:text-red-400",
                          diff > 0 && "text-green-600 dark:text-green-400",
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatCurrency(diff)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
