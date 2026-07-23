import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageSquareText, Paperclip, Send, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  useInternalConversations,
  useInternalMessages,
  useStartDmConversation,
  useSendInternalMessage,
  useMarkInternalRead,
  useInternalChatNotifications,
  useInternalConversationStream,
  type ChatTab,
  type InternalConversationSummary,
} from "@/hooks/useInternalChat";
import { CreateGroupDialog } from "./create-group-dialog";
import { GroupMembersDialog } from "./group-members-dialog";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface InternalChatPanelProps {
  onExit: () => void;
}

/**
 * Chat interno da equipe (DM + grupos) — módulo autocontido, desacoplado do
 * atendimento a cliente (whatsappConversations). Acessado pelo botão "Equipe"
 * na sidebar de conversas do WhatsApp, ao lado de Abertas/Encerradas.
 */
export function InternalChatPanel({ onExit }: InternalChatPanelProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<ChatTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useInternalChatNotifications();

  const { data: conversations = [], isLoading: loadingList } = useInternalConversations(tab, search);
  const startDm = useStartDmConversation();

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );
  const isPending = selectedId?.startsWith("pending:") ?? false;

  const { data: messages = [] } = useInternalMessages(isPending ? null : selectedId);
  useInternalConversationStream(isPending ? null : selectedId);
  const sendMessage = useSendInternalMessage(selectedId);
  const markRead = useMarkInternalRead(selectedId);

  useEffect(() => {
    if (selectedId && !isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSelect(conversation: InternalConversationSummary) {
    if (conversation.id.startsWith("pending:") && conversation.otherUser) {
      const created = await startDm.mutateAsync(conversation.otherUser.id);
      setSelectedId(created.id);
      return;
    }
    setSelectedId(conversation.id);
  }

  async function handleSend() {
    if (!messageDraft.trim() || !selectedId || isPending) return;
    const content = messageDraft.trim();
    setMessageDraft("");
    await sendMessage.mutateAsync({ content });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId || isPending) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Falha no upload");
      const data = (await res.json()) as { url: string; fileType: string };
      await sendMessage.mutateAsync({
        mediaKey: data.url,
        mimeType: data.fileType,
        fileName: file.name,
        sizeBytes: file.size,
      });
    } finally {
      setUploading(false);
    }
  }

  const conversationLabel = selectedConversation
    ? selectedConversation.type === "group"
      ? selectedConversation.name
      : selectedConversation.otherUser?.name
    : "";

  return (
    <div className="flex h-full overflow-hidden w-full">
      {/* Left panel — conversation list */}
      <div
        className={cn(
          "flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full md:w-80 lg:w-96",
          selectedId ? "hidden md:flex" : "flex",
        )}
      >
        <div className="px-3 py-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-primary"
              title="Voltar para atendimento"
            >
              <ArrowLeft className="h-4 w-4" />
              Chat da Equipe
            </button>
            {tab === "groups" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-primary"
                onClick={() => setCreateGroupOpen(true)}
                title="Criar grupo"
              >
                <UsersRound className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da conversa"
            className="text-sm h-10 mb-2.5"
          />
          <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
            {(
              [
                { key: "all", label: "Todos" },
                { key: "attendants", label: "Atendentes" },
                { key: "groups", label: "Grupos" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setTab(opt.key);
                  setSelectedId(null);
                }}
                className={cn(
                  "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
                  tab === opt.key
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList && (
            <div className="p-4 text-sm text-slate-400 text-center">Carregando...</div>
          )}
          {!loadingList && conversations.length === 0 && (
            <div className="p-4 text-sm text-slate-400 text-center">
              Nenhuma conversa encontrada
            </div>
          )}
          {conversations.map((conversation) => {
            const label =
              conversation.type === "group" ? conversation.name : conversation.otherUser?.name;
            return (
              <button
                key={conversation.id}
                onClick={() => handleSelect(conversation)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  selectedId === conversation.id && "bg-slate-100 dark:bg-slate-800",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className={conversation.type === "group" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : undefined}>
                    {conversation.type === "group" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      initials(label || "?")
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {label}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {conversation.lastMessagePreview ??
                        (conversation.type === "dm" && tab === "attendants"
                          ? conversation.otherUser?.email
                          : "Nenhuma mensagem ainda")}
                    </span>
                    {conversation.unreadCount > 0 && (
                      <Badge className="h-[18px] px-1.5 text-[10px] shrink-0">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel — thread */}
      <div className={cn("flex-1 flex-col bg-slate-50 dark:bg-slate-950", selectedId ? "flex" : "hidden md:flex")}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <MessageSquareText className="h-10 w-10" />
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <button className="md:hidden" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </button>
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {selectedConversation?.type === "group" ? (
                    <Users className="h-4 w-4" />
                  ) : (
                    initials(conversationLabel || "?")
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex-1 truncate">
                {conversationLabel}
              </span>
              {selectedConversation?.type === "group" && (
                <Button variant="ghost" size="sm" onClick={() => setManageMembersOpen(true)}>
                  Membros
                </Button>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {isPending && (
                <p className="text-xs text-center text-slate-400">
                  Envie a primeira mensagem para iniciar a conversa
                </p>
              )}
              {messages.map((message) => {
                const isMine = message.senderId === user?.id;
                if (message.type === "system") {
                  return (
                    <p key={message.id} className="text-[11px] text-center text-slate-400 my-1">
                      {message.content}
                    </p>
                  );
                }
                return (
                  <div key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        isMine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700",
                      )}
                    >
                      {message.media.map((media) =>
                        media.mimeType.startsWith("image/") ? (
                          <img
                            key={media.id}
                            src={media.url}
                            alt={media.fileName ?? "anexo"}
                            className="rounded-lg max-w-full mb-1"
                          />
                        ) : (
                          <a
                            key={media.id}
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-xs block mb-1"
                          >
                            {media.fileName ?? "Anexo"}
                          </a>
                        ),
                      )}
                      {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                      <span
                        className={cn(
                          "block text-[10px] mt-1",
                          isMine ? "text-primary-foreground/70" : "text-slate-400",
                        )}
                      >
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-2 shrink-0">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Anexar arquivo"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={uploading ? "Enviando anexo..." : "Digite uma mensagem"}
                disabled={uploading}
                className="flex-1"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSend}
                disabled={!messageDraft.trim() || sendMessage.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onCreated={(id) => {
          setCreateGroupOpen(false);
          setSelectedId(id);
        }}
      />
      {selectedConversation?.type === "group" && (
        <GroupMembersDialog
          conversationId={selectedConversation.id}
          open={manageMembersOpen}
          onOpenChange={setManageMembersOpen}
        />
      )}
    </div>
  );
}
