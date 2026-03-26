import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  AlertCircle,
  Bot,
  Check,
  MessageSquareMore,
  RefreshCw,
  Send,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  useUmblerContact,
  useUmblerContactChats,
  useUmblerBot,
  useCreateUmblerChat,
  usePendingUmblerChatCreation,
  useSyncUmblerCustomer,
  useSendUmblerMessage,
  useStartUmblerBot,
  getPendingUmblerChatCreationQueryKey,
  UMBLER_CHAT_CONFIRMATION_TIMEOUT_MS,
} from "@/hooks/use-umbler";
import { toast } from "@/hooks/use-toast";

interface ClientWhatsAppTabProps {
  clientId: string;
  clientPhone: string;
  clientName: string;
  clientEmail?: string;
  isOpen: boolean; // Utilizado para não disparar hooks atoa se a aba/modal não estiver aberto
}

export function ClientWhatsAppTab({
  clientId,
  clientPhone,
  clientName,
  clientEmail,
  isOpen,
}: ClientWhatsAppTabProps) {
  const [message, setMessage] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirmationToastShownRef = useRef(false);
  const timeoutToastShownRef = useRef(false);

  const { data: umblerContact, isLoading: isLoadingContact } = useUmblerContact(
    clientPhone,
    !!clientPhone && isOpen,
  );

  const {
    data: contactChat,
    isLoading: isLoadingChats,
    isError: isContactChatError,
  } = useUmblerContactChats(clientPhone, user?.id, !!clientPhone && isOpen);

  const { data: pendingChatCreation } = usePendingUmblerChatCreation(
    clientPhone,
  );

  const { data: welcomeBot, isLoading: isLoadingWelcomeBot } = useUmblerBot(
    "vindas",
    user?.id,
    user?.role,
    !!clientPhone && isOpen,
  );

  const { data: inactiveBot, isLoading: isLoadingInactiveBot } = useUmblerBot(
    "inativo",
    user?.id,
    user?.role,
    !!clientPhone && isOpen,
  );

  const createChatMutation = useCreateUmblerChat(user?.id, user?.role);
  const syncCustomer = useSyncUmblerCustomer(user?.id, user?.role);
  const sendMessageMutation = useSendUmblerMessage(user?.id, user?.role);
  const startBotOnChatMutation = useStartUmblerBot(user?.id, user?.role);
  const hasConfirmedChat = (contactChat?.items?.length ?? 0) > 0;
  const pendingStatus = pendingChatCreation?.status ?? "idle";
  const isWaitingForChatConfirmation =
    pendingStatus === "creating" || pendingStatus === "waiting_confirmation";
  const hasPendingChatFailure = pendingStatus === "failed";
  const shouldShowEmptyState =
    !hasConfirmedChat && !isWaitingForChatConfirmation && !hasPendingChatFailure;

  useEffect(() => {
    if (!clientPhone || !pendingChatCreation) {
      return;
    }

    if (hasConfirmedChat && isWaitingForChatConfirmation) {
      queryClient.setQueryData(
        getPendingUmblerChatCreationQueryKey(clientPhone),
        {
          status: "idle",
          requestedAt: null,
          lastKnownChatId: contactChat?.items?.[0]?.id ?? null,
          attemptCount: pendingChatCreation.attemptCount,
        },
      );

      if (!confirmationToastShownRef.current) {
        toast({
          title: "Chat confirmado",
          description: "Chat confirmado e pronto para uso.",
        });
        confirmationToastShownRef.current = true;
      }

      timeoutToastShownRef.current = false;
      return;
    }

    if (pendingStatus === "idle") {
      confirmationToastShownRef.current = false;
      timeoutToastShownRef.current = false;
    }
  }, [
    clientPhone,
    contactChat?.items,
    hasConfirmedChat,
    isWaitingForChatConfirmation,
    pendingChatCreation,
    pendingStatus,
    queryClient,
  ]);

  useEffect(() => {
    if (!clientPhone || pendingStatus !== "waiting_confirmation") {
      return;
    }

    const requestedAt = pendingChatCreation?.requestedAt;
    if (!requestedAt) {
      return;
    }

    const elapsed = Date.now() - requestedAt;
    const remainingMs = UMBLER_CHAT_CONFIRMATION_TIMEOUT_MS - elapsed;

    if (remainingMs <= 0) {
      queryClient.setQueryData(
        getPendingUmblerChatCreationQueryKey(clientPhone),
        {
          status: "failed",
          requestedAt,
          lastKnownChatId: pendingChatCreation?.lastKnownChatId ?? null,
          attemptCount: pendingChatCreation?.attemptCount ?? 1,
        },
      );

      if (!timeoutToastShownRef.current) {
        toast({
          title: "Confirmação pendente",
          description:
            "O Umbler ainda não confirmou o chat; tente atualizar em instantes.",
          variant: "destructive",
        });
        timeoutToastShownRef.current = true;
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      queryClient.setQueryData(
        getPendingUmblerChatCreationQueryKey(clientPhone),
        {
          status: "failed",
          requestedAt,
          lastKnownChatId: pendingChatCreation?.lastKnownChatId ?? null,
          attemptCount: pendingChatCreation?.attemptCount ?? 1,
        },
      );

      if (!timeoutToastShownRef.current) {
        toast({
          title: "Confirmação pendente",
          description:
            "O Umbler ainda não confirmou o chat; tente atualizar em instantes.",
          variant: "destructive",
        });
        timeoutToastShownRef.current = true;
      }
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clientPhone, pendingChatCreation, pendingStatus, queryClient]);

  return (
    <Card className="border border-green-200 dark:border-green-900 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="bg-green-50/50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/50">
        <CardTitle className="text-lg flex items-center text-green-800 dark:text-green-400 gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/60 rounded-lg">
            <FaWhatsapp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          WhatsApp Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {isLoadingContact ? (
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-green-500" />
            <p className="text-sm font-medium">
              Verificando status do WhatsApp...
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Status da Sincronização</span>
                {umblerContact ? (
                  <div className="flex items-center mt-1">
                     <Badge
                      className="bg-green-100 border-none px-3 py-1 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-semibold"
                      variant="outline"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Sincronizado
                    </Badge>
                  </div>
                ) : (
                  <span className="text-sm text-slate-700 dark:text-slate-300 mt-1">Não sincronizado</span>
                )}
              </div>
              
              {!umblerContact && (
                <Button
                  size="sm"
                  disabled={syncCustomer.isPending}
                  onClick={() => {
                    syncCustomer.mutate({
                      phoneNumber: clientPhone,
                      organizationId: "aGx7Jh43-au36EGi",
                      name: clientName,
                      email: clientEmail || "nao_informado@email.com",
                    });
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center w-full sm:w-auto"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4 mr-2",
                      syncCustomer.isPending && "animate-spin",
                    )}
                  />
                  {syncCustomer.isPending
                    ? "Sincronizando..."
                    : "Sincronizar com WhatsApp"}
                </Button>
              )}
            </div>

            {umblerContact && (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                {isLoadingChats ? (
                  <div className="space-y-3">
                    <Skeleton className="h-[60px] w-full rounded-md" />
                    <Skeleton className="h-[120px] w-full rounded-md" />
                  </div>
                ) : isContactChatError ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center bg-red-50 dark:bg-red-950/20 rounded-xl border border-dashed border-red-200 dark:border-red-900/40">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                      Erro ao consultar o chat
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                      Não foi possível verificar as conversas do cliente no
                      Umbler agora.
                    </p>
                  </div>
                ) : (
                  <>
                    {hasConfirmedChat ? (
                      <div className="space-y-6">
                        <div className="bg-blue-50/50 dark:bg-slate-900/80 p-4 rounded-xl border border-blue-100 dark:border-slate-800">
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
                            <MessageSquareMore className="h-4 w-4" />
                            Última mensagem enviada:
                          </p>
                          {contactChat.items[0].lastMessage ? (
                            <div className="bg-white p-4 rounded-lg border border-slate-200 dark:bg-slate-950 dark:border-slate-800 shadow-sm relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"></div>
                              <p className="text-sm text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap">
                                "{contactChat.items[0].lastMessage.content}"
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 italic">
                              Nenhuma mensagem enviada ainda.
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Envie uma nova mensagem
                          </p>
                          <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Digite sua mensagem para o cliente..."
                            className="resize-none border-slate-300 focus-visible:ring-green-500 dark:border-slate-700 min-h-[100px] bg-white dark:bg-slate-950"
                          />
                          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
                            <div className="flex-1 flex flex-wrap gap-2">
                              {isLoadingInactiveBot && isLoadingWelcomeBot ? (
                                <Skeleton className="w-[140px] h-[36px]" />
                              ) : (
                                <>
                                  {welcomeBot?.result
                                    .filter(
                                      (bot: any) =>
                                        bot.title === "Fluxo BOAS VINDAS",
                                    )
                                    .map((bot: any) => (
                                      <Button
                                        key={`bot-welcome-${bot.id}`}
                                        onClick={async () =>
                                          startBotOnChatMutation.mutateAsync({
                                            botId: bot.id,
                                            chatId: contactChat.items[0].id,
                                            phone: clientPhone,
                                            triggerName: "Boas vindas",
                                          })
                                        }
                                        disabled={
                                          startBotOnChatMutation.isPending
                                        }
                                        size="sm"
                                        variant="outline"
                                        className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50 dark:hover:bg-indigo-900/50"
                                      >
                                        <Bot className="h-4 w-4 mr-2" />
                                        {startBotOnChatMutation.isPending
                                          ? "Iniciando..."
                                          : bot.title}
                                      </Button>
                                    ))}

                                  {inactiveBot?.result
                                    .filter(
                                      (bot: any) => bot.title === "campanha INATIVOS",
                                    )
                                    .map((bot: any) => (
                                      <Button
                                        key={`bot-inactive-${bot.id}`}
                                        onClick={async () =>
                                          startBotOnChatMutation.mutateAsync({
                                            botId: bot.id,
                                            chatId: contactChat.items[0].id,
                                            phone: clientPhone,
                                            triggerName: "Início",
                                          })
                                        }
                                        disabled={
                                          startBotOnChatMutation.isPending
                                        }
                                        size="sm"
                                        variant="outline"
                                        className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50 dark:hover:bg-amber-900/50"
                                      >
                                        <Bot className="h-4 w-4 mr-2" />
                                        {startBotOnChatMutation.isPending
                                          ? "Iniciando..."
                                          : bot.title}
                                      </Button>
                                    ))}
                                </>
                              )}
                            </div>

                            <Button
                              onClick={() => {
                                sendMessageMutation.mutate({
                                  chatId: contactChat?.items[0]?.id,
                                  message,
                                });
                                // Limpa a mensagem após o envio proativamente
                                setMessage("");
                              }}
                              disabled={sendMessageMutation.isPending || !message.trim()}
                              className="bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {sendMessageMutation.isPending
                                ? "Enviando..."
                                : "Enviar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : isWaitingForChatConfirmation ? (
                      <div className="py-8 flex flex-col items-center justify-center text-center bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/40">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                          <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                        </div>
                        <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {pendingStatus === "creating"
                            ? "Criando chat"
                            : "Aguardando confirmação do Umbler"}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-3">
                          A solicitação foi enviada e estamos verificando
                          automaticamente quando o chat ficar disponível.
                        </p>
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          Tentativa {pendingChatCreation?.attemptCount ?? 1}
                        </Badge>
                      </div>
                    ) : hasPendingChatFailure ? (
                      <div className="py-8 flex flex-col items-center justify-center text-center bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/40">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                          <AlertCircle className="h-8 w-8 text-amber-500" />
                        </div>
                        <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                          Chat ainda não confirmado
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                          O Umbler ainda não confirmou este chat. Você pode
                          tentar novamente em instantes se ele continuar sem
                          aparecer.
                        </p>
                        <Button
                          disabled={createChatMutation.isPending}
                          onClick={() =>
                            createChatMutation.mutate({
                              contactId: umblerContact.id,
                              phone: clientPhone,
                            })
                          }
                          className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        >
                          <MessageSquareMore className="h-4 w-4 mr-2" />
                          {createChatMutation.isPending
                            ? "Criando..."
                            : "Tentar criar novamente"}
                        </Button>
                      </div>
                    ) : shouldShowEmptyState ? (
                      <div className="py-8 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                          <MessageSquareMore className="h-8 w-8 text-green-500" />
                        </div>
                        <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                          Nenhum chat ativo
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                          Inicie uma conversa no WhatsApp para começar a interagir com este cliente.
                        </p>
                        <Button
                          disabled={createChatMutation.isPending}
                          onClick={async () =>
                            createChatMutation.mutateAsync({
                              contactId: umblerContact.id,
                              phone: clientPhone,
                            })
                          }
                          className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        >
                          <MessageSquareMore className="h-4 w-4 mr-2" />
                          {createChatMutation.isPending
                            ? "Criando..."
                            : "Criar chat no WhatsApp"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
