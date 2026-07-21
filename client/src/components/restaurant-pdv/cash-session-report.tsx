import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer } from "lucide-react";
import { PrintArea, printArea } from "@/components/restaurant-pdv/print-area";
import type { RestaurantCashSession } from "@shared/schema";
import type { CashSessionDetail } from "@/pages/restaurant-pdv/cash-session";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
};

function formatDateTime(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Conferência de um caixa já fechado. Mostra o snapshot gravado no
 * fechamento — não recalcula, então o número aqui é o que foi conferido na
 * hora, não o que o banco diria hoje.
 */
export function CashSessionReport() {
  const [sessionId, setSessionId] = useState<string>("");

  const { data: sessions = [] } = useQuery<RestaurantCashSession[]>({
    queryKey: ["/api/restaurant-pdv/cash-sessions"],
  });

  const closedSessions = sessions.filter((s) => s.status === "fechado");

  const { data: detail } = useQuery<CashSessionDetail>({
    queryKey: ["/api/restaurant-pdv/cash-sessions", sessionId],
    enabled: !!sessionId,
  });

  const summary = detail?.summary;
  const difference = Number(detail?.difference ?? 0);
  const divergence = Number(summary?.divergence ?? 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Conferência por Caixa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fechamento conferido de cada sessão, por turno — não por data civil.
          </p>
        </div>
        {detail && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => printArea(`cash-session-print-${detail.id}`)}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir conferência
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Caixa</Label>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-full sm:w-96">
              <SelectValue placeholder="Selecione um caixa fechado" />
            </SelectTrigger>
            <SelectContent>
              {closedSessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  #{s.sessionNumber} — {formatDateTime(s.openedAt)} a{" "}
                  {formatDateTime(s.closedAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {closedSessions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum caixa fechado ainda.
            </p>
          )}
        </div>

        {detail && summary && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Vendas</p>
                <p className="text-xl font-bold">{formatCurrency(summary.ordersTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.orderCount} comanda(s)
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Esperado em espécie</p>
                <p className="text-xl font-bold">{formatCurrency(detail.expectedCash ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Contado</p>
                <p className="text-xl font-bold">{formatCurrency(detail.countedCash ?? 0)}</p>
              </div>
              <div
                className={cn(
                  "rounded-lg border p-3",
                  difference !== 0 && "border-red-300 dark:border-red-900",
                )}
              >
                <p className="text-xs uppercase text-muted-foreground">Diferença</p>
                <p
                  className={cn(
                    "text-xl font-bold",
                    difference !== 0 && "text-red-600 dark:text-red-400",
                  )}
                >
                  {difference > 0 ? "+" : ""}
                  {formatCurrency(difference)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {difference === 0 ? "confere" : difference < 0 ? "quebra" : "sobra"}
                </p>
              </div>
            </div>

            {detail.notes && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <span className="font-medium">Justificativa: </span>
                {detail.notes}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="font-medium">Por forma de pagamento</p>
                {summary.byPaymentMethod.map((p) => (
                  <div key={p.method} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                    </span>
                    <span>{formatCurrency(p.total)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Soma dos pagamentos</span>
                  <span>{formatCurrency(summary.paymentsTotal)}</span>
                </div>
                {/* A comparação que nunca existiu: dois números de tabelas
                    diferentes que deveriam ser iguais. */}
                <div
                  className={cn(
                    "flex justify-between",
                    divergence !== 0 && "font-medium text-red-600 dark:text-red-400",
                  )}
                >
                  <span>Divergência × total das comandas</span>
                  <span>{formatCurrency(divergence)}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-medium">Controles</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descontos concedidos</span>
                  <span>{formatCurrency(summary.discountTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comandas canceladas</span>
                  <span>
                    {summary.cancelledOrderCount} · {formatCurrency(summary.cancelledTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sangrias</span>
                  <span>{formatCurrency(summary.cash.sangrias)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suprimentos</span>
                  <span>{formatCurrency(summary.cash.suprimentos)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Aberto por</span>
                  <span>{detail.openedByName ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fechado por</span>
                  <span>{detail.closedByName ?? "—"}</span>
                </div>
              </div>
            </div>

            <PrintArea id={`cash-session-print-${detail.id}`}>
              <div
                style={{ maxWidth: 420, margin: "0 auto", fontSize: 13, fontFamily: "monospace" }}
              >
                <h2 style={{ textAlign: "center", marginBottom: 4 }}>
                  Conferência de Caixa #{detail.sessionNumber}
                </h2>
                <p style={{ textAlign: "center", marginBottom: 16 }}>
                  {formatDateTime(detail.openedAt)} a {formatDateTime(detail.closedAt)}
                </p>
                <hr />
                <div style={{ marginTop: 8 }}>
                  {[
                    ["Fundo de troco", summary.cash.openingFloat],
                    ["Recebido em dinheiro", summary.cash.cashPayments],
                    ["Suprimentos", summary.cash.suprimentos],
                    ["Sangrias", `-${summary.cash.sangrias}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: "bold",
                      marginTop: 6,
                    }}
                  >
                    <span>Esperado</span>
                    <span>{formatCurrency(detail.expectedCash ?? 0)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Contado</span>
                    <span>{formatCurrency(detail.countedCash ?? 0)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: "bold",
                    }}
                  >
                    <span>Diferença</span>
                    <span>{formatCurrency(difference)}</span>
                  </div>
                </div>
                {detail.notes && (
                  <p style={{ marginTop: 8, fontSize: 11 }}>Justificativa: {detail.notes}</p>
                )}
                <hr style={{ marginTop: 8 }} />
                <p style={{ fontWeight: "bold", marginTop: 8 }}>Por forma de pagamento</p>
                {summary.byPaymentMethod.map((p) => (
                  <div key={p.method} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                    <span>{formatCurrency(p.total)}</span>
                  </div>
                ))}
                <hr style={{ marginTop: 8 }} />
                <p style={{ fontWeight: "bold", marginTop: 8 }}>Por garçom</p>
                {summary.byWaiter.map((w) => (
                  <div key={w.waiterId} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {w.waiterName} ({w.orderCount})
                    </span>
                    <span>{formatCurrency(w.total)}</span>
                  </div>
                ))}
                <p style={{ marginTop: 16, fontSize: 11 }}>
                  Aberto por {detail.openedByName ?? "—"} · Fechado por{" "}
                  {detail.closedByName ?? "—"}
                </p>
              </div>
            </PrintArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
