import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  ArrowLeft,
  CheckCheck,
  AlertCircle,
  RotateCcw,
  FileText,
  Download,
  ZoomIn,
  Play,
  Pause,
  Mic,
  PlusCircle,
  Loader2,
} from "lucide-react";

interface Channel {
  id: number;
  name: string;
  displayPhone: string | null;
}

interface ChatClient {
  conversationId: string;
  clientId: string | null;
  phone: string;
  clientName: string | null;
  lastMessageAt?: string | null;
  lastMessageContent?: string | null;
  lastMessageDirection?: "inbound" | "outbound" | null;
  unreadCount?: number | null;
  channelId?: number | null;
  channelName?: string | null;
  channelDisplayPhone?: string | null;
}

interface WaMedia {
  id: string;
  whatsappMediaId: string | null;
  storageKey: string | null;
  mimeType: string | null;
  filename: string | null;
  size: number | null;
}

interface WaMessage {
  id: string;
  conversationId: string;
  waMessageId: string | null;
  direction: "inbound" | "outbound";
  type: string;
  content: string | null;
  caption: string | null;
  status: string | null;
  replyToMessageId: string | null;
  sentByUserId: string | null;
  campaignMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
  media: WaMedia | null;
}

interface LocalMessage {
  localId: string;
  content: string;
  createdAt: string;
}

function getInitials(name: string | null, phone: string) {
  if (!name) return phone.replace(/\D/g, "").slice(-2);
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatMessageDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM");
}

function formatSectionDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

