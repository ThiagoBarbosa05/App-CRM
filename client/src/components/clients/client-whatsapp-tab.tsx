import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useAvailableWaChannels,
  useClientConversation,
  useClientConversationCapabilities,
  useClientConversationStream,
  useSendClientMedia,
  useSendClientMessage,
  useStartClientConversation,
  type ClientWaMessage,
  type WaChannel,
} from "@/hooks/use-client-whatsapp-conversation";
import { useToggleWhatsappOptOut } from "@/hooks/use-whatsapp-opt-out";

interface ClientWhatsAppTabProps {
  clientId: string;
  clientPhone: string;
  clientName: string;
  clientEmail?: string;
  whatsappOptOut?: boolean | null;
  isOpen: boolean;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function ClientWhatsAppTab({
  clientId,
  clientPhone,
  whatsappOptOut,
  isOpen,
}: ClientWhatsAppTabProps) {
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toggleOptOut = useToggleWhatsappOptOut();
  const isOptedOut = !!whatsappOptOut;

  const enabled = isOpen && !!clientId;

  const {
    messages,
    conversationExists,
    lastInboundAt,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useClientConversation(clientId, enabled);

  const { data: capabilities } = useClientConversationCapabilities(
    clientId,
    enabled && conversationExists === true,
  );

  useClientConversationStream(clientId, enabled && conversationExists === true);

  const startConversation = useStartClientConversation(clientId);
  const sendMessage = useSendClientMessage(clientId);
  const sendMedia = useSendClientMedia(clientId);

  const { data: waChannels = [] } = useAvailableWaChannels(
    enabled && conversationExists === false,
  );
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  useEffect(() => {
    if (waChannels.length > 0 && selectedChannelId == null) {
      setSelectedChannelId(waChannels[0].id);
    }
  }, [waChannels, selectedChannelId]);

  const isCloudApi = capabilities?.provider === "cloud_api";
  const windowOpen = lastInboundAt ? Date.now() - new Date(lastInboundAt).getTime() < WINDOW_MS : false;
  const windowClosed = isCloudApi && !windowOpen;

  const hasScrolledRef = useRef(false);
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    if (isLoading) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: hasScrolledRef.current ? "smooth" : "auto",
    });
    hasScrolledRef.current = true;
  }, [isLoading, lastMessageId]);

  const handleSend = () => {
    const text = message.trim();
    if (!text || windowClosed || sendMessage.isPending) return;
    setMessage("");
    sendMessage.mutate(text);
  };

  const handleAttach = async (file: File | null) => {
    if (!file || windowClosed) return;
    setIsUploading(true);
    try {
      await sendMedia.mutateAsync({ file });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
      <CardHeader className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_28%),linear-gradient(135deg,#f7fff8_0%,#ffffff_46%,#f3fbf5_100%)] px-6 py-6 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.24),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.92)_60%,rgba(24,39,33,0.95)_100%)]">
        <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-green-200/50 blur-3xl dark:bg-green-500/20" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/70 bg-white/80 shadow-[0_18px_40px_-26px_rgba(22,163,74,0.45)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/75">
              <FaWhatsapp className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-green-700 shadow-sm hover:bg-green-50 dark:border-green-800/70 dark:bg-green-500/10 dark:text-green-300">
                  Canal WhatsApp
                </Badge>
                {clientPhone && (
                  <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {clientPhone}
                  </Badge>
                )}
                {isOptedOut && (
                  <Badge className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-800/70 dark:bg-rose-500/10 dark:text-rose-300">
                    <BellOff className="mr-1 h-3 w-3" />
                    Não recebe marketing
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Conversa
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                Converse diretamente com o cliente pelo WhatsApp do CRM.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-6 py-6">
        <div
          className={cn(
            "flex flex-col gap-3 rounded-[20px] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
            isOptedOut
              ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20"
              : "border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60",
          )}
        >
          <div className="flex items-start gap-3">
            {isOptedOut ? (
              <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            ) : (
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isOptedOut
                  ? "Cliente optou por não receber marketing"
                  : "Cliente recebe mensagens de marketing"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Controla se este contato entra em campanhas e bots disparados por campanha no WhatsApp.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={toggleOptOut.isPending}
            onClick={() => toggleOptOut.mutate({ clientId, optedOut: !isOptedOut })}
            className={cn(
              "h-9 shrink-0 rounded-lg text-xs font-bold",
              isOptedOut
                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-300"
                : "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800/60 dark:text-rose-300",
            )}
          >
            {toggleOptOut.isPending
              ? "Atualizando..."
              : isOptedOut
                ? "Reativar marketing"
                : "Marcar opt-out"}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[320px] rounded-[24px]" />
          </div>
        ) : conversationExists === false ? (
          <EmptyConversationPanel
            channels={waChannels}
            selectedChannelId={selectedChannelId}
            onSelectChannel={setSelectedChannelId}
            isPending={startConversation.isPending}
            onStart={() =>
              startConversation.mutate(selectedChannelId ?? undefined)
            }
          />
        ) : (
          <div className="flex flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_35px_-35px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/75">
            <div className="flex max-h-[440px] min-h-[280px] flex-col gap-2 overflow-y-auto bg-slate-50/70 px-4 py-4 dark:bg-slate-950/40">
              {hasNextPage && (
                <div className="flex justify-center pb-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    className="h-8 rounded-full text-xs font-bold text-slate-500"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Carregar mensagens anteriores
                  </Button>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  Nenhuma mensagem por aqui ainda.
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/75">
              {windowClosed && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    A janela de 24h desta conversa foi encerrada. Para retomar o contato, envie um
                    template pelo módulo de WhatsApp.
                  </span>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleAttach(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={windowClosed || isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 w-11 shrink-0 rounded-xl"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    windowClosed
                      ? "Janela de atendimento encerrada"
                      : "Digite sua mensagem para o cliente..."
                  }
                  disabled={windowClosed}
                  className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm shadow-inner focus-visible:ring-green-500 dark:border-slate-700 dark:bg-slate-950"
                />
                <Button
                  onClick={handleSend}
                  disabled={sendMessage.isPending || !message.trim() || windowClosed}
                  className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,163,74,0.55)] transition-all hover:translate-y-[-1px] hover:from-green-700 hover:to-emerald-600"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyConversationPanel({
  channels,
  selectedChannelId,
  onSelectChannel,
  isPending,
  onStart,
}: {
  channels: WaChannel[];
  selectedChannelId: number | null;
  onSelectChannel: (id: number) => void;
  isPending: boolean;
  onStart: () => void;
}) {
  const noAccessibleChannel = channels.length === 0;

  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-4 rounded-full bg-white p-3 shadow-sm dark:bg-slate-800">
        <FaWhatsapp className="h-8 w-8 text-green-500" />
      </div>
      <h4 className="mb-1 text-lg font-black text-slate-900 dark:text-slate-100">
        Nenhuma conversa ativa
      </h4>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {noAccessibleChannel
          ? "Você não tem acesso a nenhum canal de WhatsApp para iniciar esta conversa."
          : "Escolha o canal e inicie uma conversa no WhatsApp para começar a interagir com este cliente."}
      </p>

      {channels.length > 1 && (
        <Select
          value={selectedChannelId != null ? String(selectedChannelId) : undefined}
          onValueChange={(v) => onSelectChannel(Number(v))}
        >
          <SelectTrigger className="mt-5 h-11 w-full max-w-xs rounded-xl text-sm">
            <SelectValue placeholder="Selecione o canal" />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
                {c.displayPhone ? ` — ${c.displayPhone}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        disabled={isPending || noAccessibleChannel || selectedChannelId == null}
        onClick={onStart}
        className="mt-6 h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,163,74,0.55)] transition-all hover:translate-y-[-1px] hover:from-green-700 hover:to-emerald-600"
      >
        <RefreshCw className={cn("mr-2 h-4 w-4", isPending && "animate-spin")} />
        {isPending ? "Iniciando..." : "Iniciar conversa"}
      </Button>
    </div>
  );
}

function MessageBubble({ message }: { message: ClientWaMessage }) {
  const isOutbound = message.direction === "outbound";
  const timeLabel = new Date(message.sentAt ?? message.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mediaUrl = message.media?.id ? `/api/whatsapp/media/${message.media.id}` : null;
  const failed = message.status === "failed";

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isOutbound
            ? "rounded-br-sm bg-emerald-500 text-white"
            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
        )}
      >
        {message.type === "image" && mediaUrl ? (
          <img src={mediaUrl} alt={message.caption ?? "imagem"} className="mb-1 max-h-64 rounded-lg object-cover" />
        ) : message.type === "video" && mediaUrl ? (
          <video src={mediaUrl} controls className="mb-1 max-h-64 rounded-lg" />
        ) : message.type !== "text" && message.type !== "template" && mediaUrl ? (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5",
              isOutbound ? "bg-emerald-600/40" : "bg-slate-100 dark:bg-slate-700",
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs font-medium">
              {message.media?.filename ?? "Arquivo"}
            </span>
          </a>
        ) : null}

        {(message.content || message.caption) && (
          <p className="whitespace-pre-wrap break-words">{message.content ?? message.caption}</p>
        )}

        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            isOutbound ? "text-emerald-50/80" : "text-slate-400",
          )}
        >
          {failed && <AlertCircle className="h-3 w-3 text-rose-200" />}
          <span>{timeLabel}</span>
          {isOutbound && !failed && (
            message.status === "read" ? (
              <CheckCheck className="h-3 w-3" />
            ) : message.status === "delivered" ? (
              <CheckCheck className="h-3 w-3 opacity-70" />
            ) : (
              <Check className="h-3 w-3 opacity-70" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
