import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, ExternalLink, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  total: string;
  validUntil: string | null;
  createdAt: string;
}

interface ClientQuotesTabProps {
  clientId: string;
  clientName: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  accepted: "Aceito",
  rejected: "Recusado",
  converted: "Convertido",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  converted: "default",
  cancelled: "outline",
};

function statusVariant(status: string) {
  return STATUS_COLORS[status] ?? "secondary";
}

function statusClass(status: string): string {
  switch (status) {
    case "accepted":
    case "converted":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30";
    case "sent":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border-blue-200 dark:border-blue-500/30";
    case "draft":
      return "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300 border-slate-200 dark:border-slate-500/30";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300 border-red-200 dark:border-red-500/30";
    default:
      return "";
  }
}

function formatCurrency(value: string | null | undefined): string {
  const n = parseFloat(value ?? "0");
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function ClientQuotesTab({ clientId, clientName }: ClientQuotesTabProps) {
  const [, navigate] = useLocation();

  const { data: quotes, isLoading, isError } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", { clientId }],
    queryFn: () =>
      apiRequest("GET", `/api/quotes?clientId=${encodeURIComponent(clientId)}`).then(
        (r) => r.json()
      ),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm">Erro ao carregar orçamentos. Tente novamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {quotes && quotes.length > 0
            ? `${quotes.length} orçamento${quotes.length !== 1 ? "s" : ""} encontrado${quotes.length !== 1 ? "s" : ""}`
            : "Nenhum orçamento ainda"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() =>
            navigate(
              `/orcamentos/novo?clientId=${encodeURIComponent(clientId)}&clientName=${encodeURIComponent(clientName)}`
            )
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Novo orçamento
        </Button>
      </div>

      {/* Empty state */}
      {(!quotes || quotes.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-14 dark:border-slate-700/50 dark:bg-slate-800/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <FileText className="h-5 w-5 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhum orçamento enviado
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie um orçamento para este cliente usando o botão acima.
            </p>
          </div>
        </div>
      )}

      {/* Quote list */}
      {quotes && quotes.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-900/40">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="flex items-center justify-between gap-4 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
            >
              {/* Left: number + dates */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {quote.quoteNumber}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${statusClass(quote.status)}`}
                  >
                    {STATUS_LABELS[quote.status] ?? quote.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>Criado em {formatDate(quote.createdAt)}</span>
                  {quote.validUntil && (
                    <span>Válido até {formatDate(quote.validUntil)}</span>
                  )}
                </div>
              </div>

              {/* Right: total + link */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatCurrency(quote.total)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  title="Abrir orçamento"
                  onClick={() => navigate(`/orcamentos/${quote.id}`)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
