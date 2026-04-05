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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ClientPurchaseInsightsProps {
  data: ClientPurchaseInsightsResponse;
}

function formatDateLabel(date: string | null) {
  if (!date) return "Sem base";
  try {
    return format(parseISO(`${date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

function getStatusVariant(status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"]) {
  switch (status) {
    case "dentro_do_ciclo":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "atencao":
      return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "reativacao":
    case "risco_de_queda":
      return "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
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
      tone: "risk" as const,
    };
  }

  if (predictiveAnalysis.status === "dentro_do_ciclo") {
    return {
      eyebrow: "Momento do cliente",
      title: "Cliente quente para expansao",
      description:
        "O historico indica regularidade. Use o proximo contato para ampliar mix ou aumentar valor medio.",
      tone: "growth" as const,
    };
  }

  return {
    eyebrow: "Acao sugerida",
    title: "Abrir contato consultivo",
    description:
      "O cliente esta saindo do ritmo habitual. Vale reabrir conversa com contexto da ultima compra e janela prevista.",
    tone: "attention" as const,
  };
}

function getHeroTone(tone: "risk" | "growth" | "attention") {
  if (tone === "risk") {
    return "from-rose-500/15 via-orange-500/10 to-transparent dark:from-rose-500/20 dark:via-orange-500/10";
  }
  if (tone === "growth") {
    return "from-emerald-500/15 via-cyan-500/10 to-transparent dark:from-emerald-500/20 dark:via-cyan-500/10";
  }
  return "from-amber-500/15 via-yellow-500/10 to-transparent dark:from-amber-500/20 dark:via-yellow-500/10";
}

export function ClientPurchaseInsights({ data }: ClientPurchaseInsightsProps) {
  const riskCount = data.inactiveProducts.length;
  const priorityCopy = getPriorityCopy(data);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.65fr_0.95fr]">
      <Card className="relative overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${getHeroTone(priorityCopy.tone)}`}
        />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-white/40 blur-3xl dark:bg-white/5" />
        <CardContent className="relative space-y-6 p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={getStatusVariant(data.predictiveAnalysis.status)}>
                  {data.predictiveAnalysis.status.replaceAll("_", " ")}
                </Badge>
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {priorityCopy.eyebrow}
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="max-w-xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  {priorityCopy.title}
                </h3>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
                  {priorityCopy.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/60">
                  <CalendarClock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Proxima janela: {formatDateLabel(data.predictiveAnalysis.predictedNextPurchaseDate)}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/60">
                  <BellRing className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  {data.predictiveAnalysis.daysSinceLastPurchase === null
                    ? "Sem base de recencia"
                    : `${data.predictiveAnalysis.daysSinceLastPurchase} dias sem comprar`}
                </div>
              </div>
            </div>

            <div className="min-w-[280px] rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                <ShieldAlert className="h-4 w-4" />
                Leitura imediata
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {data.predictiveAnalysis.explanation}
              </p>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-950">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                    Valor da ultima compra
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {data.summary.lastPurchaseValue === null
                      ? "Sem base"
                      : formatCurrency(data.summary.lastPurchaseValue)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-60" />
              </div>
            </div>
          </div>

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

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black text-slate-950 dark:text-white">
            Produtos em risco
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {riskCount === 0 ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhum risco relevante</AlertTitle>
              <AlertDescription>
                O cliente nao tem produtos recorrentes fora do ciclo no momento.
              </AlertDescription>
            </Alert>
          ) : (
            data.inactiveProducts.slice(0, 4).map((product, index) => (
              <div
                key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Prioridade {index + 1}
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {product.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Ultima compra em {formatDateLabel(product.lastPurchaseDate)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Impacto acumulado de {formatCurrency(product.totalValue)} em {product.orderCount} pedido(s)
                    </p>
                  </div>
                  <Badge className={getStatusVariant(product.riskStatus === "abandonado" ? "risco_de_queda" : "atencao")}>
                    {product.riskStatus}
                  </Badge>
                </div>
              </div>
            ))
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
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-black uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 text-base font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
