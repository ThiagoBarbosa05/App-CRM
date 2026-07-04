import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CalendarClock,
  Clock,
  Package,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

interface ClientPurchaseInsightsProps {
  data: ClientPurchaseInsightsResponse;
}

function formatDateLabel(date: string | null): string {
  if (!date) return "Sem base";
  try {
    return format(parseISO(`${date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

function getStatusLabel(
  status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"],
) {
  switch (status) {
    case "dentro_do_ciclo":
      return "No ciclo";
    case "atencao":
      return "Atenção";
    case "reativacao":
      return "Reativação";
    case "risco_de_queda":
      return "Risco de queda";
    case "primeira_compra":
      return "Primeira compra";
    default:
      return "Sem base";
  }
}

function getStatusConfig(
  status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"],
) {
  switch (status) {
    case "dentro_do_ciclo":
      return {
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        accent: "bg-gradient-to-b from-emerald-300 to-emerald-500",
        cardBorder: "border-emerald-200/60 dark:border-emerald-800/30",
        progressColor: "bg-emerald-400",
        progressLabel: "text-emerald-600 dark:text-emerald-400",
      };
    case "atencao":
      return {
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        accent: "bg-gradient-to-b from-amber-300 to-amber-500",
        cardBorder: "border-amber-200/60 dark:border-amber-800/30",
        progressColor: "bg-amber-400",
        progressLabel: "text-amber-600 dark:text-amber-400",
      };
    case "reativacao":
    case "risco_de_queda":
      return {
        badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
        accent: "bg-gradient-to-b from-rose-300 to-rose-500",
        cardBorder: "border-rose-200/60 dark:border-rose-800/30",
        progressColor: "bg-rose-400",
        progressLabel: "text-rose-600 dark:text-rose-400",
      };
    case "primeira_compra":
      return {
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        accent: "bg-gradient-to-b from-blue-300 to-blue-500",
        cardBorder: "border-blue-200/60 dark:border-blue-800/30",
        progressColor: "bg-blue-400",
        progressLabel: "text-blue-600 dark:text-blue-400",
      };
    default:
      return {
        badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        accent: "bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
        cardBorder: "border-slate-200/80 dark:border-slate-800/80",
        progressColor: "bg-slate-300 dark:bg-slate-600",
        progressLabel: "text-slate-500 dark:text-slate-400",
      };
  }
}

function getPriorityCopy(data: ClientPurchaseInsightsResponse) {
  const { predictiveAnalysis, inactiveProducts } = data;

  if (inactiveProducts.length > 0) {
    const topRisk = inactiveProducts[0];
    return {
      eyebrow: "Ação sugerida",
      title: `Retomar ${topRisk.description}`,
      description:
        topRisk.riskStatus === "abandonado"
          ? "O cliente saiu completamente do ciclo deste item. Vale abordagem de reativação com foco em reposição."
          : "Existe sinal de desaceleração nesse item. Vale contato preventivo antes da quebra do hábito.",
    };
  }

  if (predictiveAnalysis.status === "primeira_compra") {
    return {
      eyebrow: "Novo cliente",
      title: "Aguardando recompra",
      description:
        "Cliente com apenas uma compra registrada. Ainda não há ciclo de recompra estabelecido. Acompanhe para identificar quando o padrão se forma.",
    };
  }

  if (predictiveAnalysis.status === "dentro_do_ciclo") {
    return {
      eyebrow: "Momento do cliente",
      title: "Cliente em momento favorável",
      description:
        "O histórico indica regularidade. Use o próximo contato para ampliar mix ou aumentar valor médio.",
    };
  }

  return {
    eyebrow: "Ação sugerida",
    title: "Abrir contato consultivo",
    description:
      "O cliente está saindo do ritmo habitual. Vale reabrir conversa com contexto da última compra e janela prevista.",
  };
}

function getRiskLabel(riskStatus: "ok" | "atencao" | "abandonado") {
  if (riskStatus === "abandonado") return "Abandonado";
  if (riskStatus === "atencao") return "Atenção";
  return "Ok";
}

export function ClientPurchaseInsights({ data }: ClientPurchaseInsightsProps) {
  const [, navigate] = useLocation();
  const { predictiveAnalysis, summary, inactiveProducts } = data;
  const riskCount = inactiveProducts.length;
  const priorityCopy = getPriorityCopy(data);
  const statusConfig = getStatusConfig(predictiveAnalysis.status);

  const cycleProgress = predictiveAnalysis.cycleProgress;
  const cappedProgress = cycleProgress !== null ? Math.min(cycleProgress, 100) : null;
  const isLate = (cycleProgress ?? 0) > 100;

  return (
    <div className="space-y-6">
      {/* Main predictive card */}
      <Card
        className={`relative overflow-hidden rounded-[24px] bg-white shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)] dark:bg-slate-900 ${statusConfig.cardBorder}`}
      >
        <div className={`absolute bottom-0 left-0 top-0 w-[3px] ${statusConfig.accent}`} />
        <CardContent className="space-y-6 p-6 pl-7">

          {/* Header row: status + priority copy */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={`border-0 text-xs font-semibold ${statusConfig.badge}`}>
                  {getStatusLabel(predictiveAnalysis.status)}
                </Badge>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {priorityCopy.eyebrow}
                </span>
              </div>
              <h3 className="max-w-xl text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {priorityCopy.title}
              </h3>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {priorityCopy.description}
              </p>
            </div>

            {/* Immediate reading sidebar */}
            <div className="min-w-[260px] rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                <ShieldAlert className="h-4 w-4" />
                Leitura imediata
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {predictiveAnalysis.explanation}
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
                    Valor da última compra
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {summary.lastPurchaseValue === null
                      ? "Sem base"
                      : formatCurrency(summary.lastPurchaseValue)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-50" />
              </div>
            </div>
          </div>

          {/* Cycle progress bar */}
          {cycleProgress !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-500 dark:text-slate-400">Progresso do ciclo</span>
                <span className={cn("font-bold", statusConfig.progressLabel)}>
                  {isLate
                    ? `${cycleProgress}% — ${predictiveAnalysis.daysLate} dia(s) de atraso`
                    : `${cycleProgress}% de ${summary.averageDaysBetweenPurchases} dias`}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn("h-full rounded-full transition-all", statusConfig.progressColor)}
                  style={{ width: `${cappedProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Última compra</span>
                <span>{isLate ? "Prazo esperado ultrapassado" : "Próxima janela"}</span>
              </div>
            </div>
          )}

          {/* Key metrics grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricChip
              icon={CalendarClock}
              label="Próxima janela"
              value={formatDateLabel(predictiveAnalysis.predictedNextPurchaseDate)}
            />
            <MetricChip
              icon={Clock}
              label="Sem comprar"
              value={
                predictiveAnalysis.daysSinceLastPurchase === null
                  ? "Sem base"
                  : `${predictiveAnalysis.daysSinceLastPurchase} dias`
              }
            />
            {predictiveAnalysis.daysLate !== null && predictiveAnalysis.daysLate > 0 && (
              <MetricChip
                icon={BellRing}
                label="Atraso no ciclo"
                value={`${predictiveAnalysis.daysLate} dias`}
                highlight
              />
            )}
            <MetricChip
              icon={TrendingUp}
              label="Última compra"
              value={formatDateLabel(summary.lastPurchaseDate)}
            />
          </div>

        </CardContent>
      </Card>

      {/* Products at risk */}
      <Card className="rounded-[24px] border-slate-200/80 bg-white shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Produtos em risco
            </CardTitle>
            {riskCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                {riskCount}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {riskCount === 0 ? (
            <Alert className="border-emerald-200/60 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
              <AlertCircle className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="font-semibold">Nenhum risco relevante</AlertTitle>
              <AlertDescription className="text-emerald-700/80 dark:text-emerald-300/80">
                O cliente não tem produtos recorrentes fora do ciclo no momento.
              </AlertDescription>
            </Alert>
          ) : (
            inactiveProducts.map((product, index) => {
              const isAbandoned = product.riskStatus === "abandonado";
              return (
                <div
                  key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                  onClick={() => product.productId && navigate(`/products/${product.productId}`)}
                  className={cn(
                    "relative overflow-hidden rounded-[20px] border bg-white px-4 py-4 dark:bg-slate-950/60 transition-colors",
                    product.productId && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    isAbandoned
                      ? "border-rose-200/60 dark:border-rose-800/30"
                      : "border-amber-200/60 dark:border-amber-800/30",
                  )}
                >
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 top-0 w-[3px]",
                      isAbandoned
                        ? "bg-gradient-to-b from-rose-300 to-rose-500"
                        : "bg-gradient-to-b from-amber-300 to-amber-500",
                    )}
                  />
                  <div className="pl-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          Prioridade {index + 1}
                          {product.productCode && (
                            <span className="ml-2 normal-case text-slate-300 dark:text-slate-600">
                              · Cód. {product.productCode}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                          {product.description}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0 border-0 text-[10px] font-semibold uppercase",
                          isAbandoned
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                        )}
                      >
                        {getRiskLabel(product.riskStatus)}
                      </Badge>
                    </div>

                    {/* Metrics row */}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {product.daysSinceLastPurchase !== null
                          ? `${product.daysSinceLastPurchase} dias sem comprar`
                          : "Sem base de recência"}
                      </span>
                      {product.averageDaysBetweenPurchases !== null && (
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 shrink-0" />
                          {`Ciclo médio: ${product.averageDaysBetweenPurchases} dias`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3 shrink-0" />
                        {`${product.orderCount} pedido(s)`}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Última compra em{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {formatDateLabel(product.lastPurchaseDate)}
                        </span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Impacto acumulado:{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatCurrency(product.totalValue)}
                        </span>
                      </span>
                    </div>
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

function MetricChip({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof AlertCircle;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border p-3.5",
        highlight
          ? "border-rose-200/80 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/20"
          : "border-slate-200/80 bg-slate-50/60 dark:border-slate-800/80 dark:bg-slate-800/40",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg shadow-sm ring-1",
            highlight
              ? "bg-rose-50 ring-rose-200/80 dark:bg-rose-900/30 dark:ring-rose-800/50"
              : "bg-white ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-700/80",
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              highlight ? "text-rose-500" : "text-amber-500",
            )}
          />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-2.5 text-base font-bold tabular-nums",
          highlight
            ? "text-rose-700 dark:text-rose-300"
            : "text-slate-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
