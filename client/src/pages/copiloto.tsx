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
  Plus,
  Users,
  RefreshCw,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Link, useLocation } from "wouter";

import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type CopilotoSignalType =
  | "ciclo_vencido"
  | "produto_abandonado"
  | "aniversario"
  | "campeao_silencioso"
  | "pos_venda";

/** Faixa factual do card. Ausente para quem ainda não comprou (ex.: aniversário). */
interface ClientFacts {
  firstPurchaseYear: number | null;
  orderCount: number;
  totalSpent: number;
  topProducts: string[];
}

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
  backlogCount: number;
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
  pos_venda: {
    label: "Pós-Venda",
    icon: Check,
    accent: "text-teal-600 dark:text-teal-400",
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

const RFM_COLORS_ACTIVE: Record<string, string> = {
  campiao: "bg-yellow-400 text-yellow-900 ring-2 ring-yellow-400 ring-offset-1",
  fiel: "bg-emerald-500 text-white ring-2 ring-emerald-500 ring-offset-1",
  promissor: "bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-1",
  em_risco: "bg-orange-500 text-white ring-2 ring-orange-500 ring-offset-1",
  perdido: "bg-red-500 text-white ring-2 ring-red-500 ring-offset-1",
  novo: "bg-violet-500 text-white ring-2 ring-violet-500 ring-offset-1",
  hibernando: "bg-slate-500 text-white ring-2 ring-slate-500 ring-offset-1",
  sem_compra: "bg-gray-400 text-white ring-2 ring-gray-400 ring-offset-1",
};

/** Usuário do dropdown de inspeção. Espelha o que GET /api/users devolve. */
interface DirectoryUser {
  id: string;
  name: string;
  role: string;
  isActive: string;
}

/**
 * Papéis que enxergam a fila alheia.
 *
 * Espelha a checagem de GET /api/copiloto/feed — a lista aqui é conveniência de
 * UI; quem barra de verdade é o servidor, que devolve 403 para o resto.
 * "administrador" é legado: o enum do schema hoje só emite "admin".
 */
const MANAGER_ROLES = new Set(["admin", "administrador", "gerente"]);

/** Valor do Select para "minha própria fila" — o Radix não aceita item vazio. */
const OWN_QUEUE = "__me__";

type FilterKey = "todos" | CopilotoSignalType;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Faixa visual de prioridade baseada no valor potencial estimado.
 * Alto  ≥ R$3 000 → borda vermelha
 * Médio ≥ R$500  → borda âmbar
 * Baixo           → borda sutil
 */
function priorityTier(card: CopilotoCard): "high" | "medium" | "low" {
  if (card.estimatedValue >= 3000) return "high";
  if (card.estimatedValue >= 500) return "medium";
  return "low";
}

const TIER_BORDER: Record<string, string> = {
  high: "border-l-4 border-l-red-500",
  medium: "border-l-4 border-l-amber-400",
  low: "border-l-4 border-l-slate-200 dark:border-l-slate-700",
};

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
  /**
   * Inspeção da fila alheia: mostra o card como o vendedor o vê, sem agir.
   *
   * Não é só cosmético. As ações são escopadas ao vendedor logado no servidor —
   * `actOnSignal` casa `sellerId` com quem chama, e o start de conversa exige
   * ser o responsável pelo cliente. Um gerente clicando aqui só colheria erro,
   * ou pior: registraria a ação em nome de quem não falou com o cliente.
   */
  readOnly?: boolean;
}

