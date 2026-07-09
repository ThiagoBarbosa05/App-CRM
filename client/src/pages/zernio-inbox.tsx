import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Search,
  ArrowLeft,
  RefreshCw,
  Inbox,
  Instagram,
  Facebook,
  Twitter,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
} from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  twitter: "X / Twitter",
  x: "X / Twitter",
  bluesky: "Bluesky",
  reddit: "Reddit",
  all: "Todas as plataformas",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  facebook: "bg-blue-100 text-blue-700 border-blue-200",
  whatsapp: "bg-green-100 text-green-700 border-green-200",
  telegram: "bg-sky-100 text-sky-700 border-sky-200",
  twitter: "bg-slate-100 text-slate-700 border-slate-200",
  x: "bg-slate-100 text-slate-700 border-slate-200",
  bluesky: "bg-indigo-100 text-indigo-700 border-indigo-200",
  reddit: "bg-orange-100 text-orange-700 border-orange-200",
};

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "instagram") return <Instagram className="h-3.5 w-3.5" />;
  if (platform === "facebook") return <Facebook className="h-3.5 w-3.5" />;
  if (platform === "twitter" || platform === "x") return <Twitter className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1.5 py-0 h-4 gap-1 capitalize", PLATFORM_COLORS[platform] ?? "bg-slate-100 text-slate-600")}
    >
      <PlatformIcon platform={platform} />
      {PLATFORM_LABELS[platform] ?? platform}
    </Badge>
  );
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return format(d, "HH:mm");
    return format(d, "dd/MM", { locale: ptBR });
  } catch {
    return "";
  }
}

interface ZernioConversation {
  id: string;
  platform: string;
  accountId: string;
  lastMessage?: { text: string; timestamp: string; direction: "incoming" | "outgoing" };
  participant?: { id: string; name?: string; username?: string };
  unreadCount?: number;
}

interface ZernioMessage {
  id: string;
  conversationId: string;
  direction: "incoming" | "outgoing";
  text?: string;
  timestamp: string;
  sender?: { id: string; name?: string };
}

interface ConversationListData {
  data: ZernioConversation[];
  pagination?: { nextCursor?: string };
}

interface MessagesData {
  data: ZernioMessage[];
  pagination?: { nextCursor?: string };
}

