import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { extractApiMessage } from "@/lib/api-error";
import { getPdvCurrentUnitId } from "@/lib/pdv-unit";
import { daysAgoInSaoPaulo, todayInSaoPaulo } from "@shared/sao-paulo-date";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AlertCircle, BarChart3, Printer } from "lucide-react";
import { PrintArea, printArea } from "@/components/restaurant-pdv/print-area";
import { PageHeader } from "@/components/page-header";
import { CashSessionReport } from "@/components/restaurant-pdv/cash-session-report";
import {
  CancelledItemsTable,
  CancellationsByUser,
  type CancelledItem,
} from "@/components/restaurant-pdv/cancelled-items-table";
import { useLocation } from "wouter";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  outros: "Outros",
};

interface SalesReport {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  byHour: { hour: number; orderCount: number; revenue: number }[];
  dailySeries: { date: string; orderCount: number; revenue: number }[];
  byPaymentMethod: { method: string; total: number }[];
  byWaiter: { waiterId: string; waiterName: string; total: number; orderCount: number }[];
}

interface DailySummary {
  date: string;
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  byPaymentMethod: { method: string; total: number }[];
  byWaiter: { waiterId: string; waiterName: string; total: number; orderCount: number }[];
}

interface CancellationsReport {
  itemCount: number;
  total: string;
  byUser: {
    userId: string;
    userName: string;
    itemCount: number;
    total: string;
    sharePercent: number;
  }[];
  topReasons: { reason: string; count: number }[];
  items: CancelledItem[];
  /** Quantas linhas o período tem antes do recorte de exibição. */
  totalItemRows: number;
  truncated: boolean;
}

/**
 * Carregando / erro / conteúdo.
 *
 * Existe porque a página inteira renderizava `?? 0` em cima de `data`
 * indefinido: um 400 ou 403 ficava pixel-idêntico a "não houve venda". Foi
 * assim que a página passou meses zerada sem ninguém ver o erro.
 *
 * O botão de tentar de novo não é enfeite: o queryClient roda com
 * `retry: false` e `staleTime: Infinity`, então sem ele o único jeito de sair
 * do estado de erro é recarregar a página.
 */