function SignalCard({ card, isBusy, onAction, readOnly = false }: SignalCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState(card.suggestedMessage ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const meta = SIGNAL_META[card.type];
  const Icon = meta?.icon ?? Sparkles;
  const digits = card.clientPhone?.replace(/\D/g, "") ?? "";
  const tier = priorityTier(card);

  // Badge de data/hora para aniversário usa daysAhead do payload;
  // para os demais, exibe tempo relativo a partir de generatedAt.
  const daysAhead =
    card.type === "aniversario"
      ? (card.payload.daysAhead as number | undefined)
      : undefined;
  const birthdayLabel =
    daysAhead === 0
      ? "Aniversário hoje 🎂"
      : daysAhead === 1
        ? "Amanhã"
        : daysAhead != null
          ? `Em ${daysAhead} dias`
          : null;
  const dateLabel =
    birthdayLabel ??
    formatDistanceToNow(new Date(card.generatedAt), {
      addSuffix: true,
      locale: ptBR,
    });
  const canWhatsapp = digits.length > 0 && !card.whatsappOptOut;
  const facts = card.payload.facts as ClientFacts | undefined;

  /**
   * Abre a conversa no WhatsApp do próprio sistema, pelo canal da empresa.
   *
   * O start é obrigatório antes de navegar: só 1 dos ~97 clientes da fila já
   * tem conversa, e a tela de conversas só consegue auto-selecionar pelo
   * ?phone= o que já existe na lista. Sem isto, o vendedor cairia numa lista
   * vazia. O endpoint é idempotente (findOrCreateConversation) e valida que o
   * vendedor é o responsável pelo cliente.
   */
  const openConversation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/whatsapp/conversations/start", {
        clientId: card.clientId,
      });
    },
    onSuccess: () => {
      const text = message.trim();
      setLocation(
        `/whatsapp/conversas?phone=${encodeURIComponent(digits)}` +
          (text ? `&text=${encodeURIComponent(text)}` : ""),
      );
    },
    onError: () => {
      toast({
        title: "Não foi possível abrir a conversa",
        description: "Verifique se o cliente tem telefone e se você é o responsável.",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.trim());
      toast({ title: "Mensagem copiada." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md overflow-hidden",
        TIER_BORDER[tier],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("mt-0.5 shrink-0", meta?.accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/clientes/${card.clientId}`}>
                <h3 className="cursor-pointer font-semibold text-foreground truncate hover:text-primary hover:underline">
                  {card.clientName}
                </h3>
              </Link>
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
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className={cn("text-xs font-medium", meta?.accent)}>
                {meta?.label ?? card.type}
              </p>
              <span className="text-xs text-muted-foreground">{dateLabel}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{card.reason}</p>
            {facts && (
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <p>
                  {[
                    facts.firstPurchaseYear && `Cliente desde ${facts.firstPurchaseYear}`,
                    facts.orderCount > 0 &&
                      `${facts.orderCount} pedido${facts.orderCount > 1 ? "s" : ""}`,
                    facts.totalSpent > 0 && formatCurrency(facts.totalSpent),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {facts.topProducts.length > 0 && (
                  <p>
                    <span className="font-medium">Leva:</span>{" "}
                    {facts.topProducts.join(" · ")}
                  </p>
                )}
              </div>
            )}
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
              {!readOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setIsEditing((editing) => !editing)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  {isEditing ? "Pronto" : "Editar"}
                </Button>
              )}
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

      {readOnly ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Somente o vendedor responsável pode agir neste card.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canWhatsapp && (
            <Button
              size="sm"
              variant="default"
              disabled={openConversation.isPending}
              onClick={() => openConversation.mutate()}
            >
              {openConversation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FaWhatsapp className="mr-1.5 h-4 w-4" />
              )}
              WhatsApp
            </Button>
          )}
          {digits.length > 0 && (
            <Button size="sm" variant="outline" asChild>
              {/* Mesmo contrato de deep-link que clients-table-with-selection.tsx
                  já usa: o discador lê phone/clientId/clientName da URL e
                  pré-preenche, sem discar sozinho. */}
              <Link
                href={
                  `/telemarketing?tab=dialer&clientId=${card.clientId}` +
                  `&phone=${encodeURIComponent(card.clientPhone ?? "")}` +
                  `&clientName=${encodeURIComponent(card.clientName)}`
                }
              >
                <Phone className="mr-1.5 h-4 w-4" />
                Ligar
              </Link>
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
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CopilotoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilterRaw] = useState<FilterKey>("todos");
  const [rfmFilter, setRfmFilterRaw] = useState<string>("todos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewSellerId, setViewSellerId] = useState<string>(OWN_QUEUE);

  // Os dois filtros são mutuamente exclusivos: selecionar um tipo limpa o perfil
  // e selecionar um perfil limpa o tipo. Assim nunca há AND entre eles.
  const setFilter = (value: FilterKey) => {
    setFilterRaw(value);
    setRfmFilterRaw("todos");
  };
  const setRfmFilter = (value: string) => {
    setRfmFilterRaw(value);
    setFilterRaw("todos");
  };

  const isManager = MANAGER_ROLES.has(user?.role ?? "");
  const isInspecting = isManager && viewSellerId !== OWN_QUEUE;

  const { data: directory = [] } = useQuery<DirectoryUser[]>({
    queryKey: ["/api/users"],
    enabled: isManager,
  });

  // Só quem pode ter fila. Inativo fora: a varredura não gera card para ele, e
  // a lista de usuários da base é longa o bastante para o dropdown virar ruído.
  const sellers = useMemo(
    () =>
      directory
        .filter((entry) => entry.isActive === "true" && entry.id !== user?.id)
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [directory, user?.id],
  );

  const viewedSellerName =
    sellers.find((entry) => entry.id === viewSellerId)?.name ?? "";

  // queryFn explícita: a padrão faz queryKey.join("/"), que viraria
  // /api/copiloto/feed/<id> — path, não query param.
  const { data, isLoading, isError } = useQuery<CopilotoFeed>({
    queryKey: ["/api/copiloto/feed", viewSellerId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        isInspecting
          ? `/api/copiloto/feed?sellerId=${encodeURIComponent(viewSellerId)}`
          : "/api/copiloto/feed",
      );
      return (await res.json()) as CopilotoFeed;
    },
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

  const loadMore = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        isInspecting
          ? `/api/copiloto/load-more?sellerId=${encodeURIComponent(viewSellerId)}`
          : "/api/copiloto/load-more",
        {},
      );
      return (await res.json()) as { promoted: number; remaining: number };
    },
    onSuccess: (result) => {
      const target = isInspecting
        ? `na fila de ${firstName(viewedSellerName) || "vendedor"}`
        : "na fila";
      toast({
        title:
          result.promoted > 0
            ? `+${result.promoted} contato${result.promoted > 1 ? "s" : ""} ${target}.`
            : "Não há mais contatos guardados.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/copiloto/feed"] });
    },
    onError: () => {
      toast({ title: "Não foi possível carregar mais", variant: "destructive" });
    },
  });

  const scanSellerMutation = useMutation({
    mutationFn: async (sellerId: string) => {
      const res = await apiRequest("POST", "/api/copiloto/scan-seller", { sellerId });
      return (await res.json()) as { generated: number };
    },
    onSuccess: (result, sellerId) => {
      const sellerName = firstName(sellers.find((s) => s.id === sellerId)?.name || "");
      toast({
        title: `Fila gerada${sellerName ? ` para ${sellerName}` : ""}`,
        description: `${result.generated} contato${result.generated !== 1 ? "s" : ""} na fila.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/copiloto/feed"] });
    },
    onError: () => {
      toast({ title: "Erro ao gerar fila", variant: "destructive" });
    },
  });

  // Contagem por tipo de sinal (apenas os tipos que têm ao menos 1 card).
  const countsByType = useMemo(() => {
    const all = data?.cards ?? [];
    const map: Partial<Record<CopilotoSignalType, number>> = {};
    for (const card of all) {
      map[card.type] = (map[card.type] ?? 0) + 1;
    }
    return map;
  }, [data?.cards]);

  // Segmentos RFM presentes na fila (ordenados pelo label pt-BR).
  const activeRfmSegments = useMemo(() => {
    const all = data?.cards ?? [];
    const segments = new Set<string>();
    for (const card of all) {
      if (card.rfmSegment && RFM_LABELS[card.rfmSegment]) {
        segments.add(card.rfmSegment);
      }
    }
    return [...segments].sort((a, b) =>
      (RFM_LABELS[a] ?? a).localeCompare(RFM_LABELS[b] ?? b, "pt-BR"),
    );
  }, [data?.cards]);

  // Tipos presentes na fila, na ordem definida por SIGNAL_META.
  const activeTypes = useMemo(
    () =>
      (Object.keys(SIGNAL_META) as CopilotoSignalType[]).filter(
        (t) => (countsByType[t] ?? 0) > 0,
      ),
    [countsByType],
  );

  const cards = useMemo(() => {
    const all = data?.cards ?? [];
    return all.filter(
      (card) =>
        (filter === "todos" || card.type === filter) &&
        (rfmFilter === "todos" || card.rfmSegment === rfmFilter),
    );
  }, [data?.cards, filter, rfmFilter]);

  const totalCards = data?.cards.length ?? 0;

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

  const backlogAvailable = data?.backlogCount ?? 0;

  return (
    <div className="mobile-responsive space-y-6 p-4 sm:p-6">
      <header className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Copiloto</h1>
          </div>
          {isManager && sellers.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={viewSellerId} onValueChange={setViewSellerId}>
                <SelectTrigger className="w-[220px]">
                  <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OWN_QUEUE}>Minha fila</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={viewSellerId === OWN_QUEUE || scanSellerMutation.isPending}
                onClick={() => {
                  if (viewSellerId !== OWN_QUEUE) {
                    scanSellerMutation.mutate(viewSellerId);
                  }
                }}
                title={
                  viewSellerId === OWN_QUEUE
                    ? "Selecione um vendedor primeiro"
                    : `Gerar fila para ${viewedSellerName || "vendedor"}`
                }
              >
                {scanSellerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">Gerar fila</span>
              </Button>
            </div>
          )}
        </div>
        {isInspecting ? (
          <p className="mt-2 text-lg text-foreground">
            Fila de <strong>{viewedSellerName || "vendedor"}</strong>:{" "}
            {totalCards > 0 ? (
              <>
                <strong>
                  {totalCards} contato{totalCards > 1 ? "s" : ""}
                </strong>{" "}
                para hoje.
              </>
            ) : (
              <>nenhum contato pendente hoje.</>
            )}
          </p>
        ) : (
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
        )}
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
        <div className="space-y-2">
          {/* Filtro por tipo de sinal (só mostra quando há 2+ tipos) */}
          {activeTypes.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 mr-1 select-none">
                Motivo
              </span>
              <button
                onClick={() => setFilter("todos")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  filter === "todos"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/40",
                )}
              >
                Todos
                <Badge variant="secondary" className="ml-2">
                  {totalCards}
                </Badge>
              </button>
              {activeTypes.map((type) => {
                const meta = SIGNAL_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      "flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      filter === type
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/40",
                    )}
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {meta.label}
                    <Badge variant="secondary" className="ml-2">
                      {countsByType[type] ?? 0}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filtro por segmento RFM (só mostra quando há 2+ segmentos) */}
          {activeRfmSegments.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 mr-1 select-none">
                Perfil
              </span>
              <button
                onClick={() => setRfmFilter("todos")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  rfmFilter === "todos"
                    ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-500 ring-offset-1"
                    : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/30",
                )}
              >
                Todos perfis
              </button>
              {activeRfmSegments.map((seg) => (
                <button
                  key={seg}
                  onClick={() => setRfmFilter(seg)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    rfmFilter === seg
                      ? RFM_COLORS_ACTIVE[seg] ?? cn(RFM_COLORS[seg], "ring-2 ring-current ring-offset-1")
                      : cn(RFM_COLORS[seg], "opacity-70 hover:opacity-100"),
                  )}
                >
                  {RFM_LABELS[seg]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {totalCards > 0
              ? "Nada neste filtro"
              : backlogAvailable > 0
                ? "Fila do dia concluída"
                : "Fila vazia por enquanto"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCards > 0
              ? "Escolha outro filtro para ver os demais contatos."
              : isInspecting
                ? backlogAvailable > 0
                  ? `${firstName(viewedSellerName) || "Este vendedor"} já trabalhou a fila de hoje. Há mais ${backlogAvailable} na carteira esperando.`
                  : "Nenhum sinal para este vendedor na última varredura."
                : backlogAvailable > 0
                  ? `Você falou com todos os contatos de hoje. Há mais ${backlogAvailable} na sua carteira esperando.`
                  : "O Copiloto varre sua carteira toda madrugada e monta a fila do dia aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <SignalCard
              key={card.id}
              card={card}
              isBusy={busyId === card.id && actionMutation.isPending}
              readOnly={isInspecting}
              onAction={(action) =>
                actionMutation.mutate({ signalId: card.id, action })
              }
            />
          ))}
        </div>
      )}

      {backlogAvailable > 0 && filter === "todos" && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            disabled={loadMore.isPending}
            onClick={() => loadMore.mutate()}
          >
            {loadMore.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {isInspecting
              ? `Carregar mais na fila de ${firstName(viewedSellerName) || "vendedor"} (${backlogAvailable} em espera)`
              : `Carregar mais (${backlogAvailable} na fila de espera)`}
          </Button>
        </div>
      )}
    </div>
  );
}
