import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sparkles,
  Clock,
  PackageX,
  Cake,
  Crown,
  Phone,
  CalendarClock,
  Check,
  X,
  Loader2,
  BellOff,
  Copy,
  Pencil,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type CopilotoSignalType =
  | "ciclo_vencido"
  | "produto_abandonado"
  | "aniversario"
  | "campeao_silencioso";

interface CopilotoCard {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  rfmSegment: string | null;
  type: CopilotoSignalType;
  score: number;
  estimatedValue: number;
  reason: string;
  payload: Record<string, unknown>;
  suggestedMessage: string | null;
  whatsappOptOut: boolean;
  generatedAt: string;
}

interface CopilotoFeed {
  cards: CopilotoCard[];
  totalPotential: number;
  countsByType: Record<string, number>;
  lastScanAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNAL_META: Record<
  CopilotoSignalType,
  { label: string; icon: typeof Clock; accent: string; group: "urgente" | "oportunidade" }
> = {
  ciclo_vencido: {
    label: "Ciclo vencido",
    icon: Clock,
    accent: "text-red-600 dark:text-red-400",
    group: "urgente",
  },
  produto_abandonado: {
    label: "Produto abandonado",
    icon: PackageX,
    accent: "text-orange-600 dark:text-orange-400",
    group: "urgente",
  },
  campeao_silencioso: {
    label: "Campeão em silêncio",
    icon: Crown,
    accent: "text-amber-600 dark:text-amber-400",
    group: "urgente",
  },
  aniversario: {
    label: "Aniversário",
    icon: Cake,
    accent: "text-violet-600 dark:text-violet-400",
    group: "oportunidade",
  },
};

// Espelha RFM_SEGMENT_LABELS/COLORS de server/services/rfm.service.ts, que não é
// importável do client (o serviço puxa a conexão do banco).
const RFM_LABELS: Record<string, string> = {
  campiao: "Campeão",
  fiel: "Fiel",
  promissor: "Promissor",
  em_risco: "Em Risco",
  perdido: "Perdido",
  novo: "Novo",
  hibernando: "Hibernando",
  sem_compra: "Sem Compra",
};

const RFM_COLORS: Record<string, string> = {
  campiao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  fiel: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  promissor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  em_risco: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  novo: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  hibernando: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  sem_compra: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

type FilterKey = "todos" | "urgente" | "oportunidade";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "urgente", label: "Urgente" },
  { key: "oportunidade", label: "Oportunidade" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface SignalCardProps {
  card: CopilotoCard;
  isBusy: boolean;
  onAction: (action: "done" | "snoozed" | "dismissed") => void;
}

function SignalCard({ card, isBusy, onAction }: SignalCardProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(card.suggestedMessage ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const meta = SIGNAL_META[card.type];
  const Icon = meta?.icon ?? Sparkles;
  const digits = card.clientPhone?.replace(/\D/g, "") ?? "";
  const canWhatsapp = digits.length > 0 && !card.whatsappOptOut;

  // A mensagem vai pré-preenchida no WhatsApp; se a IA falhou para este card,
  // o link abre a conversa em branco em vez de sumir.
  const whatsappHref = message.trim()
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`
    : `https://wa.me/${digits}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.trim());
      toast({ title: "Mensagem copiada." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("mt-0.5 shrink-0", meta?.accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {card.clientName}
              </h3>
              {card.rfmSegment && RFM_LABELS[card.rfmSegment] && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    RFM_COLORS[card.rfmSegment],
                  )}
                >
                  {RFM_LABELS[card.rfmSegment]}
                </span>
              )}
            </div>
            <p className={cn("mt-0.5 text-xs font-medium", meta?.accent)}>
              {meta?.label ?? card.type}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{card.reason}</p>
            {card.whatsappOptOut && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <BellOff className="h-3 w-3" />
                Cliente pediu para não receber WhatsApp — prefira ligar.
              </p>
            )}
          </div>
        </div>
        {card.estimatedValue > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Potencial</p>
            <p className="font-semibold text-foreground">
              {formatCurrency(card.estimatedValue)}
            </p>
          </div>
        )}
      </div>

      {card.suggestedMessage && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Mensagem sugerida
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setIsEditing((editing) => !editing)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                {isEditing ? "Pronto" : "Editar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleCopy}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copiar
              </Button>
            </div>
          </div>
          {isEditing ? (
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              className="mt-2 w-full resize-y rounded border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {message}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canWhatsapp && (
          <Button size="sm" variant="default" asChild>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp className="mr-1.5 h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        )}
        {digits.length > 0 && (
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${digits}`}>
              <Phone className="mr-1.5 h-4 w-4" />
              Ligar
            </a>
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => onAction("done")}
            title="Já falei com este cliente"
          >
            {isBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-4 w-4" />
            )}
            Já falei
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => onAction("snoozed")}
            title="Adiar por 3 dias"
          >
            <CalendarClock className="mr-1.5 h-4 w-4" />
            Adiar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => onAction("dismissed")}
            title="Este card não faz sentido"
          >
            <X className="mr-1.5 h-4 w-4" />
            Não faz sentido
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CopilotoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<CopilotoFeed>({
    queryKey: ["/api/copiloto/feed"],
  });

  const actionMutation = useMutation({
    mutationFn: async (params: {
      signalId: string;
      action: "done" | "snoozed" | "dismissed";
    }) => {
      const body =
        params.action === "snoozed"
          ? { action: params.action, snoozeDays: 3 }
          : { action: params.action };
      await apiRequest(
        "POST",
        `/api/copiloto/signals/${params.signalId}/action`,
        body,
      );
    },
    onMutate: (params) => setBusyId(params.signalId),
    onSuccess: (_result, params) => {
      const messages: Record<string, string> = {
        done: "Contato registrado.",
        snoozed: "Card adiado por 3 dias.",
        dismissed: "Card removido da fila. Não vamos sugerir de novo por 30 dias.",
      };
      toast({ title: messages[params.action] });
      queryClient.invalidateQueries({ queryKey: ["/api/copiloto/feed"] });
    },
    onError: () => {
      toast({
        title: "Não foi possível registrar a ação",
        variant: "destructive",
      });
    },
    onSettled: () => setBusyId(null),
  });

  const cards = useMemo(() => {
    const all = data?.cards ?? [];
    if (filter === "todos") return all;
    return all.filter((card) => SIGNAL_META[card.type]?.group === filter);
  }, [data?.cards, filter]);

  const counts = useMemo(() => {
    const all = data?.cards ?? [];
    return {
      todos: all.length,
      urgente: all.filter((c) => SIGNAL_META[c.type]?.group === "urgente").length,
      oportunidade: all.filter(
        (c) => SIGNAL_META[c.type]?.group === "oportunidade",
      ).length,
    };
  }, [data?.cards]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Não foi possível carregar o Copiloto. Tente recarregar a página.
        </p>
      </div>
    );
  }

  const totalCards = data?.cards.length ?? 0;

  return (
    <div className="mobile-responsive space-y-6 p-4 sm:p-6">
      <header className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Copiloto</h1>
        </div>
        <p className="mt-2 text-lg text-foreground">
          {greeting()}
          {firstName(user?.name) ? `, ${firstName(user?.name)}` : ""}.{" "}
          {totalCards > 0 ? (
            <>
              Você tem{" "}
              <strong>
                {totalCards} contato{totalCards > 1 ? "s" : ""}
              </strong>{" "}
              para hoje.
            </>
          ) : (
            <>Nenhum contato pendente para hoje.</>
          )}
        </p>
        {totalCards > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Potencial estimado:{" "}
            <strong className="text-foreground">
              {formatCurrency(data?.totalPotential ?? 0)}
            </strong>
            {data?.lastScanAt && (
              <>
                {" · "}
                Fila gerada{" "}
                {formatDistanceToNow(new Date(data.lastScanAt), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </>
            )}
          </p>
        )}
      </header>

      {totalCards > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                filter === option.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option.label}
              <Badge variant="secondary" className="ml-2">
                {counts[option.key]}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {totalCards === 0
              ? "Fila vazia por enquanto"
              : "Nada neste filtro"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCards === 0
              ? "O Copiloto varre sua carteira toda madrugada e monta a fila do dia aqui."
              : "Escolha outro filtro para ver os demais contatos."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <SignalCard
              key={card.id}
              card={card}
              isBusy={busyId === card.id && actionMutation.isPending}
              onAction={(action) =>
                actionMutation.mutate({ signalId: card.id, action })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
