import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShoppingBag } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { Client } from "@shared/schema";
import {
  useClientPurchaseInsights,
  type ClientPurchaseHistorySource,
} from "@/hooks/use-client-purchase-insights";
import { ClientPurchaseSummary } from "@/components/clients/client-purchase-summary";
import { ClientPurchaseInsights } from "@/components/clients/client-purchase-insights";
import { ClientPurchaseHistory } from "@/components/clients/client-purchase-history";
import { ClientProductMix } from "@/components/clients/client-product-mix";

interface ClientPurchasesTabProps {
  client: Client;
}

const HISTORY_PAGE_SIZE = 10;

export function ClientPurchasesTab({ client }: ClientPurchasesTabProps) {
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historySource, setHistorySource] =
    useState<ClientPurchaseHistorySource>("all");

  useEffect(() => {
    setHistoryOffset(0);
  }, [client.id]);

  useEffect(() => {
    setHistoryOffset(0);
  }, [historySource]);

  const { data, isLoading, isError, error } = useClientPurchaseInsights(client.id, {
    historyLimit: HISTORY_PAGE_SIZE,
    historyOffset,
    historySource,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
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
          Este cliente ainda nao possui compras associadas por vinculo confiavel no CRM. A aba permanece visivel para orientar o usuario, mas sem inferencias por nome, CPF ou telefone.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {data.linkStatus === "partial" && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <Loader2 className="h-4 w-4" />
          <AlertTitle>Historico parcial</AlertTitle>
          <AlertDescription>
            O cliente possui compras vinculadas, mas ainda nao ha base suficiente para todas as previsoes de recompra.
          </AlertDescription>
        </Alert>
      )}

      <ClientPurchaseInsights data={data} />
      <ClientPurchaseSummary summary={data.summary} />
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr] xl:items-start">
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
              setHistoryOffset((currentOffset) => currentOffset + HISTORY_PAGE_SIZE);
            }
          }}
        />
        <ClientProductMix
          productMix={data.productMix}
          inactiveProducts={data.inactiveProducts}
        />
      </div>
    </div>
  );
}