function ClientListItem({
  client,
  selected,
  onClick,
}: {
  client: ChatClient;
  selected: boolean;
  onClick: () => void;
}) {
  const hasUnread = (client.unreadCount ?? 0) > 0;
  const displayName = client.clientName ?? client.phone;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
        "border-b border-slate-100 dark:border-slate-800/60",
        selected
          ? "bg-primary/10 dark:bg-primary/15 border-l-2 border-l-primary"
          : hasUnread
            ? "hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-green-50/50 dark:bg-green-950/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
      )}
    >
      <div className="relative shrink-0">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
          {getInitials(client.clientName, client.phone)}
        </div>
        {hasUnread && !selected && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm">
            {(client.unreadCount ?? 0) > 99 ? "99+" : client.unreadCount}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className={cn(
            "text-sm truncate",
            hasUnread && !selected ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-800 dark:text-slate-100",
          )}>
            {displayName}
          </p>
          {client.lastMessageAt && (
            <span className={cn(
              "text-[11px] shrink-0",
              hasUnread && !selected
                ? "text-green-600 dark:text-green-400 font-semibold"
                : "text-slate-400 dark:text-slate-500",
            )}>
              {formatMessageDate(client.lastMessageAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {client.lastMessageContent ? (
            <p className={cn(
              "text-xs truncate flex-1",
              hasUnread && !selected
                ? "text-slate-700 dark:text-slate-200 font-medium"
                : "text-slate-400 dark:text-slate-500",
            )}>
              {client.lastMessageDirection === "outbound" && (
                <span className="text-slate-400 dark:text-slate-500 mr-0.5">Você: </span>
              )}
              {client.lastMessageContent}
            </p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate flex-1">
              <Phone className="h-3 w-3 shrink-0" />
              {client.phone}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function AudioPlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 w-full min-w-[220px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        preload="metadata"
      />

      <button
        onClick={toggle}
        className={cn(
          "shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors",
          isOutbound
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200",
        )}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className={cn(
            "relative h-1.5 rounded-full overflow-hidden cursor-pointer",
            isOutbound ? "bg-primary-foreground/30" : "bg-slate-200 dark:bg-slate-600",
          )}
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            el.currentTime = ratio * duration;
          }}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOutbound ? "bg-primary-foreground" : "bg-primary",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={cn(
          "text-[10px] tabular-nums",
          isOutbound ? "text-primary-foreground/70" : "text-slate-400 dark:text-slate-500",
        )}>
          {formatTime(current || duration)}
        </span>
      </div>

      <Mic className={cn(
        "h-4 w-4 shrink-0",
        isOutbound ? "text-primary-foreground/50" : "text-slate-400 dark:text-slate-500",
      )} />
    </div>
  );
}

function MessageContent({ msg, isOutbound }: { msg: WaMessage; isOutbound: boolean }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mediaUrl = msg.media?.id
    ? `/api/whatsapp/media/${msg.media.id}`
    : null;

  if (msg.type === "image" || msg.type === "sticker") {
    return (
      <>
        <div>
          {mediaUrl ? (
            <div className="relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
              <img
                src={mediaUrl}
                alt={msg.caption ?? "imagem"}
                className="max-w-full rounded-t-2xl object-cover"
                style={{ maxHeight: 300 }}
              />
              <div className="absolute inset-0 rounded-t-2xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 text-sm italic opacity-60">[imagem]</div>
          )}
          {msg.caption && (
            <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">{msg.caption}</p>
          )}
        </div>

        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-black/90 border-none">
            <img
              src={mediaUrl ?? ""}
              alt={msg.caption ?? "imagem"}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            {msg.caption && (
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white bg-black/60 px-3 py-1 rounded-full max-w-[80%] truncate">
                {msg.caption}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (msg.type === "video") {
    return (
      <div>
        {mediaUrl ? (
          <video
            controls
            src={mediaUrl}
            className="max-w-full rounded-t-2xl"
            style={{ maxHeight: 300 }}
          />
        ) : (
          <div className="px-3.5 py-2.5 text-sm italic opacity-60">[vídeo]</div>
        )}
        {msg.caption && (
          <p className="text-sm px-3.5 pt-1 pb-0.5 whitespace-pre-wrap break-words">{msg.caption}</p>
        )}
      </div>
    );
  }

  if (msg.type === "audio") {
    return mediaUrl ? (
      <AudioPlayer src={mediaUrl} isOutbound={isOutbound} />
    ) : (
      <p className="text-sm italic opacity-60">[áudio]</p>
    );
  }

  if (msg.type === "document") {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 shrink-0 opacity-70" />
        <span className="text-sm truncate flex-1">
          {msg.media?.filename ?? msg.caption ?? "documento"}
        </span>
        {mediaUrl && (
          <a
            href={mediaUrl}
            download={msg.media?.filename ?? true}
            className={cn(
              "shrink-0 p-1 rounded hover:opacity-70 transition-opacity",
              isOutbound ? "text-primary-foreground" : "text-slate-500 dark:text-slate-400",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  if (msg.content) {
    return (
      <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
    );
  }

  return <p className="text-sm italic opacity-60">[{msg.type}]</p>;
}

function ConversationMessages({
  clientId,
  onBack,
  client,
  channels,
  userRole,
}: {
  clientId: string;
  onBack: () => void;
  client: ChatClient;
  channels: Channel[];
  userRole: string;
}) {
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [selectedChannelId, setSelectedChannelId] = useState<number | undefined>(
    client.channelId ?? undefined,
  );
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { toast } = useToast();

  const { data: rawMessages = [], isLoading } = useQuery<WaMessage[]>({
    queryKey: ["/api/whatsapp/conversations", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/conversations/${clientId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data?.messages ?? (Array.isArray(data) ? data : []);
    },
    refetchInterval: 30_000,
  });

  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.sentAt ?? a.createdAt).getTime() -
      new Date(b.sentAt ?? b.createdAt).getTime(),
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, localMessages.length]);

  useEffect(() => {
    const es = new EventSource(`/api/whatsapp/conversations/${clientId}/stream`);
    es.addEventListener("new_message", () => {
      // Clear local pending messages before refetch to avoid duplicate display (race condition:
      // SSE fires after backend confirms send, but attemptSend promise hasn't resolved yet)
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    });
    return () => es.close();
  }, [clientId, queryClient]);

  const attemptSend = useCallback(async (text: string, localId: string, channelId?: number) => {
    try {
      const body: { message: string; channelId?: number } = { message: text };
      if ((userRole === "admin" || userRole === "gerente") && channelId != null) {
        body.channelId = channelId;
      }
      const res = await fetch(`/api/whatsapp/conversations/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      if (err instanceof TypeError) {
        // TypeError = network error: request never reached the backend, no DB record created
        toast({ title: "Erro de conexão. Verifique sua internet e tente novamente.", variant: "destructive" });
      }
      // Non-network errors: backend persisted the message as "failed" — retry button will appear
    } finally {
      setLocalMessages((prev) => prev.filter((m) => m.localId !== localId));
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    }
  }, [clientId, queryClient, toast, userRole]);

  const handleRetry = useCallback(async (messageId: string) => {
    setRetryingIds((prev) => { const s = new Set(prev); s.add(messageId); return s; });
    try {
      await fetch(`/api/whatsapp/conversations/${clientId}/messages/${messageId}/retry`, {
        method: "POST",
      });
    } finally {
      setRetryingIds((prev) => {
        const s = new Set(prev);
        s.delete(messageId);
        return s;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    }
  }, [clientId, queryClient]);

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    const localId = crypto.randomUUID();
    setLocalMessages((prev) => [
      ...prev,
      { localId, content: text, createdAt: new Date().toISOString() },
    ]);
    setMessage("");
    textareaRef.current?.focus();
    attemptSend(text, localId, selectedChannelId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const grouped: { date: string; msgs: WaMessage[] }[] = [];
  for (const msg of messages) {
    const day = format(new Date(msg.sentAt ?? msg.createdAt), "yyyy-MM-dd");
    const last = grouped[grouped.length - 1];
    if (last?.date === day) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: day, msgs: [msg] });
    }
  }

  const displayName = client.clientName ?? client.phone;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0 text-slate-500"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
          {getInitials(client.clientName, client.phone)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {displayName}
          </p>
          {client.clientName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {client.phone}
            </p>
          )}
        </div>

      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-1 bg-slate-50 dark:bg-slate-950/30">
        {isLoading ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className={cn("h-14 rounded-2xl", i % 2 === 0 ? "w-2/5" : "w-3/5")} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700/50 mb-4">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nenhuma mensagem ainda
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px]">
              Envie a primeira mensagem para iniciar a conversa.
            </p>
          </div>
        ) : (
          <>
            {grouped.map(({ date, msgs }) => (
              <div key={date} className="space-y-1.5">
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                    {formatSectionDate(msgs[0].sentAt ?? msgs[0].createdAt)}
                  </span>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                </div>

                {msgs.map((msg, msgIndex) => {
                  const isOutbound = msg.direction === "outbound";
                  const isFailed = isOutbound && msg.status === "failed";
                  const isRetrying = retryingIds.has(msg.id);
                  const isMedia = msg.type === "image" || msg.type === "video" || msg.type === "sticker";
                  const time = format(new Date(msg.sentAt ?? msg.createdAt), "HH:mm");
                  const channelLabel = (client.channelName ?? client.channelDisplayPhone ?? "")
                    .split(" ")[0].slice(0, 5).toUpperCase();
                  const showChannelBadge =
                    isOutbound &&
                    !isFailed &&
                    channelLabel.length > 0 &&
                    (msgIndex === 0 || msgs[msgIndex - 1].direction !== "outbound");
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-full items-end gap-2",
                        isOutbound ? "justify-end" : "justify-start",
                      )}
                    >
                      {/* Badge do canal — primeiro outbound de cada sequência */}
                      {showChannelBadge && (
                        <div className="shrink-0 flex flex-col items-center gap-1 self-end">
                          <div
                            title={`Canal: ${client.channelName ?? client.channelDisplayPhone}`}
                            className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm"
                          >
                            <span className="text-[11px] font-bold text-white uppercase leading-none text-center">
                              {(client.channelName ?? client.channelDisplayPhone ?? "")
                                .split(" ")
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[9px] font-semibold text-green-600 dark:text-green-500 text-center leading-tight w-14 break-words">
                            {client.channelName ?? client.channelDisplayPhone}
                          </span>
                        </div>
                      )}

                      {/* Botão de reenvio à esquerda da bolha (só para falhas) */}
                      {isFailed && (
                        <button
                          onClick={() => handleRetry(msg.id)}
                          disabled={isRetrying}
                          className="shrink-0 mb-1 flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          {isRetrying
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5" />
                          }
                          <span className="whitespace-nowrap">
                            {isRetrying ? "Reenviando…" : "Reenviar"}
                          </span>
                        </button>
                      )}

                      {/* Bolha */}
                      <div
                        className={cn(
                          "max-w-[72%] sm:max-w-[65%] rounded-2xl shadow-sm overflow-hidden",
                          isMedia ? "p-0" : "px-3.5 py-2.5",
                          isFailed
                            ? "bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200 rounded-tr-[4px]"
                            : isOutbound
                              ? "bg-primary text-primary-foreground rounded-tr-[4px]"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-tl-[4px]",
                        )}
                      >
                        {msg.campaignMessageId && (
                          <div className="text-[10px] font-medium mb-1 opacity-70 flex items-center gap-0.5">
                            <span>📢</span>
                            <span>Campanha</span>
                          </div>
                        )}
                        <MessageContent msg={msg} isOutbound={isOutbound} />
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          isMedia ? "px-3 pb-2 justify-end" : "justify-end",
                        )}>
                          <span className={cn(
                            "text-[10px]",
                            isFailed
                              ? "text-red-400 dark:text-red-500"
                              : isOutbound
                                ? "text-primary-foreground/70"
                                : "text-slate-400 dark:text-slate-500",
                          )}>
                            {time}
                          </span>
                          {isFailed ? (
                            <AlertCircle className="h-3 w-3 text-red-400 dark:text-red-500" />
                          ) : isOutbound ? (
                            <CheckCheck className={cn(
                              "h-3 w-3",
                              msg.status === "delivered" || msg.status === "read"
                                ? "text-blue-300"
                                : "text-primary-foreground/60",
                            )} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Mensagens locais em trânsito (pending) */}
            {localMessages.map((lm) => (
              <div key={lm.localId} className="flex w-full justify-end">
                <div className="max-w-[82%] sm:max-w-[70%] rounded-2xl shadow-sm px-3.5 py-2.5 rounded-tr-[4px] bg-primary/60 text-primary-foreground">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                    {lm.content}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-primary-foreground/70">
                      {format(new Date(lm.createdAt), "HH:mm")}
                    </span>
                    <Loader2 className="h-3 w-3 text-primary-foreground/60 animate-spin" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        {(userRole === "admin" || userRole === "gerente") && channels.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
              Canal:
            </span>
            <Select
              value={selectedChannelId != null ? String(selectedChannelId) : ""}
              onValueChange={(v) => setSelectedChannelId(v ? Number(v) : undefined)}
            >
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="Selecionar canal…" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={String(ch.id)}>
                    {ch.name}{ch.displayPhone ? ` · ${ch.displayPhone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem…"
            className="resize-none min-h-[40px] max-h-[120px] text-sm flex-1"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim()}
            size="icon"
            className="shrink-0 h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1.5 text-right hidden sm:block">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (clientId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/clients", "wa-new-conv", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json?.data ?? json) as Array<{ id: string; name: string; phone: string | null }>;
    },
    enabled: open,
  });

  const clientResults = Array.isArray(data) ? data : [];

  const startMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch("/api/whatsapp/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao iniciar conversa");
      }
      return res.json() as Promise<{ clientId: string }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      onOpenChange(false);
      onSelect(result.clientId);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone..."
            className="pl-9 text-sm"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : clientResults.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {debouncedSearch ? "Nenhum cliente encontrado" : "Digite para buscar um cliente"}
              </p>
            </div>
          ) : (
            clientResults.map((c) => (
              <button
                key={c.id}
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left disabled:opacity-50"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {getInitials(c.name, c.phone ?? "")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {c.name}
                  </p>
                  {c.phone && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {c.phone}
                    </p>
                  )}
                </div>
                {startMutation.isPending && startMutation.variables === c.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppConversationsPage() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const isAdminOrGerente = user?.role === "admin" || user?.role === "gerente";

  const { data: availableChannels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/whatsapp/channels/mine"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels/mine");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdminOrGerente,
  });

  const { data: clientList = [], isLoading: isLoadingClients } = useQuery<ChatClient[]>({
    queryKey: ["/api/whatsapp/conversations-list", debouncedSearch, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/whatsapp/conversations?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const markRead = useCallback(async (clientId: string) => {
    try {
      await fetch(`/api/whatsapp/conversations/${clientId}/read`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
    } catch {
      // silently ignore
    }
  }, [queryClient]);

  const selectedClientIdRef = useRef(selectedClientId);
  selectedClientIdRef.current = selectedClientId;

  useEffect(() => {
    const es = new EventSource("/api/whatsapp/notifications/stream");
    es.addEventListener("new_whatsapp_inbound", (e) => {
      const data = JSON.parse(e.data) as { clientId: string | null };
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      if (data.clientId && data.clientId === selectedClientIdRef.current) {
        markRead(data.clientId);
      }
    });
    return () => es.close();
  }, [queryClient, markRead]);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    markRead(clientId);
  };

  const handleBack = () => setSelectedClientId(null);

  const selectedClient = clientList.find((c) => c.clientId === selectedClientId) ?? null;

  const showList = !selectedClientId;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — contact list */}
      <div className={cn(
        "flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
        showList ? "flex w-full md:w-72 lg:w-80 md:flex" : "hidden md:flex md:w-72 lg:w-80",
      )}>
        {/* Search header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Conversas
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-500 hover:text-primary"
              onClick={() => setNewConvOpen(true)}
              title="Nova conversa"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-9 text-sm h-9"
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingClients ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : clientList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Nenhuma conversa
              </p>
              {search ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Tente outro nome ou número
                </p>
              ) : (
                <button
                  onClick={() => setNewConvOpen(true)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Iniciar nova conversa
                </button>
              )}
            </div>
          ) : (
            clientList.map((client) => (
              <ClientListItem
                key={client.conversationId}
                client={client}
                selected={client.clientId === selectedClientId}
                onClick={() => client.clientId && handleSelectClient(client.clientId)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — conversation */}
      <div className={cn(
        "flex-1 flex-col overflow-hidden",
        selectedClientId ? "flex" : "hidden md:flex",
      )}>
        {selectedClient ? (
          <ConversationMessages
            key={selectedClient.conversationId}
            clientId={selectedClient.clientId!}
            client={selectedClient}
            onBack={handleBack}
            channels={availableChannels}
            userRole={user?.role ?? "vendedor"}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700/50 mb-5">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">
              Selecione uma conversa
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-[240px]">
              Escolha um cliente na lista para ver o histórico de mensagens.
            </p>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newConvOpen}
        onOpenChange={setNewConvOpen}
        onSelect={handleSelectClient}
      />
    </div>
  );
}
