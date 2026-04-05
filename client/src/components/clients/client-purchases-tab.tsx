import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  History,
  Loader2,
  MessageSquare,
  ShoppingBag,
  Star,
  Target,
  TrendingDown,
} from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Client } from "@shared/schema";
import {
  useClientPurchaseInsights,
  type ClientPurchaseHistorySource,
} from "@/hooks/use-client-purchase-insights";
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
}> = [
  { value: "visao-geral", label: "Visao Geral", icon: BarChart3 },
  { value: "top-produtos", label: "Top Produtos", icon: Star },
  { value: "historico", label: "Historico", icon: History },
  { value: "parou-de-comprar", label: "Parou de Comprar", icon: TrendingDown },
  { value: "analise-preditiva", label: "Analise Preditiva", icon: Target },
];

export function ClientPurchasesTab({ client }: ClientPurchasesTabProps) {
  const [, navigate] = useLocation();
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historySource, setHistorySource] =
    useState<ClientPurchaseHistorySource>("all");
  const [activeSubTab, setActiveSubTab] =
    useState<PurchaseSubTab>("visao-geral");

  useEffect(() => {
    setHistoryOffset(0);
  }, [client.id]);

  useEffect(() => {
    setHistoryOffset(0);
  }, [historySource]);

  const { data, isLoading, isError, error } = useClientPurchaseInsights(
    client.id,
    {
      historyLimit: HISTORY_PAGE_SIZE,
      historyOffset,
      historySource,
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
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
      <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
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

  const buildInteractionDraft = () => {
    const params = new URLSearchParams();
    const topRisk = data.inactiveProducts[0];
    const status = data.predictiveAnalysis.status;

    let subject = "Follow-up consultivo de recompra";
    let description = data.predictiveAnalysis.explanation;
    let interactionType:
      | "telemarketing"
      | "email"
      | "meeting"
      | "whatsapp"
      | "visit"
      | "note"
      | "other" = "note";
    const interactionStatus: "scheduled" | "completed" | "cancelled" =
      "scheduled";

    if (topRisk) {
      subject = `Retomar compra de ${topRisk.description}`;
      description = `${data.predictiveAnalysis.explanation}\n\nProduto em foco: ${topRisk.description}. Ultima compra em ${topRisk.lastPurchaseDate ?? "data indisponivel"}. Impacto acumulado de ${topRisk.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`;
      interactionType = "whatsapp";
    } else if (status === "dentro_do_ciclo") {
      subject = "Oferta de expansao de mix";
      description = `${data.predictiveAnalysis.explanation}\n\nCliente em momento favoravel para ampliar mix ou aumentar ticket medio.`;
      interactionType = "meeting";
    } else if (
      status === "atencao" ||
      status === "reativacao" ||
      status === "risco_de_queda"
    ) {
      interactionType = "telemarketing";
    }

    params.set("tab", "interactions");
    params.set("interactionSource", "purchase-insights");
    params.set("interactionType", interactionType);
    params.set("interactionStatus", interactionStatus);
    params.set("interactionSubject", subject);
    params.set("interactionDescription", description);

    return params.toString();
  };

  const handleRegisterTask = () => {
    navigate(`/clientes/${client.id}?${buildInteractionDraft()}`);
  };

  const handleViewInteractions = () => {
    navigate(`/clientes/${client.id}?tab=interactions`);
  };

  return (
    <div className="space-y-6">
      {data.linkStatus === "partial" && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <Loader2 className="h-4 w-4" />
          <AlertTitle>Historico parcial</AlertTitle>
          <AlertDescription>
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
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
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
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <tab.icon className="h-4 w-4" />
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
          historySource={historySource}
          onHistorySourceChange={setHistorySource}
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
        <ClientPurchaseInsights
          data={data}
          onRegisterTask={handleRegisterTask}
          onViewInteractions={handleViewInteractions}
        />
      )}
    </div>
  );
}
