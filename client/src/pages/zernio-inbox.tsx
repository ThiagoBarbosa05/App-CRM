import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch } from "wouter";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ClientFormModal from "@/components/client-form-modal";
import type { Client } from "@shared/schema";
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
  WifiOff,
  AlertCircle,
  Loader2,
  UserPlus,
  UserCheck,
  X,
  Link2,
  Paperclip,
} from "lucide-react";

// Paleta de cores para os avatares — determinística por contato, para
// diferenciar visualmente as conversas na lista sem depender de foto de perfil.
const AVATAR_PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

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

const PLATFORM_ICON_BG: Record<string, string> = {
  instagram: "bg-gradient-to-br from-fuchsia-500 to-pink-500",
  facebook: "bg-blue-600",
  whatsapp: "bg-green-500",
  telegram: "bg-sky-500",
  twitter: "bg-slate-800",
  x: "bg-slate-800",
  bluesky: "bg-indigo-500",
  reddit: "bg-orange-500",
};

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = className ?? "h-3.5 w-3.5";
  if (platform === "instagram") return <Instagram className={cls} />;
  if (platform === "facebook") return <Facebook className={cls} />;
  if (platform === "twitter" || platform === "x") return <Twitter className={cls} />;
  return <MessageSquare className={cls} />;
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
  clientId?: string | null;
  clientName?: string | null;
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

interface ZernioAccount {
  _id?: string;
  accountId?: string;
  platform: string;
  username?: string;
  displayName?: string;
}

interface AccountsData {
  data?: ZernioAccount[];
  accounts?: ZernioAccount[];
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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const searchParams = useSearch();
  const requestedConversationId = new URLSearchParams(searchParams).get("conversationId");
  const autoOpenedRef = useRef<string | null>(null);

  // Verifica status da integração
  const { data: status } = useQuery<{ configured: boolean; ok?: boolean }>({
    queryKey: ["/api/zernio/status"],
  });

