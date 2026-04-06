import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  History,
  ShoppingBag,
  Star,
  Target,
  TrendingDown,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Client } from "@shared/schema";
import { useClientPurchaseInsights } from "@/hooks/use-client-purchase-insights";
import { ClientPurchaseSummary } from "@/components/clients/client-purchase-summary";
import { ClientPurchaseInsights } from "@/components/clients/client-purchase-insights";
import { ClientPurchaseHistory } from "@/components/clients/client-purchase-history";
import {
  ClientProductMixTable,
  ClientInactiveProducts,
} from "@/components/clients/client-product-mix";
import { ClientPurchaseOverview } from "@/components/clients/client-purchase-overview";

interface ClientPurchasesTabProps {
  client: Client;
}

const HISTORY_PAGE_SIZE = 10;

type PurchaseSubTab =
  | "visao-geral"
  | "top-produtos"
  | "historico"
  | "parou-de-comprar"
  | "analise-preditiva";

const subTabs: Array<{
  value: PurchaseSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  {
    value: "visao-geral",
    label: "Visao Geral",
    icon: BarChart3,
    tone: "data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-500/15 dark:data-[state=active]:text-amber-300",
  },
  {
    value: "top-produtos",
    label: "Top Produtos",
    icon: Star,
    tone: "data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-500/15 dark:data-[state=active]:text-blue-300",
  },
  {
    value: "historico",
    label: "Historico",
    icon: History,
    tone: "data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-500/15 dark:data-[state=active]:text-violet-300",
  },
  {
    value: "parou-de-comprar",
    label: "Parou de Comprar",
    icon: TrendingDown,
    tone: "data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 dark:data-[state=active]:bg-rose-500/15 dark:data-[state=active]:text-rose-300",
  },
  {
    value: "analise-preditiva",
    label: "Analise Preditiva",
    icon: Target,
    tone: "data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-500/15 dark:data-[state=active]:text-emerald-300",
  },
];

export function ClientPurchasesTab({ client }: ClientPurchasesTabProps) {
  const [historyOffset, setHistoryOffset] = useState(0);
  const [activeSubTab, setActiveSubTab] =
    useState<PurchaseSubTab>("visao-geral");

  useEffect(() => {
    setHistoryOffset(0);
  }, [client.id]);

  const { data, isLoading, isError, error } = useClientPurchaseInsights(
    client.id,
    {
      historyLimit: HISTORY_PAGE_SIZE,
      historyOffset,
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[128px] w-full rounded-[28px]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-[20px]" />
        <Skeleton className="h-72 w-full rounded-[24px]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="rounded-[24px] border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-900/40 dark:bg-rose-950/20">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar compras</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : "Nao foi possivel buscar o historico de compras deste cliente."}
        </AlertDescription>
      </Alert>
    );
  }

  if (data.linkStatus === "unlinked") {
    return (
      <Alert className="rounded-[24px] border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
        <ShoppingBag className="h-4 w-4" />
        <AlertTitle>Cliente sem historico vinculado</AlertTitle>
        <AlertDescription>
          Este cliente ainda nao possui compras associadas por vinculo confiavel
          no CRM. A aba permanece visivel para orientar o usuario, mas sem
          inferencias por nome, CPF ou telefone.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
        <div className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_28%),linear-gradient(135deg,#fffaf1_0%,#ffffff_46%,#fff7ed_100%)] px-6 py-6 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.2),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.92)_60%,rgba(55,37,14,0.95)_100%)]">
          <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-500/20" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/70 bg-white/80 shadow-[0_18px_40px_-26px_rgba(245,158,11,0.45)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/75">
                <ShoppingBag className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 shadow-sm dark:border-amber-800/70 dark:bg-amber-500/10 dark:text-amber-300">
                    Inteligencia de Compras
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {client.name}
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Historico, mix e previsao
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  Visual unificado para acompanhar recorrencia, comportamento de compra, produtos em risco e proximas oportunidades de abordagem.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-amber-700 shadow-sm dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-300">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
                  Pedidos
                </p>
                <p className="mt-1 text-sm font-black">
                  {data.summary.purchaseCount}
                </p>
              </div>
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-emerald-700 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-500/10 dark:text-emerald-300">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
                  Status
                </p>
                <p className="mt-1 text-sm font-black capitalize">
                  {data.predictiveAnalysis.status.replaceAll("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {data.linkStatus === "partial" && (
        <Alert className="rounded-[24px] border-amber-200/60 bg-amber-50/80 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="font-semibold">Historico parcial</AlertTitle>
          <AlertDescription className="text-amber-800/80 dark:text-amber-200/70">
            O cliente possui compras vinculadas, mas ainda nao ha base
            suficiente para todas as previsoes de recompra.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Summary Cards */}
      <ClientPurchaseSummary
        summary={data.summary}
        daysSinceLastPurchase={data.predictiveAnalysis.daysSinceLastPurchase}
      />

      {/* Sub-tab Navigation */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 rounded-[20px] border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          {subTabs.map((tab) => {
            const isActive = activeSubTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveSubTab(tab.value);
                }}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? cn("shadow-sm", tab.tone)
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <tab.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "" : "text-slate-400",
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content */}
      {activeSubTab === "visao-geral" && <ClientPurchaseOverview data={data} />}

      {activeSubTab === "top-produtos" && (
        <ClientProductMixTable productMix={data.productMix} />
      )}

      {activeSubTab === "historico" && (
        <ClientPurchaseHistory
          history={data.purchaseHistory}
          onPreviousPage={() =>
            setHistoryOffset((currentOffset) =>
              Math.max(0, currentOffset - HISTORY_PAGE_SIZE),
            )
          }
          onNextPage={() => {
            if (data.purchaseHistory.hasMore) {
              setHistoryOffset(
                (currentOffset) => currentOffset + HISTORY_PAGE_SIZE,
              );
            }
          }}
        />
      )}

      {activeSubTab === "parou-de-comprar" && (
        <ClientInactiveProducts inactiveProducts={data.inactiveProducts} />
      )}

      {activeSubTab === "analise-preditiva" && (
        <ClientPurchaseInsights data={data} />
      )}
    </div>
  );
}
