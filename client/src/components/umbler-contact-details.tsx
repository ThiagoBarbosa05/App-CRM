import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  MessageSquare, 
  Tag, 
  User, 
  Bot, 
  UserCircle, 
  Image as ImageIcon,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Video,
  File,
  Mic,
  MapPin
} from "lucide-react";

interface UmblerContactDetailsProps {
  contact: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Interface para tipagem do schema da API
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

export function UmblerContactDetails({
  contact,
  open,
  onOpenChange,
}: UmblerContactDetailsProps) {
  const { user } = useAuth();

  const { data: tags } = useQuery({
    queryKey: ["umbler-contact-tags", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const res = await fetch(`/api/umbler/contacts/${contact.id}/tags`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!contact?.id && open,
  });

  const { data: conversation, isLoading: isLoadingConversation } = useQuery<UmblerChat | null>({
    queryKey: ["umbler-contact-conversations", contact?.phoneNumber],
    queryFn: async () => {
      if (!contact?.phoneNumber) return null;
      const params = new URLSearchParams({
        organizationId: "aGx7Jh43-au36EGi",
        phoneNumber: contact.phoneNumber,
      });
      if (user?.serviceChannelId) {
        params.append("channelId", user.serviceChannelId);
      }
      
      const res = await fetch(`/api/umbler/contacts/conversations?${params.toString()}`);
      if (!res.ok) {
        console.error("Erro ao buscar conversas:", res.status, res.statusText);
        return null;
      }
      const data = await res.json();
      return data;
    },
    enabled: !!contact?.phoneNumber && open,
  });

  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[540px] lg:w-[640px] p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
          <SheetTitle className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Detalhes do Contato
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Profile Card */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700 rounded-xl p-6 shadow-sm border border-blue-100 dark:border-slate-600">
              <div className="flex items-start space-x-4">
                {contact.profilePictureUrl ? (
                  <div className="relative">
                    <img 
                      src={contact.profilePictureUrl} 
                      alt={contact.name} 
                      className="h-20 w-20 rounded-full object-cover ring-4 ring-white dark:ring-slate-700 shadow-lg"
                    />
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 ring-4 ring-white dark:ring-slate-700 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center ring-4 ring-white dark:ring-slate-700 shadow-lg">
                    <User className="h-10 w-10 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 truncate">
                    {contact.name || "Sem nome"}
                  </h2>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                      <Phone className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium">{contact.phoneNumber}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                        <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                        <span className="text-sm truncate">{contact.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                <TabsTrigger
                  value="details"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Detalhes
                </TabsTrigger>
                <TabsTrigger
                  value="conversations"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Conversas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
                  <h3 className="mb-4 font-semibold flex items-center gap-2 text-gray-900 dark:text-slate-100">
                    <Tag className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    <span className="text-lg">Etiquetas</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags?.map((tag: any) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="px-3 py-1.5 text-sm font-medium shadow-sm hover:shadow-md transition-shadow"
                        style={{
                          backgroundColor: tag.color,
                          color: tag.color ? "#fff" : undefined,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {(!tags || tags.length === 0) && (
                      <div className="w-full text-center py-6">
                        <Tag className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Nenhuma etiqueta atribuída
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="conversations" className="mt-6">
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-4">
                    {/* Conversation Header Card */}
                    {conversation && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-blue-100 dark:border-slate-600 p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center shadow-md">
                              <MessageSquare className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-slate-100">
                                {conversation.channel?.name || "Canal desconhecido"}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-slate-400 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {conversation.channel?.phoneNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {conversation.totalUnread > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-500 text-white px-2.5 py-1 rounded-full font-medium shadow-sm">
                                <MessageSquare className="h-3 w-3" />
                                {conversation.totalUnread} não {conversation.totalUnread === 1 ? 'lida' : 'lidas'}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shadow-sm ${
                              conversation.open 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                            }`}>
                              {conversation.open ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              {conversation.open ? 'Aberta' : 'Fechada'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Messages List */}
                    {isLoadingConversation ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-32" />
                              </div>
                            </div>
                            <Skeleton className="h-16 w-full" />
                          </div>
                        ))}
                      </div>
                    ) : conversation?.latestMessages && conversation.latestMessages.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-1">
                          <Clock className="h-4 w-4" />
                          Últimas Mensagens
                        </div>
                        {conversation.latestMessages.map((message: UmblerMessage) => {
                          const isBot = message.source === "Bot";
                          const isMember = message.source === "Member";
                          const isPrivate = message.isPrivate;
                          
                          // Função para obter ícone do tipo de mensagem
                          const getMessageIcon = () => {
                            switch (message.messageType) {
                              case "Image": return <ImageIcon className="h-4 w-4" />;
                              case "Video": return <Video className="h-4 w-4" />;
                              case "Audio": return <Mic className="h-4 w-4" />;
                              case "Document": return <FileText className="h-4 w-4" />;
                              case "Location": return <MapPin className="h-4 w-4" />;
                              default: return <MessageSquare className="h-4 w-4" />;
                            }
                          };
                          
                          return (
                            <div
                              key={message.id}
                              className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                                isPrivate 
                                  ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 shadow-sm' 
                                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm'
                              }`}
                            >
                              {/* Message Header */}
                              <div className="flex items-start justify-between mb-3 gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isBot ? (
                                    <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">
                                      <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                        {message.botInstance?.botName || "Bot"}
                                      </span>
                                    </div>
                                  ) : isMember ? (
                                    <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                                      <UserCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                        Membro
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                                      <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Contato
                                      </span>
                                    </div>
                                  )}
                                  
                                  {isPrivate && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-yellow-200 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full font-medium border border-yellow-300 dark:border-yellow-800">
                                      🔒 Privada
                                    </span>
                                  )}
                                  
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                                    {getMessageIcon()}
                                    {message.messageType}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(message.createdAtUTC), "dd/MM/yyyy HH:mm")}
                                </span>
                              </div>
                              
                              {/* Message Content */}
                              <div className="mt-3">
                                {message.messageType === "Image" && message.file ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                                      <ImageIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                                      <span className="font-medium truncate">{message.file.originalName}</span>
                                    </div>
                                    <div className="relative group">
                                      <img 
                                        src={message.file.url} 
                                        alt={message.file.caption || "Imagem"} 
                                        className="w-full rounded-lg border-2 border-gray-200 dark:border-slate-600 shadow-md max-h-64 object-contain bg-gray-50 dark:bg-slate-900"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors rounded-lg" />
                                    </div>
                                    {message.file.caption && (
                                      <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg italic">
                                        {message.file.caption}
                                      </p>
                                    )}
                                  </div>
                                ) : message.content ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                      {message.content}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg italic">
                                    <File className="h-4 w-4" />
                                    <span>Mensagem sem conteúdo de texto</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center shadow-sm">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 mb-4">
                          <MessageSquare className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
                          Nenhuma conversa encontrada
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Este contato ainda não possui histórico de mensagens
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
