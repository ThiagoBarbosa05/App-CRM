import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageSquare,
  Bot,
  UserCircle,
  Image as ImageIcon,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Video,
  File,
  Mic,
  MapPin,
  User,
  Calendar,
} from "lucide-react";

interface UmblerMessage {
  id: string;
  content: string | null;
  messageType: string;
  source: "Bot" | "Member" | "Contact";
  isPrivate: boolean;
  createdAtUTC: string;
  eventAtUTC: string;
  sentByOrganizationMember: { id: string } | null;
  botInstance: { botName: string; id: string } | null;
  file: {
    url: string;
    contentType: string;
    originalName: string;
    caption: string | null;
  } | null;
}

interface UmblerChat {
  id: string;
  channel: {
    name: string;
    phoneNumber: string;
  };
  contact: {
    name: string;
    phoneNumber: string;
  };
  lastMessage: UmblerMessage;
  latestMessages: UmblerMessage[];
  createdAtUTC: string;
  open: boolean;
  totalUnread: number;
}

interface UmblerContactConversationsTabProps {
  contactPhoneNumber: string | undefined;
}

export function UmblerContactConversationsTab({
  contactPhoneNumber,
}: UmblerContactConversationsTabProps) {
  const { user } = useAuth();

  const { data: conversation, isLoading } = useQuery<UmblerChat | null>({
    queryKey: ["umbler-contact-conversations", contactPhoneNumber],
    queryFn: async () => {
      if (!contactPhoneNumber) return null;
      const params = new URLSearchParams({
        organizationId: "aGx7Jh43-au36EGi", // Mantenha o ID da organização
        phoneNumber: contactPhoneNumber,
      });
      if (user?.serviceChannelId) {
        params.append("channelId", user.serviceChannelId);
      }

      const res = await fetch(
        `/api/umbler/contacts/conversations?${params.toString()}`
      );
      if (!res.ok) {
        console.error("Erro ao buscar conversas:", res.status, res.statusText);
        return null;
      }
      const data = await res.json();
      return data;
    },
    enabled: !!contactPhoneNumber,
  });

  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case "Image":
        return <ImageIcon className="h-4 w-4" />;
      case "Video":
        return <Video className="h-4 w-4" />;
      case "Audio":
        return <Mic className="h-4 w-4" />;
      case "Document":
        return <FileText className="h-4 w-4" />;
      case "Location":
        return <MapPin className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="pb-6"
    >
      <div className="space-y-6">
          {/* Conversation Header Card */}
          {conversation && (
            <div className="bg-white/60 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] sticky top-0 z-10 backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center border border-blue-500/20 shadow-inner">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 mb-0.5 truncate text-sm sm:text-base">
                      {conversation.channel?.name || "Canal desconhecido"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded shrink-0">
                        <Phone className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium font-mono text-slate-600 dark:text-slate-300 truncate">
                        {conversation.channel?.phoneNumber}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {conversation.totalUnread > 0 && (
                    <Badge variant="destructive" className="gap-1 px-2.5 py-1 text-[11px] sm:text-xs shadow-sm shadow-red-500/20 whitespace-nowrap leading-none">
                      <MessageSquare className="h-3 w-3" />
                      {conversation.totalUnread} não lida{conversation.totalUnread !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <div
                    className={`inline-flex items-center gap-1 text-[11px] sm:text-xs px-2.5 py-1 sm:py-1.5 rounded-full font-semibold shadow-sm border whitespace-nowrap leading-none ${
                      conversation.open
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {conversation.open ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {conversation.open ? "Conversa Aberta" : "Fechada"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages List */}
          {isLoading ? (
            <div className="space-y-4 pt-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2.5">
                      <Skeleton className="h-4 w-32 rounded-md" />
                      <Skeleton className="h-3 w-40 rounded-md opacity-70" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : conversation?.latestMessages &&
            conversation.latestMessages.length > 0 ? (
            <div className="space-y-5 pt-2">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700/50">
                  <Clock className="h-3.5 w-3.5 opacity-70" />
                  Histórico de Mensagens
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
              </div>

              {conversation.latestMessages.map((message: UmblerMessage) => {
                const isBot = message.source === "Bot";
                const isMember = message.source === "Member";
                const isPrivate = message.isPrivate;

                // Determine bubble alignment and styling based on source
                // Outgoing (from us/bot): align right. Incoming (from contact): align left.
                const isOutgoing = isBot || isMember;

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col w-full ${isOutgoing ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`relative w-[92%] sm:max-w-[85%] lg:max-w-[75%] rounded-3xl p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md border ${
                        isPrivate
                          ? "border-amber-200/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 rounded-tr-[4px]"
                          : isOutgoing
                          ? "border-blue-200/80 dark:border-blue-800/60 bg-blue-50/90 dark:bg-blue-900/20 rounded-tr-[4px]"
                          : "border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 rounded-tl-[4px]"
                      }`}
                    >
                      {/* Message Header (Sender Info & Meta) */}
                      <div className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-3 pb-3 border-b ${isPrivate ? "border-amber-200/50 dark:border-amber-800/30" : isOutgoing ? "border-blue-200/50 dark:border-blue-800/30" : "border-slate-100 dark:border-slate-700/50"}`}>
                        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[150px]">
                          {isBot ? (
                            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800">
                              <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                          ) : isMember ? (
                            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800">
                              <UserCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <User className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                            </div>
                          )}

                          <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 px-0.5 truncate max-w-[120px] sm:max-w-none">
                            {isBot
                              ? message.botInstance?.botName || "Assistente Virtual"
                              : isMember
                              ? "Equipe"
                              : "Contato"}
                          </span>

                          {isPrivate && (
                            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 sm:px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60 whitespace-nowrap ml-1">
                              🔒 Interna
                            </span>
                          )}

                          {message.messageType !== "Text" && (
                             <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap ml-1">
                             {getMessageIcon(message.messageType)}
                             {message.messageType}
                           </span>
                          )}
                        </div>

                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0 pt-0.5">
                          <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          {format(
                            new Date(message.createdAtUTC),
                            "dd/MM HH:mm"
                          )}
                        </span>
                      </div>

                      {/* Message Content */}
                      <div className="text-[15px] leading-relaxed relative">
                        {message.messageType === "Image" && message.file ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-950/20 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-slate-800/50 backdrop-blur-sm">
                              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded shrink-0">
                                <ImageIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="font-semibold truncate">
                                {message.file.originalName}
                              </span>
                            </div>
                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/50">
                              <img
                                src={message.file.url}
                                alt={message.file.caption || "Imagem enviada"}
                                className="w-full h-auto max-h-[300px] object-contain transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                            {message.file.caption && (
                              <p className="text-sm text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-950/20 p-3 rounded-lg italic border-l-4 border-slate-300 dark:border-slate-600">
                                {message.file.caption}
                              </p>
                            )}
                          </div>
                        ) : message.content ? (
                          <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${isOutgoing ? "text-slate-800 dark:text-slate-200" : "text-slate-700 dark:text-slate-300"}`}>
                            <p className="whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-lg border border-slate-100 dark:border-slate-800/50">
                            <File className="h-4 w-4 opacity-70 shrink-0" />
                            <span className="italic leading-snug">Mensagem sem conteúdo de texto. Verifique o aplicativo.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 mt-4">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700/50 mb-5">
                <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Nenhuma mensagem
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                As conversas sincronizadas do uTalk com este contato aparecerão
                aqui. Comece enviando uma mensagem.
              </p>
            </div>
          )}
        </div>
    </motion.div>
  );
}