  // Contas conectadas (para exibir o @usuário do Instagram/etc. dono de cada conversa)
  const { data: accountsData } = useQuery<AccountsData>({
    queryKey: ["/api/zernio/accounts"],
    queryFn: async () => {
      const resp = await fetch("/api/zernio/accounts", { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar contas conectadas");
      return resp.json();
    },
    enabled: status?.configured === true,
    staleTime: 5 * 60_000,
  });

  const accountsById = new Map<string, ZernioAccount>();
  for (const acc of accountsData?.accounts ?? accountsData?.data ?? []) {
    const id = acc.accountId ?? acc._id;
    if (id) accountsById.set(id, acc);
  }
  const accountLabel = (accountId?: string) => {
    if (!accountId) return null;
    const acc = accountsById.get(accountId);
    if (!acc) return null;
    const handle = acc.username ?? acc.displayName;
    return handle ? (handle.startsWith("@") ? handle : `@${handle}`) : null;
  };

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

  // Abre automaticamente a conversa indicada via ?conversationId= (ex: link vindo do perfil do cliente)
  useEffect(() => {
    if (!requestedConversationId) return;
    if (autoOpenedRef.current === requestedConversationId) return;
    const conv = convsData?.data?.find((c) => c.id === requestedConversationId);
    if (conv) {
      setActiveConv(conv);
      autoOpenedRef.current = requestedConversationId;
    }
  }, [requestedConversationId, convsData]);

  // Mensagens da conversa ativa
  const { data: msgsData, isLoading: msgsLoading } = useQuery<MessagesData>({
    queryKey: ["/api/zernio/conversations", activeConv?.id, "messages"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeConv!.accountId) params.set("accountId", activeConv!.accountId);
      const resp = await fetch(
        `/api/zernio/conversations/${activeConv!.id}/messages?${params.toString()}`,
        { credentials: "include" }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Erro ao carregar mensagens");
      }
      return resp.json();
    },
    enabled: !!activeConv,
    refetchInterval: 15_000,
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

  // Busca de clientes para vincular
  const { data: clientSearchData, isLoading: clientSearchLoading } = useQuery<{ data: Client[] }>({
    queryKey: ["/api/clients", "zernio-link-search", clientSearch],
    queryFn: async () => {
      const resp = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&pageSize=10`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Erro ao buscar clientes");
      return resp.json();
    },
    enabled: linkDialogOpen && clientSearch.trim().length >= 2,
  });

  // Vincular conversa a um cliente
  const linkMutation = useMutation({
    mutationFn: async (client: Client) => {
      const resp = await fetch(`/api/zernio/conversations/${activeConv!.id}/link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          platform: activeConv!.platform,
          accountId: activeConv!.accountId,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao vincular cliente");
      }
      return client;
    },
    onSuccess: (client) => {
      setActiveConv((prev) => (prev ? { ...prev, clientId: client.id, clientName: client.name } : prev));
      queryClient.invalidateQueries({ queryKey: ["/api/zernio/conversations"] });
      setLinkDialogOpen(false);
      setClientSearch("");
      toast({ title: "Contato vinculado", description: `Vinculado a ${client.name}.` });
    },
    onError: (e: Error) => toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" }),
  });

  // Desvincular conversa
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/zernio/conversations/${activeConv!.id}/link`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao desvincular cliente");
      }
    },
    onSuccess: () => {
      setActiveConv((prev) => (prev ? { ...prev, clientId: null, clientName: null } : prev));
      queryClient.invalidateQueries({ queryKey: ["/api/zernio/conversations"] });
      toast({ title: "Vínculo removido" });
    },
    onError: (e: Error) => toast({ title: "Erro ao desvincular", description: e.message, variant: "destructive" }),
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
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const convName = (c: ZernioConversation) =>
    c.participant?.name ?? c.participant?.username ?? c.participant?.id ?? "Desconhecido";

  // === Tela sem API configurada ===
  if (status && !status.configured) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Zernio não configurado</h2>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
          A chave de API do Zernio (<code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">ZERNIO_API_KEY</code>) não foi encontrada. Adicione-a nas configurações do projeto e reinicie o servidor.
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
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                <Inbox className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-slate-100 leading-none">Inbox Unificado</h1>
                {totalUnread > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {totalUnread} {totalUnread === 1 ? "não lida" : "não lidas"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {sseConnected ? (
                <span
                  title="Recebendo mensagens em tempo real"
                  className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-2 py-1"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  ao vivo
                </span>
              ) : (
                <span
                  title="Desconectado do tempo real"
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-1"
                >
                  <WifiOff className="h-3 w-3" />
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Atualizar conversas"
                onClick={() => refetchConvs()}
              >
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
        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-sm">
                {search ? "Nenhum contato encontrado" : "Nenhuma conversa encontrada"}
              </p>
            </div>
          ) : (
            filtered.map((conv) => {
              const unread = (conv.unreadCount ?? 0) > 0;
              const isActive = activeConv?.id === conv.id;
              const name = convName(conv);
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setActiveConv(conv)}
                  className={cn(
                    "group w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 transition-colors relative",
                    isActive
                      ? "bg-rose-50/70 dark:bg-rose-950/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  )}
                >
                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-500" />}

                  {/* Avatar com selo da plataforma */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold ring-1 ring-inset ring-black/5",
                        avatarColor(conv.id),
                      )}
                    >
                      {(name[0] ?? "?").toUpperCase()}
                    </div>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 text-white",
                        PLATFORM_ICON_BG[conv.platform] ?? "bg-slate-500",
                      )}
                    >
                      <PlatformIcon platform={conv.platform} className="h-2.5 w-2.5" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm truncate min-w-0 flex-1",
                          unread ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300",
                        )}
                      >
                        {name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv.lastMessage?.timestamp && (
                          <span className={cn("text-[10px]", unread ? "text-rose-600 font-medium" : "text-slate-400")}>
                            {formatTime(conv.lastMessage.timestamp)}
                          </span>
                        )}
                        {unread && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {conv.participant?.username && `@${conv.participant.username.replace(/^@/, "")}`}
                      {conv.participant?.username && accountLabel(conv.accountId) && " · "}
                      {accountLabel(conv.accountId) && `via ${accountLabel(conv.accountId)}`}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      {conv.lastMessage?.text ? (
                        <p className={cn("text-xs truncate flex items-center gap-1 min-w-0 flex-1", unread ? "text-slate-600 dark:text-slate-300" : "text-slate-400")}>
                          {conv.lastMessage.direction === "outgoing" && (
                            <span className="text-slate-400 shrink-0">Você:</span>
                          )}
                          {conv.lastMessage.text.startsWith("📎") ? (
                            <span className="flex items-center gap-1 italic text-slate-400 shrink-0">
                              <Paperclip className="h-3 w-3 shrink-0" /> [Anexo]
                            </span>
                          ) : (
                            <span className="truncate min-w-0">{conv.lastMessage.text}</span>
                          )}
                        </p>
                      ) : (
                        <span />
                      )}
                      {conv.clientId && (
                        <span title={conv.clientName ?? "Cliente vinculado"} className="shrink-0">
                          <UserCheck className="h-3 w-3 text-emerald-600" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* PAINEL DIREITO — Conversa ativa */}
      {activeConv ? (
        <div className="flex flex-col flex-1 min-w-0 bg-slate-50/50 dark:bg-slate-900">
          {/* Header da conversa */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 shadow-sm z-10">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 md:hidden"
              onClick={() => setActiveConv(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative shrink-0">
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold ring-1 ring-inset ring-black/5",
                  avatarColor(activeConv.id),
                )}
              >
                {(convName(activeConv)[0] ?? "?").toUpperCase()}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-[16px] w-[16px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 text-white",
                  PLATFORM_ICON_BG[activeConv.platform] ?? "bg-slate-500",
                )}
              >
                <PlatformIcon platform={activeConv.platform} className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {convName(activeConv)}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                {activeConv.participant?.username && <span>@{activeConv.participant.username.replace(/^@/, "")}</span>}
                {accountLabel(activeConv.accountId) && <span>· via {accountLabel(activeConv.accountId)}</span>}
              </div>
            </div>
            {activeConv.clientId ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge className="text-[10px] gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                  <UserCheck className="h-3 w-3" />
                  {activeConv.clientName ?? "Cliente vinculado"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                  title="Remover vínculo"
                  disabled={unlinkMutation.isPending}
                  onClick={() => unlinkMutation.mutate()}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 shrink-0"
                onClick={() => setLinkDialogOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Vincular Cliente
              </Button>
            )}
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
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
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 opacity-40" />
                </div>
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
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                          isOut
                            ? "bg-rose-600 text-white rounded-br-sm"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-100 dark:border-slate-700",
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
          </div>

          {/* Input de resposta */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 bg-white dark:bg-slate-900">
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
                className="flex-1 resize-none min-h-[40px] max-h-32 text-sm focus-visible:ring-rose-500"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 bg-rose-600 hover:bg-rose-700 transition-transform active:scale-95"
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
        <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-slate-400 bg-slate-50/50 dark:bg-slate-900">
          <div className="h-20 w-20 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
            <MessageSquare className="h-9 w-9 opacity-30" />
          </div>
          <p className="text-sm font-medium text-slate-500">Selecione uma conversa para responder</p>
          <p className="text-xs text-slate-400 max-w-xs text-center">
            As mensagens recebidas de Instagram, WhatsApp e outras redes aparecem aqui em tempo real.
          </p>
        </div>
      )}

      {/* Dialog — Vincular Cliente */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) setClientSearch(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular contato a um cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar por nome, telefone, e-mail ou CPF..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-64">
              {clientSearch.trim().length < 2 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Digite ao menos 2 caracteres para buscar</p>
              ) : clientSearchLoading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (clientSearchData?.data ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum cliente encontrado</p>
              ) : (
                <div className="space-y-1">
                  {(clientSearchData?.data ?? []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={linkMutation.isPending}
                      onClick={() => linkMutation.mutate(c)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0", avatarColor(c.id))}>
                        {(c.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 truncate">{c.phone || c.email || "—"}</p>
                      </div>
                      {linkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 text-slate-400" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { setLinkDialogOpen(false); setNewClientModalOpen(true); }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Cadastrar novo cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Cadastrar novo cliente a partir do contato */}
      {newClientModalOpen && activeConv && (
        <ClientFormModal
          open={newClientModalOpen}
          onOpenChange={(open) => {
            setNewClientModalOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
              const name = convName(activeConv);
              setClientSearch(name !== "Desconhecido" ? name : "");
              setLinkDialogOpen(true);
            }
          }}
          client={
            {
              name: convName(activeConv) !== "Desconhecido" ? convName(activeConv) : "",
              phone: activeConv.platform === "whatsapp" ? (activeConv.participant?.id ?? "") : "",
            } as unknown as Client
          }
        />
      )}
    </div>
  );
}
