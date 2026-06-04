import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

interface ChatClient {
  id: string;
  name: string;
  phone: string | null;
}

interface WaMessage {
  id: string;
  clientId: string | null;
  phone: string;
  direction: "inbound" | "outbound";
  type: string;
  content: string | null;
  waMessageId: string | null;
  status: string | null;
  sentByUserId: string | null;
  createdAt: string;
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
  const initials = client.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800",
        selected && "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500",
      )}
    >
      <div className="h-10 w-10 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {client.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
          <Phone className="h-3 w-3" />
          {client.phone ?? "Sem telefone"}
        </p>
      </div>
    </button>
  );
}

function ConversationMessages({ clientId }: { clientId: string }) {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<WaMessage[]>({
    queryKey: ["/api/whatsapp/conversations", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/conversations/${clientId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5_000,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/whatsapp/conversations/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao enviar mensagem");
      }
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const text = message.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-14 w-3/4" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700/50 mb-4">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Nenhuma mensagem
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              Comece enviando uma mensagem para este cliente.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-200 dark:border-slate-700/50">
                <Clock className="h-3 w-3" />
                Histórico
              </span>
              <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
            </div>

            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col w-full",
                    isOutbound ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm border",
                      isOutbound
                        ? "bg-blue-50 dark:bg-blue-900/25 border-blue-200/80 dark:border-blue-800/60 rounded-tr-[4px]"
                        : "bg-white dark:bg-slate-800/95 border-slate-200/80 dark:border-slate-700/80 rounded-tl-[4px]",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {isOutbound ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <ArrowDownLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isOutbound ? "Enviado" : "Recebido"}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {format(new Date(msg.createdAt), "dd/MM HH:mm")}
                      </span>
                    </div>
                    {msg.content ? (
                      <p className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed">
                        {msg.content}
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-400 dark:text-slate-500">
                        [{msg.type}]
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            className="resize-none min-h-[40px] max-h-[120px] text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            size="icon"
            className="shrink-0 h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppConversationsPage() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: clientList = [], isLoading: isLoadingClients } = useQuery<ChatClient[]>({
    queryKey: ["/api/whatsapp/conversations-list", debouncedSearch, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/whatsapp/conversations?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedClient = clientList.find((c) => c.id === selectedClientId) ?? null;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left panel — client list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
            Conversas
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="pl-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingClients ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : clientList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum cliente encontrado
              </p>
            </div>
          ) : (
            clientList.map((client) => (
              <ClientListItem
                key={client.id}
                client={client}
                selected={client.id === selectedClientId}
                onClick={() => setSelectedClientId(client.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — conversation */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedClient ? (
          <>
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                {selectedClient.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedClient.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedClient.phone}
                </p>
              </div>
            </div>
            <ConversationMessages clientId={selectedClient.id} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-12">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700/50 mb-5">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Selecione um cliente
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              Escolha um cliente na lista ao lado para ver o histórico de mensagens e conversar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
