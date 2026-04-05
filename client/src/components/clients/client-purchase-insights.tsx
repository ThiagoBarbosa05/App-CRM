import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CalendarClock,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ClientPurchaseInsightsProps {
  data: ClientPurchaseInsightsResponse;
  onRegisterTask: () => void;
  onViewInteractions: () => void;
}

function formatDateLabel(date: string | null): string {
  if (!date) return "Sem base";
  try {
    return format(parseISO(`${date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

function getStatusConfig(
  status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"],
) {
  switch (status) {
    case "dentro_do_ciclo":
      return {
        badge:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        accent: "bg-gradient-to-b from-emerald-300 to-emerald-500",
        cardBorder: "border-emerald-200/60 dark:border-emerald-800/30",
      };
    case "atencao":
      return {
        badge:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        accent: "bg-gradient-to-b from-amber-300 to-amber-500",
        cardBorder: "border-amber-200/60 dark:border-amber-800/30",
      };
    case "reativacao":
    case "risco_de_queda":
      return {
        badge:
          "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
        accent: "bg-gradient-to-b from-rose-300 to-rose-500",
        cardBorder: "border-rose-200/60 dark:border-rose-800/30",
      };
    default:
      return {
        badge:
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        accent:
          "bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
        cardBorder: "border-slate-200/80 dark:border-slate-800/80",
      };
  }
}

function getPriorityCopy(data: ClientPurchaseInsightsResponse) {
  const { predictiveAnalysis, inactiveProducts } = data;

  if (inactiveProducts.length > 0) {
    const topRisk = inactiveProducts[0];
    return {
      eyebrow: "Acao sugerida",
      title: `Retomar ${topRisk.description}`,
      description:
        topRisk.riskStatus === "abandonado"
          ? "O cliente saiu completamente do ciclo deste item. Vale abordagem de reativacao com foco em reposicao."
          : "Existe sinal de desaceleracao nesse item. Vale contato preventivo antes da quebra do habito.",
    };
  }

  if (predictiveAnalysis.status === "dentro_do_ciclo") {
    return {
      eyebrow: "Momento do cliente",
      title: "Cliente quente para expansao",
      description:
        "O historico indica regularidade. Use o proximo contato para ampliar mix ou aumentar valor medio.",
    };
  }

  return {
    eyebrow: "Acao sugerida",
    title: "Abrir contato consultivo",
    description:
      "O cliente esta saindo do ritmo habitual. Vale reabrir conversa com contexto da ultima compra e janela prevista.",
  };
}

export function ClientPurchaseInsights({
  data,
  onRegisterTask,
  onViewInteractions,
}: ClientPurchaseInsightsProps) {
  const riskCount = data.inactiveProducts.length;
  const priorityCopy = getPriorityCopy(data);
  const statusConfig = getStatusConfig(data.predictiveAnalysis.status);

  return (
    <div className="space-y-6">
      {/* Main predictive card */}
      <Card
        className={`relative overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 ${statusConfig.cardBorder}`}
      >
        <div
          className={`absolute bottom-0 left-0 top-0 w-[3px] ${statusConfig.accent}`}
        />
        <CardContent className="space-y-5 p-6 pl-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  className={`border-0 text-xs font-semibold ${statusConfig.badge}`}
                >
                  {data.predictiveAnalysis.status.replaceAll("_", " ")}
                </Badge>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {priorityCopy.eyebrow}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="max-w-xl text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  {priorityCopy.title}
                </h3>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {priorityCopy.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1.5 dark:border-slate-700/80 dark:bg-slate-800">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium">
                    Proxima janela:{" "}
                    {formatDateLabel(
                      data.predictiveAnalysis.predictedNextPurchaseDate,
                    )}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1.5 dark:border-slate-700/80 dark:bg-slate-800">
                  <BellRing className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium">
                    {data.predictiveAnalysis.daysSinceLastPurchase === null
                      ? "Sem base de recencia"
                      : `${data.predictiveAnalysis.daysSinceLastPurchase} dias sem comprar`}
                  </span>
                </div>
              </div>
            </div>

            {/* Immediate reading sidebar */}
            <div className="min-w-[260px] rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                <ShieldAlert className="h-4 w-4" />
                Leitura imediata
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {data.predictiveAnalysis.explanation}
              </p>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
                    Valor da ultima compra
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {data.summary.lastPurchaseValue === null
                      ? "Sem base"
                      : formatCurrency(data.summary.lastPurchaseValue)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-50" />
              </div>
            </div>
          </div>

          {/* Insight pills */}
          <div className="grid gap-3 md:grid-cols-3">
            <InsightPill
              icon={TrendingUp}
              label="Ultima compra"
              value={formatDateLabel(data.summary.lastPurchaseDate)}
            />
            <InsightPill
              icon={AlertCircle}
              label="Dias desde a ultima compra"
              value={
                data.predictiveAnalysis.daysSinceLastPurchase === null
                  ? "Sem base"
                  : `${data.predictiveAnalysis.daysSinceLastPurchase} dias`
              }
            />
            <InsightPill
              icon={TrendingDown}
              label="Valor da ultima compra"
              value={
                data.summary.lastPurchaseValue === null
                  ? "Sem base"
                  : formatCurrency(data.summary.lastPurchaseValue)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Products at risk */}
      <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Produtos em risco
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {riskCount === 0 ? (
            <Alert className="border-emerald-200/60 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
              <AlertCircle className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="font-semibold">
                Nenhum risco relevante
              </AlertTitle>
              <AlertDescription className="text-emerald-700/80 dark:text-emerald-300/80">
                O cliente nao tem produtos recorrentes fora do ciclo no momento.
              </AlertDescription>
            </Alert>
          ) : (
            data.inactiveProducts.slice(0, 4).map((product, index) => {
              const isAbandoned = product.riskStatus === "abandonado";
              return (
                <div
                  key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                  className={`relative overflow-hidden rounded-xl border bg-white px-4 py-4 dark:bg-slate-950/60 ${
                    isAbandoned
                      ? "border-rose-200/60 dark:border-rose-800/30"
                      : "border-amber-200/60 dark:border-amber-800/30"
                  }`}
                >
                  <div
                    className={`absolute bottom-0 left-0 top-0 w-[3px] ${
                      isAbandoned
                        ? "bg-gradient-to-b from-rose-300 to-rose-500"
                        : "bg-gradient-to-b from-amber-300 to-amber-500"
                    }`}
                  />
                  <div className="flex items-start justify-between gap-3 pl-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Prioridade {index + 1}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {product.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Ultima compra em{" "}
                        {formatDateLabel(product.lastPurchaseDate)}
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        Impacto acumulado de{" "}
                        <span className="font-bold">
                          {formatCurrency(product.totalValue)}
                        </span>{" "}
                        em {product.orderCount} pedido(s)
                      </p>
                    </div>
                    <Badge
                      className={`border-0 text-[10px] font-semibold uppercase ${
                        isAbandoned
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {product.riskStatus}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InsightPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof AlertCircle;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-800/40">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-700/80">
          <Icon className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
      </div>
      <p className="mt-2.5 text-base font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