export default function ZernioInboxPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [search, setSearch] = useState("");
  const [activeConv, setActiveConv] = useState<ZernioConversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sseConnected, setSseConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Verifica status da integração
  const { data: status } = useQuery<{ configured: boolean; ok?: boolean }>({
    queryKey: ["/api/zernio/status"],
  });

  // Lista de conversas
  const { data: convsData, isLoading: convsLoading, refetch: refetchConvs } = useQuery<ConversationListData>({
    queryKey: ["/api/zernio/conversations", selectedPlatform],
    queryFn: async () => {
      const url = selectedPlatform === "all"
        ? "/api/zernio/conversations"
        : `/api/zernio/conversations?platform=${selectedPlatform}`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar conversas");
      return resp.json();
    },
    enabled: status?.configured === true,
    refetchInterval: 30_000,
  });

  // Mensagens da conversa ativa
  const { data: msgsData, isLoading: msgsLoading } = useQuery<MessagesData>({
    queryKey: ["/api/zernio/conversations", activeConv?.id, "messages"],
    queryFn: async () => {
      const resp = await fetch(`/api/zernio/conversations/${activeConv!.id}/messages`, { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar mensagens");
      return resp.json();
    },
    enabled: !!activeConv,
  });

  // Enviar mensagem
  const sendMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/zernio/conversations/${activeConv!.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeConv!.accountId, message: replyText }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao enviar mensagem");
      }
      return resp.json();
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/zernio/conversations", activeConv?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zernio/conversations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" }),
  });

  // SSE — mensagens em tempo real
  useEffect(() => {
    if (!status?.configured) return;
    const es = new EventSource("/api/zernio/events");
    sseRef.current = es;
    es.addEventListener("open", () => setSseConnected(true));
    es.addEventListener("error", () => setSseConnected(false));
    es.addEventListener("message.received", (ev) => {
      try {
        const data: ZernioMessage = JSON.parse(ev.data);
        if (activeConv && data.conversationId === activeConv.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/zernio/conversations", activeConv.id, "messages"] });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/zernio/conversations"] });
      } catch {}
    });
    return () => { es.close(); setSseConnected(false); };
  }, [status?.configured]);

  // Scroll automático para o final
  useEffect(() => {
    if (msgsData?.data?.length) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [msgsData?.data?.length]);

  const conversations = convsData?.data ?? [];
  const filtered = conversations.filter((c) => {
    const name = c.participant?.name ?? c.participant?.username ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });
  const messages = msgsData?.data ?? [];

  const convName = (c: ZernioConversation) =>
    c.participant?.name ?? c.participant?.username ?? c.participant?.id ?? "Desconhecido";

  // === Tela sem API configurada ===
  if (status && !status.configured) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertCircle className="h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Zernio não configurado</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          A chave de API do Zernio (<code>ZERNIO_API_KEY</code>) não foi encontrada. Adicione-a nas configurações do projeto e reinicie o servidor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* PAINEL ESQUERDO — Lista de conversas */}
      <div
        className={cn(
          "flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all",
          activeConv ? "hidden md:flex md:w-80 lg:w-96 shrink-0" : "flex w-full md:w-80 lg:w-96 shrink-0",
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <h1 className="font-semibold text-slate-900 dark:text-slate-100">Inbox Unificado</h1>
            </div>
            <div className="flex items-center gap-1.5">
              {sseConnected ? (
                <span title="Recebendo em tempo real" className="flex items-center gap-1 text-[10px] text-green-600">
                  <Wifi className="h-3 w-3" /> ao vivo
                </span>
              ) : (
                <span title="Desconectado" className="flex items-center gap-1 text-[10px] text-slate-400">
                  <WifiOff className="h-3 w-3" />
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refetchConvs()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Filtro de plataforma */}
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Lista */}
        <ScrollArea className="flex-1">
          {convsLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveConv(conv)}
                className={cn(
                  "w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                  activeConv?.id === conv.id && "bg-rose-50 dark:bg-rose-950/20 border-l-2 border-l-rose-500",
                )}
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {(convName(conv)[0] ?? "?").toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {convName(conv)}
                    </span>
                    {conv.lastMessage?.timestamp && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTime(conv.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PlatformBadge platform={conv.platform} />
                    {(conv.unreadCount ?? 0) > 0 && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-rose-500 text-white hover:bg-rose-500">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {conv.lastMessage?.text && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.lastMessage.direction === "outgoing" ? "Você: " : ""}
                      {conv.lastMessage.text}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* PAINEL DIREITO — Conversa ativa */}
      {activeConv ? (
        <div className="flex flex-col flex-1 min-w-0 bg-white dark:bg-slate-900">
          {/* Header da conversa */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 md:hidden"
              onClick={() => setActiveConv(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0">
              {(convName(activeConv)[0] ?? "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {convName(activeConv)}
              </p>
              <PlatformBadge platform={activeConv.platform} />
            </div>
          </div>

          {/* Mensagens */}
          <ScrollArea className="flex-1 px-4 py-4">
            {msgsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                    <Skeleton className="h-10 w-48 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isOut = msg.direction === "outgoing";
                  return (
                    <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          isOut
                            ? "bg-rose-600 text-white rounded-br-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm",
                        )}
                      >
                        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                        <p className={cn("text-[10px] mt-1 text-right", isOut ? "text-rose-200" : "text-slate-400")}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input de resposta */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="Digite sua resposta..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (replyText.trim() && !sendMutation.isPending) sendMutation.mutate();
                  }
                }}
                rows={1}
                className="flex-1 resize-none min-h-[40px] max-h-32 text-sm"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 bg-rose-600 hover:bg-rose-700"
                disabled={!replyText.trim() || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-slate-400">
          <MessageSquare className="h-14 w-14 opacity-20" />
          <p className="text-sm">Selecione uma conversa para responder</p>
        </div>
      )}
    </div>
  );
}