function ReportCardState({
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-destructive">Não foi possível carregar</p>
          <p className="text-sm text-muted-foreground">{extractApiMessage(error)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

async function fetchReport<T>(url: string): Promise<T> {
  // `apiRequest` e não `fetch` cru: é ele que injeta o header X-PDV-Unit-Id
  // (sem o qual estas rotas devolvem 400) e que trata 401 deslogando.
  const res = await apiRequest("GET", url);
  return (await res.json()) as T;
}

export default function RestaurantReports() {
  const [, navigate] = useLocation();
  // Datas no fuso de São Paulo: com `toISOString()` o filtro abria em
  // "amanhã" entre 21h e meia-noite — justamente o pico do restaurante.
  const [from, setFrom] = useState(() => daysAgoInSaoPaulo(6));
  const [to, setTo] = useState(() => todayInSaoPaulo());
  const [cashDate, setCashDate] = useState(() => todayInSaoPaulo());

  // A unidade entra na chave para que o cache não vaze de uma unidade para
  // outra. Hoje o seletor recarrega a página inteira e mascara isso.
  const unitId = getPdvCurrentUnitId();

  const {
    data: report,
    isLoading: isReportLoading,
    isError: isReportError,
    error: reportError,
    refetch: refetchReport,
  } = useQuery<SalesReport>({
    queryKey: ["/api/restaurant-pdv/reports/sales", { from, to, unitId }],
    queryFn: () =>
      fetchReport<SalesReport>(
        `/api/restaurant-pdv/reports/sales?from=${from}&to=${to}`,
      ),
  });

  const {
    data: cancellations,
    isLoading: isCancellationsLoading,
    isError: isCancellationsError,
    error: cancellationsError,
    refetch: refetchCancellations,
  } = useQuery<CancellationsReport>({
    queryKey: ["/api/restaurant-pdv/reports/cancellations", { from, to, unitId }],
    queryFn: () =>
      fetchReport<CancellationsReport>(
        `/api/restaurant-pdv/reports/cancellations?from=${from}&to=${to}`,
      ),
  });

  const {
    data: dailySummary,
    isLoading: isDailyLoading,
    isError: isDailyError,
    error: dailyError,
    refetch: refetchDaily,
  } = useQuery<DailySummary>({
    queryKey: ["/api/restaurant-pdv/reports/daily-summary", { date: cashDate, unitId }],
    queryFn: () =>
      fetchReport<DailySummary>(
        `/api/restaurant-pdv/reports/daily-summary?date=${cashDate}`,
      ),
  });

  return (
    <div className="w-full space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={BarChart3}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Relatórios</PageHeader.Title>
            <PageHeader.Description>
              Vendas, itens mais vendidos e conferência por caixa do PDV Restaurante
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label htmlFor="from-date">De</Label>
            <Input
              id="from-date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to-date">Até</Label>
            <Input id="to-date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ReportCardState
            isLoading={isReportLoading}
            isError={isReportError}
            error={reportError}
            onRetry={() => void refetchReport()}
          >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Total Vendido</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(report?.totalRevenue ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(report?.averageTicket ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Nº de Comandas</p>
                <p className="text-2xl font-bold">{report?.orderCount ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Comparação entre dias</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={report?.dailySeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Vendas por horário</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report?.byHour ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" fontSize={12} tickFormatter={(h) => `${h}h`} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Vendas por forma de pagamento</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={(report?.byPaymentMethod ?? []).map((p) => ({
                    ...p,
                    label: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Vendas por garçom</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report?.byWaiter ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="waiterName" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Itens mais vendidos</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.topItems ?? []).map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatCurrency(item.revenue)}</TableCell>
                  </TableRow>
                ))}
                {(report?.topItems ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum dado no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </ReportCardState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Cancelamentos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Itens cancelados no período. Um cancelamento avulso é rotina — o que
              chama atenção é a concentração num mesmo operador.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(cancellations?.total ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {cancellations?.itemCount ?? 0} item(ns)
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ReportCardState
            isLoading={isCancellationsLoading}
            isError={isCancellationsError}
            error={cancellationsError}
            onRetry={() => void refetchCancellations()}
          >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs uppercase text-muted-foreground">Por quem cancelou</p>
              <CancellationsByUser byUser={cancellations?.byUser ?? []} />
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase text-muted-foreground">Motivos mais usados</p>
              {(cancellations?.topReasons ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum motivo registrado
                </p>
              ) : (
                <div className="space-y-2">
                  {cancellations?.topReasons.map((r) => (
                    <div
                      key={r.reason}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span className="truncate">{r.reason}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {r.count}×
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase text-muted-foreground">Detalhamento</p>
            {cancellations?.truncated && (
              <p className="mb-2 text-xs text-muted-foreground">
                Mostrando os {cancellations.items.length} mais recentes de{" "}
                {cancellations.totalItemRows} itens. Os totais acima consideram o
                período inteiro.
              </p>
            )}
            <CancelledItemsTable
              items={cancellations?.items ?? []}
              showDate
              emptyMessage="Nenhum item cancelado no período"
            />
          </div>
          </ReportCardState>
        </CardContent>
      </Card>

      <CashSessionReport />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            {/* Isto sempre foi um relatório de vendas por data, não um
                fechamento de caixa: nada aqui é conferido nem congelado. O
                fechamento de verdade vive em PDV → Caixa. */}
            <CardTitle>Resumo de Vendas por Dia</CardTitle>
            <p className="text-sm text-muted-foreground">
              Visão por data civil. Para a conferência de gaveta, veja{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => navigate("/pdv-restaurante/caixa")}
              >
                Caixa
              </button>
              .
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => printArea("cash-closing-print-area")}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir resumo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cash-date">Data</Label>
            <Input
              id="cash-date"
              type="date"
              className="w-48"
              value={cashDate}
              onChange={(e) => setCashDate(e.target.value)}
            />
          </div>

          <ReportCardState
            isLoading={isDailyLoading}
            isError={isDailyError}
            error={dailyError}
            onRetry={() => void refetchDaily()}
          >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Total do Dia</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(dailySummary?.totalRevenue ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Comandas Fechadas</p>
                <p className="text-2xl font-bold">{dailySummary?.orderCount ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(dailySummary?.averageTicket ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium">Por forma de pagamento</h4>
              <Table>
                <TableBody>
                  {(dailySummary?.byPaymentMethod ?? []).map((p) => (
                    <TableRow key={p.method}>
                      <TableCell>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.total)}</TableCell>
                    </TableRow>
                  ))}
                  {(dailySummary?.byPaymentMethod ?? []).length === 0 && (
                    <TableRow>
                      <TableCell className="text-center text-muted-foreground">
                        Sem comandas fechadas nesta data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">Por garçom</h4>
              <Table>
                <TableBody>
                  {(dailySummary?.byWaiter ?? []).map((w) => (
                    <TableRow key={w.waiterId}>
                      <TableCell>{w.waiterName}</TableCell>
                      <TableCell>{w.orderCount} comanda(s)</TableCell>
                      <TableCell className="text-right">{formatCurrency(w.total)}</TableCell>
                    </TableRow>
                  ))}
                  {(dailySummary?.byWaiter ?? []).length === 0 && (
                    <TableRow>
                      <TableCell className="text-center text-muted-foreground">
                        Sem comandas fechadas nesta data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          </ReportCardState>
        </CardContent>
      </Card>

      <PrintArea id="cash-closing-print-area">
        <div style={{ maxWidth: 420, margin: "0 auto", fontSize: 13, fontFamily: "monospace" }}>
          <h2 style={{ textAlign: "center", marginBottom: 4 }}>Resumo de Vendas</h2>
          <p style={{ textAlign: "center", marginBottom: 16 }}>{cashDate}</p>
          <hr />
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span>Total do dia</span>
            <span>{formatCurrency(dailySummary?.totalRevenue ?? 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Comandas fechadas</span>
            <span>{dailySummary?.orderCount ?? 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Ticket médio</span>
            <span>{formatCurrency(dailySummary?.averageTicket ?? 0)}</span>
          </div>
          <hr style={{ marginTop: 8 }} />
          <p style={{ fontWeight: "bold", marginTop: 8 }}>Por forma de pagamento</p>
          {(dailySummary?.byPaymentMethod ?? []).map((p) => (
            <div key={p.method} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
              <span>{formatCurrency(p.total)}</span>
            </div>
          ))}
          <hr style={{ marginTop: 8 }} />
          <p style={{ fontWeight: "bold", marginTop: 8 }}>Por garçom</p>
          {(dailySummary?.byWaiter ?? []).map((w) => (
            <div key={w.waiterId} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {w.waiterName} ({w.orderCount})
              </span>
              <span>{formatCurrency(w.total)}</span>
            </div>
          ))}
        </div>
      </PrintArea>
    </div>
  );
}
