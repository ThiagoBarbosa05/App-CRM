import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronRight,
  MessageSquareMore,
  RefreshCw,
  Send,
  Sparkles,
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
  isOpen: boolean;
}

export function ClientWhatsAppTab({
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
  const lastMessage = contactChat?.items?.[0]?.lastMessage?.content;
  const canUseBotActions = !startBotOnChatMutation.isPending && hasConfirmedChat;

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
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Conversa e automações
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                Sincronize o contato, acompanhe o chat e envie mensagens ou fluxos automáticos com acabamento mais claro e operacional.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <StatusSummaryTile
              label="Contato"
              value={umblerContact ? "Sincronizado" : "Pendente"}
              tone={umblerContact ? "success" : "neutral"}
            />
            <StatusSummaryTile
              label="Chat"
              value={
                hasConfirmedChat
                  ? "Ativo"
                  : isWaitingForChatConfirmation
                    ? "Confirmando"
                    : hasPendingChatFailure
                      ? "Falhou"
                      : "Inexistente"
              }
              tone={
                hasConfirmedChat
                  ? "success"
                  : isWaitingForChatConfirmation
                    ? "warning"
                    : hasPendingChatFailure
                      ? "danger"
                      : "neutral"
              }
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-6 py-6">
        {isLoadingContact ? (
          <LoadingPanel />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_35px_-35px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/75">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Status da Sincronização
                    </p>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                      {umblerContact
                        ? "Contato conectado ao Umbler"
                        : "Contato ainda não sincronizado"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {umblerContact
                        ? "O cliente já pode receber interações dentro do fluxo do WhatsApp."
                        : "Sincronize este cadastro para liberar criação de chat e automações."}
                    </p>
                  </div>

                  <Badge
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] shadow-sm",
                      umblerContact
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                    )}
                  >
                    {umblerContact ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        sincronizado
                      </>
                    ) : (
                      "pendente"
                    )}
                  </Badge>
                </div>
              </div>

              {!umblerContact && (
                <div className="rounded-[24px] border border-green-200/80 bg-[linear-gradient(135deg,rgba(240,253,244,0.95),rgba(255,255,255,1))] p-5 shadow-[0_20px_40px_-34px_rgba(22,163,74,0.35)] dark:border-green-900/60 dark:bg-[linear-gradient(135deg,rgba(20,33,26,0.95),rgba(15,23,42,0.98))]">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-green-700 dark:text-green-300">
                    Próximo passo
                  </p>
                  <p className="mt-2 text-base font-black text-slate-900 dark:text-white">
                    Ativar contato no canal
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Esse processo envia o cliente para a base do WhatsApp e prepara o restante do fluxo.
                  </p>
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
                    className="mt-5 h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-4 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,163,74,0.55)] transition-all hover:translate-y-[-1px] hover:from-green-700 hover:to-emerald-600"
                  >
                    <RefreshCw
                      className={cn(
                        "mr-2 h-4 w-4",
                        syncCustomer.isPending && "animate-spin",
                      )}
                    />
                    {syncCustomer.isPending
                      ? "Sincronizando..."
                      : "Sincronizar com WhatsApp"}
                  </Button>
                </div>
              )}
            </div>

            {umblerContact && (
              <div className="space-y-6 border-t border-slate-100 pt-6 dark:border-slate-800">
                {isLoadingChats ? (
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <Skeleton className="h-[240px] rounded-[24px]" />
                    <Skeleton className="h-[240px] rounded-[24px]" />
                  </div>
                ) : isContactChatError ? (
                  <StatePanel
                    icon={AlertCircle}
                    title="Erro ao consultar o chat"
                    description="Não foi possível verificar as conversas do cliente no Umbler agora."
                    tone="danger"
                  />
                ) : (
                  <>
                    {hasConfirmedChat ? (
                      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-6">
                          <div className="rounded-[24px] border border-blue-200/70 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,1))] p-5 shadow-[0_18px_38px_-34px_rgba(59,130,246,0.32)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
                            <div className="mb-4 flex items-center gap-3">
                              <div className="rounded-2xl bg-blue-100 p-2.5 dark:bg-blue-900/30">
                                <MessageSquareMore className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
                                  Última mensagem
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  Histórico mais recente da conversa ativa
                                </p>
                              </div>
                            </div>

                            {lastMessage ? (
                              <div className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                <div className="absolute inset-y-0 left-0 w-1 rounded-l-[22px] bg-blue-500" />
                                <p className="pl-2 text-sm leading-7 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                  {lastMessage}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                Nenhuma mensagem enviada ainda.
                              </div>
                            )}
                          </div>

                          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_35px_-35px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/75">
                            <div className="mb-4 flex items-center gap-3">
                              <div className="rounded-2xl bg-emerald-100 p-2.5 dark:bg-emerald-900/30">
                                <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                  Nova mensagem
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  Use esse espaço para conversar diretamente com o cliente
                                </p>
                              </div>
                            </div>

                            <Textarea
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Digite sua mensagem para o cliente..."
                              className="min-h-[150px] resize-none rounded-[20px] border-slate-200 bg-slate-50/70 px-4 py-3 text-sm shadow-inner focus-visible:ring-green-500 dark:border-slate-700 dark:bg-slate-950"
                            />

                            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                As mensagens são enviadas para o chat ativo no Umbler.
                              </p>
                              <Button
                                onClick={() => {
                                  sendMessageMutation.mutate({
                                    chatId: contactChat?.items[0]?.id,
                                    message,
                                  });
                                  setMessage("");
                                }}
                                disabled={
                                  sendMessageMutation.isPending || !message.trim()
                                }
                                className="h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,163,74,0.55)] transition-all hover:translate-y-[-1px] hover:from-green-700 hover:to-emerald-600"
                              >
                                <Send className="mr-2 h-4 w-4" />
                                {sendMessageMutation.isPending
                                  ? "Enviando..."
                                  : "Enviar mensagem"}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_35px_-35px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/75">
                          <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-2xl bg-violet-100 p-2.5 dark:bg-violet-900/30">
                              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                Fluxos rápidos
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Inicie automações úteis sem sair do perfil
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {isLoadingInactiveBot && isLoadingWelcomeBot ? (
                              <>
                                <Skeleton className="h-[88px] rounded-[20px]" />
                                <Skeleton className="h-[88px] rounded-[20px]" />
                              </>
                            ) : (
                              <>
                                {welcomeBot?.result
                                  .filter(
                                    (bot: { id: string; title: string }) =>
                                      bot.title === "Fluxo BOAS VINDAS",
                                  )
                                  .map((bot: { id: string; title: string }) => (
                                    <BotActionCard
                                      key={`bot-welcome-${bot.id}`}
                                      title={bot.title}
                                      description="Ideal para iniciar relacionamento e retomar o primeiro contato."
                                      tone="violet"
                                      disabled={!canUseBotActions}
                                      isPending={startBotOnChatMutation.isPending}
                                      onClick={() =>
                                        startBotOnChatMutation.mutateAsync({
                                          botId: bot.id,
                                          chatId: contactChat.items[0].id,
                                          phone: clientPhone,
                                          triggerName: "Boas vindas",
                                        })
                                      }
                                    />
                                  ))}

                                {inactiveBot?.result
                                  .filter(
                                    (bot: { id: string; title: string }) =>
                                      bot.title === "campanha INATIVOS",
                                  )
                                  .map((bot: { id: string; title: string }) => (
                                    <BotActionCard
                                      key={`bot-inactive-${bot.id}`}
                                      title={bot.title}
                                      description="Use para reaquecer clientes que estão há mais tempo sem interação."
                                      tone="amber"
                                      disabled={!canUseBotActions}
                                      isPending={startBotOnChatMutation.isPending}
                                      onClick={() =>
                                        startBotOnChatMutation.mutateAsync({
                                          botId: bot.id,
                                          chatId: contactChat.items[0].id,
                                          phone: clientPhone,
                                          triggerName: "Início",
                                        })
                                      }
                                    />
                                  ))}

                                {!welcomeBot?.result?.length &&
                                  !inactiveBot?.result?.length && (
                                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                      Nenhum fluxo disponível no momento.
                                    </div>
                                  )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isWaitingForChatConfirmation ? (
                      <StatePanel
                        icon={RefreshCw}
                        title={
                          pendingStatus === "creating"
                            ? "Criando chat"
                            : "Aguardando confirmação do Umbler"
                        }
                        description="A solicitação foi enviada e estamos verificando automaticamente quando o chat ficar disponível."
                        tone="warning"
                        badgeText={`Tentativa ${pendingChatCreation?.attemptCount ?? 1}`}
                        spinning
                      />
                    ) : hasPendingChatFailure ? (
                      <StatePanel
                        icon={AlertCircle}
                        title="Chat ainda não confirmado"
                        description="O Umbler ainda não confirmou este chat. Você pode tentar novamente em instantes se ele continuar sem aparecer."
                        tone="warning"
                        action={
                          <Button
                            disabled={createChatMutation.isPending}
                            onClick={() =>
                              createChatMutation.mutate({
                                contactId: umblerContact.id,
                                phone: clientPhone,
                              })
                            }
                            className="h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,163,74,0.55)] transition-all hover:translate-y-[-1px] hover:from-green-700 hover:to-emerald-600"
                          >
                            <MessageSquareMore className="mr-2 h-4 w-4" />
                            {createChatMutation.isPending
                              ? "Criando..."
                              : "Tentar criar novamente"}
                          </Button>
                        }
                      />
                    ) : shouldShowEmptyState ? (
                      <StatePanel
                        icon={MessageSquareMore}
                        title="Nenhum chat ativo"
                        description="Inicie uma conversa no WhatsApp para começar a interagir com este cliente."
                        tone="neutral"
                        action={
                          <Button
                            disabled={createChatMutation.isPending}
                            onClick={() =>
                              createChatMutation.mutateAsync({
                                contactId: umblerContact.id,
                                phone: clientPhone,
                              })
                            }
                            className="h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,163,74,0.55)] transition-all hover:translate-y-[-1px] hover:from-green-700 hover:to-emerald-600"
                          >
                            <MessageSquareMore className="mr-2 h-4 w-4" />
                            {createChatMutation.isPending
                              ? "Criando..."
                              : "Criar chat no WhatsApp"}
                          </Button>
                        }
                      />
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

function LoadingPanel() {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/70 px-5 py-4 text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
      <RefreshCw className="h-4 w-4 animate-spin text-green-500" />
      <p className="text-sm font-medium">Verificando status do WhatsApp...</p>
    </div>
  );
}

function StatusSummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    success:
      "border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-500/10 dark:text-emerald-300",
    warning:
      "border-amber-200 bg-amber-50/90 text-amber-700 dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-300",
    danger:
      "border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-800/60 dark:bg-rose-500/10 dark:text-rose-300",
    neutral:
      "border-slate-200 bg-white/85 text-slate-700 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-300",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-3 shadow-sm backdrop-blur-sm",
        toneClass,
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function StatePanel({
  icon: Icon,
  title,
  description,
  tone,
  badgeText,
  action,
  spinning = false,
}: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
  tone: "warning" | "danger" | "neutral";
  badgeText?: string;
  action?: ReactNode;
  spinning?: boolean;
}) {
  const styles = {
    warning: {
      wrapper:
        "border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20",
      iconWrap: "bg-white dark:bg-slate-800",
      icon: "text-amber-500",
    },
    danger: {
      wrapper:
        "border-rose-300 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20",
      iconWrap: "bg-white dark:bg-slate-800",
      icon: "text-rose-500",
    },
    neutral: {
      wrapper:
        "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50",
      iconWrap: "bg-white dark:bg-slate-800",
      icon: "text-green-500",
    },
  }[tone];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[24px] border border-dashed px-6 py-10 text-center",
        styles.wrapper,
      )}
    >
      <div className={cn("mb-4 rounded-full p-3 shadow-sm", styles.iconWrap)}>
        <Icon className={cn("h-8 w-8", styles.icon, spinning && "animate-spin")} />
      </div>
      <h4 className="mb-1 text-lg font-black text-slate-900 dark:text-slate-100">
        {title}
      </h4>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {badgeText && (
        <Badge
          variant="outline"
          className="mt-4 border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300"
        >
          {badgeText}
        </Badge>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function BotActionCard({
  title,
  description,
  tone,
  disabled,
  isPending,
  onClick,
}: {
  title: string;
  description: string;
  tone: "violet" | "amber";
  disabled: boolean;
  isPending: boolean;
  onClick: () => Promise<unknown>;
}) {
  const styles = {
    violet: {
      wrapper:
        "border-violet-200/80 bg-violet-50/70 dark:border-violet-800/50 dark:bg-violet-900/15",
      iconWrap: "bg-violet-100 dark:bg-violet-900/35",
      icon: "text-violet-600 dark:text-violet-400",
      button:
        "border-violet-200 bg-white text-violet-700 hover:bg-violet-100 dark:border-violet-800/60 dark:bg-slate-950 dark:text-violet-300 dark:hover:bg-violet-900/30",
    },
    amber: {
      wrapper:
        "border-amber-200/80 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-900/15",
      iconWrap: "bg-amber-100 dark:bg-amber-900/35",
      icon: "text-amber-600 dark:text-amber-400",
      button:
        "border-amber-200 bg-white text-amber-700 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-slate-950 dark:text-amber-300 dark:hover:bg-amber-900/30",
    },
  }[tone];

  return (
    <div
      className={cn(
        "rounded-[20px] border p-4 shadow-[0_16px_30px_-34px_rgba(15,23,42,0.38)]",
        styles.wrapper,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            styles.iconWrap,
          )}
        >
          <Bot className={cn("h-4 w-4", styles.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <Button
        onClick={onClick}
        disabled={disabled}
        variant="outline"
        className={cn(
          "mt-4 h-10 w-full rounded-xl border text-sm font-bold shadow-sm transition-all",
          styles.button,
        )}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isPending ? "Iniciando..." : "Iniciar fluxo"}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
