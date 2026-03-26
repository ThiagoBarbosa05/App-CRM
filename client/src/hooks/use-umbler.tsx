import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "./use-toast";

interface CustomField {
  id: string;
  value: string;
}

interface Bot {
  id: string;
  title: string;
  _t: string;
  triggers: string[];
  manualTriggers: string[];
  steps: any[];
  channels: any[];
  order: number;
  final: boolean;
  active: boolean;
  groupIds: any[];
  updatedAtUTC: string;
  executionsCount: number;
  executionsDateUTC: string;
  createdAtUTC: string;
}

interface UmblerContact {
  _t: string;
  id: string;
  createdAtUTC: string;
  name: string;
  phoneNumber: string;
  email: string;
  profilePictureUrl: string;
  isBlocked: boolean;
  groupIdentifier: string;
  contactType: string;
  organizationMembers: string[];
  channelIds: string[];
  tags: any[];
  lastActiveUTC: string;
  gender: string;
  landline: string;
  address: any;
  notes: any[];
  customFields: CustomField[];
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface UmblerChat {
  id: string;
  lastMessage?: {
    content: string;
  } | null;
}

interface UmblerChatList {
  items: UmblerChat[];
}

export type PendingUmblerChatStatus =
  | "idle"
  | "creating"
  | "waiting_confirmation"
  | "confirmed"
  | "failed";

export interface PendingUmblerChatCreation {
  status: PendingUmblerChatStatus;
  requestedAt: number | null;
  lastKnownChatId: string | null;
  attemptCount: number;
}

export const UMBLER_CHAT_CONFIRMATION_POLL_INTERVAL_MS = 3000;
export const UMBLER_CHAT_CONFIRMATION_TIMEOUT_MS = 45000;

const EMPTY_UMBLER_CHAT_LIST: UmblerChatList = {
  items: [],
};

function getInitialPendingUmblerChatCreation(): PendingUmblerChatCreation {
  return {
    status: "idle",
    requestedAt: null,
    lastKnownChatId: null,
    attemptCount: 0,
  };
}

export function getPendingUmblerChatCreationQueryKey(phone?: string) {
  return ["pendingUmblerChatCreation", phone] as const;
}

export function usePendingUmblerChatCreation(phone?: string) {
  const queryClient = useQueryClient();

  return useQuery<PendingUmblerChatCreation>({
    queryKey: getPendingUmblerChatCreationQueryKey(phone),
    queryFn: () =>
      Promise.resolve(
        queryClient.getQueryData<PendingUmblerChatCreation>(
          getPendingUmblerChatCreationQueryKey(phone),
        ) ?? getInitialPendingUmblerChatCreation(),
      ),
    enabled: !!phone,
    initialData: getInitialPendingUmblerChatCreation,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: UMBLER_CHAT_CONFIRMATION_TIMEOUT_MS * 4,
  });
}

// Busca contato Umbler por telefone
export function useUmblerContact(phone?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["/api/umbler/contacts", phone],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/contacts/${phone}`);
      if (!response.ok) throw new Error("Failed to fetch umbler contacts");
      return response.json();
    },
    enabled: !!phone && enabled,
  });
}

// Busca chats do contato
export function useUmblerContactChats(
  phone?: string,
  userId?: string,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["contactChat", phone],
    queryFn: async () => {
      const response = await fetch(
        `/api/umbler/chats?customerPhone=${phone}&userId=${userId}`,
        {
          headers: {
            "x-user-id": userId || "",
          },
        }
      );

      if (response.status === 404) {
        return EMPTY_UMBLER_CHAT_LIST;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }

      return response.json();
    },
    enabled: !!phone && !!userId && enabled,
    placeholderData: EMPTY_UMBLER_CHAT_LIST,
    refetchInterval: () => {
      if (!phone) {
        return false;
      }

      const pendingState = queryClient.getQueryData<PendingUmblerChatCreation>(
        getPendingUmblerChatCreationQueryKey(phone),
      );

      return pendingState?.status === "waiting_confirmation"
        ? UMBLER_CHAT_CONFIRMATION_POLL_INTERVAL_MS
        : false;
    },
  });
}

// Busca bot por título
export function useUmblerBot(
  title: string,
  userId?: string,
  userRole?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["umblerBot", title],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/bot?title=${title}`, {
        headers: {
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch bot");
      return response.json();
    },
    enabled: !!title && enabled,
  });
}

// Busca campo customizado de cashback
export function useUmblerCashbackField(
  contactId?: string,
  userId?: string,
  userRole?: string,
  enabled: boolean = true
) {
  return useQuery<{ result: CustomField }>({
    queryKey: ["customFields", contactId],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/${contactId}/cashback-field`, {
        headers: {
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch cashback field");
      return response.json();
    },
    enabled: !!contactId && enabled,
  });
}

// Busca bot de cashback
export function useUmblerBotCashback(
  contactId?: string,
  userId?: string,
  userRole?: string,
  enabled: boolean = true
) {
  return useQuery<{ result: Bot }>({
    queryKey: ["botCashback"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/bot-cashback", {
        headers: {
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch cashback bot");
      return response.json();
    },
    enabled: !!contactId && enabled,
  });
}

// Cria chat Umbler
export function useCreateUmblerChat(userId?: string, userRole?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      phone,
    }: {
      contactId: string;
      phone: string;
    }) => {
      if (!contactId) {
        throw new Error("Contact ID é obrigatório para criar o chat");
      }
      if (!phone) {
        throw new Error("Telefone é obrigatório para atualizar o chat");
      }

      const response = await fetch(`/api/umbler/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
        body: JSON.stringify({ contactId, userId }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create chat";

        try {
          const errorData = (await response.json()) as { message?: string };
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Ignora falha ao interpretar resposta de erro
        }

        throw new Error(errorMessage);
      }

      return response.json();
    },
    onMutate: async (variables) => {
      queryClient.setQueryData<PendingUmblerChatCreation>(
        getPendingUmblerChatCreationQueryKey(variables.phone),
        (current) => ({
          ...(current ?? getInitialPendingUmblerChatCreation()),
          status: "creating",
          requestedAt: Date.now(),
          lastKnownChatId: null,
          attemptCount: (current?.attemptCount ?? 0) + 1,
        }),
      );
    },
    onSuccess: (data, variables) => {
      const newChat = data?.newChat as UmblerChat | undefined;

      queryClient.setQueryData<PendingUmblerChatCreation>(
        getPendingUmblerChatCreationQueryKey(variables.phone),
        (current) => ({
          ...(current ?? getInitialPendingUmblerChatCreation()),
          status: "waiting_confirmation",
          requestedAt: current?.requestedAt ?? Date.now(),
          lastKnownChatId: newChat?.id ?? null,
          attemptCount: current?.attemptCount ?? 1,
        }),
      );

      queryClient.refetchQueries({
        queryKey: ["contactChat", variables.phone],
        type: "active",
      });
      toast({
        title: "Solicitação enviada",
        description: "Aguardando confirmação do chat pelo Umbler.",
      });
    },
    onError: (error: Error, variables) => {
      queryClient.setQueryData<PendingUmblerChatCreation>(
        getPendingUmblerChatCreationQueryKey(variables.phone),
        getInitialPendingUmblerChatCreation(),
      );

      toast({
        title: "Erro ao criar chat",
        description: error.message || "Não foi possível criar o chat",
        variant: "destructive",
      });
    },
  });
}

// Sincroniza cliente com Umbler
export function useSyncUmblerCustomer(userId?: string, userRole?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customerData: {
      phoneNumber: string;
      name?: string;
      email?: string;
      organizationId: string;
    }) => {
      if (!customerData.phoneNumber) {
        throw new Error("Número de telefone é obrigatório");
      }
      if (!customerData.organizationId) {
        throw new Error("ID da organização é obrigatório");
      }

      const response = await fetch(
        `/api/umbler/contacts/create?userId=${userId}`,
        {
          method: "POST",
          body: JSON.stringify(customerData),
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId || "",
            "x-user-role": userRole || "",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to sync customer");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/umbler/contacts", variables.phoneNumber],
      });
      queryClient.invalidateQueries({
        queryKey: ["umblerContactByPhone", variables.phoneNumber],
      });
      queryClient.invalidateQueries({
        queryKey: ["contactChat", variables.phoneNumber],
      });
      toast({
        title: "Cliente sincronizado com sucesso",
        description: "O cliente foi sincronizado com o Umbler Talk",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar cliente",
        description:
          error.message ||
          "Não foi possível sincronizar o cliente com o Umbler Talk",
        variant: "destructive",
      });
    },
  });
}

// Envia mensagem em chat Umbler
export function useSendUmblerMessage(userId?: string, userRole?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      message,
    }: {
      chatId: string;
      message: string;
    }) => {
      if (!chatId) {
        throw new Error("Chat ID é obrigatório para enviar mensagem");
      }
      if (!message || message.trim() === "") {
        throw new Error("Mensagem não pode estar vazia");
      }

      const response = await fetch("/api/umbler/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
        body: JSON.stringify({ chatId, message }),
      });
      if (!response.ok) throw new Error("Falha ao enviar mensagem");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contactChat"] });
      toast({
        title: "Mensagem enviada!",
        description: "Sua mensagem foi enviada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    },
  });
}

// Inicia bot em chat Umbler
export function useStartUmblerBot(userId?: string, userRole?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      botId,
      triggerName,
      phone,
    }: {
      chatId: string;
      botId: string;
      triggerName: string;
      phone?: string;
    }) => {
      if (!chatId) {
        throw new Error("Chat ID é obrigatório para iniciar o bot");
      }
      if (!botId) {
        throw new Error("Bot ID é obrigatório");
      }
      if (!triggerName) {
        throw new Error("Nome do trigger é obrigatório");
      }

      const response = await fetch("/api/start/birthday-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
        body: JSON.stringify({ chatId, botId, triggerName }),
      });
      if (!response.ok) throw new Error("Failed to start bot");
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: variables.phone
          ? ["contactChat", variables.phone]
          : ["contactChat"],
      });
      toast({
        title: "Bot iniciado com sucesso",
        description:
          "O bot foi iniciado e as mensagens serão enviadas automaticamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar bot",
        description: error.message || "Não foi possível iniciar o bot.",
        variant: "destructive",
      });
    },
  });
}

// Cria cashback no Umbler
export function useCreateUmblerCashback(userId?: string, userRole?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      value,
      contactId,
    }: {
      value: string;
      contactId: string;
    }) => {
      if (!value || value.trim() === "") {
        throw new Error("Valor do cashback é obrigatório");
      }
      if (!contactId) {
        throw new Error("Contact ID é obrigatório");
      }

      const response = await fetch(`/api/umbler/cashback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
        body: JSON.stringify({ value, contactId }),
      });
      if (!response.ok) throw new Error("Erro ao cadastrar cashback");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customFields", variables.contactId],
      });
      toast({
        title: "Cashback cadastrado com sucesso",
        description: "O valor de cashback foi registrado na Umbler.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar cashback",
        description: error.message || "Não foi possível cadastrar o cashback.",
        variant: "destructive",
      });
    },
  });
}

// Atualiza cashback no Umbler
export function useUpdateUmblerCashback(userId?: string, userRole?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      value,
      contactId,
      fieldId,
      isAutoSync = false,
    }: {
      value: string;
      contactId: string;
      fieldId: string;
      isAutoSync?: boolean;
    }) => {
      if (!value || value.trim() === "") {
        throw new Error("Valor do cashback é obrigatório");
      }
      if (!contactId) {
        throw new Error("Contact ID é obrigatório");
      }
      if (!fieldId) {
        throw new Error("Field ID é obrigatório");
      }

      const response = await fetch(`/api/umbler/cashback/${fieldId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || "",
          "x-user-role": userRole || "",
        },
        body: JSON.stringify({ value, contactId }),
      });
      if (!response.ok) throw new Error("Erro ao atualizar cashback");
      return { isAutoSync };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customFields", variables.contactId],
      });

      if (data?.isAutoSync) {
        toast({
          title: "Sincronização Automática",
          description: "O saldo de cashback foi sincronizado com a Umbler.",
          variant: "default",
        });
      } else {
        toast({
          title: "Cashback atualizado com sucesso",
          description: "O valor de cashback foi atualizado na Umbler.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar cashback",
        description: error.message || "Não foi possível atualizar o cashback.",
        variant: "destructive",
      });
    },
  });
}

// Hook principal para automação completa do cashback Umbler após criação de venda
export function useUmblerCashbackAutomation(
  userId?: string,
  userRole?: string
) {
  const queryClient = useQueryClient();
  const syncCustomer = useSyncUmblerCustomer(userId, userRole);
  const createChat = useCreateUmblerChat(userId, userRole);
  const createCashback = useCreateUmblerCashback(userId, userRole);
  const updateCashback = useUpdateUmblerCashback(userId, userRole);
  const startBot = useStartUmblerBot(userId, userRole);

  return useMutation({
    mutationFn: async ({
      client,
      newBalance,
      organizationId,
    }: {
      client: Client;
      newBalance: number;
      organizationId: string;
    }) => {
      if (!client?.phone) {
        throw new Error("Telefone do cliente é obrigatório");
      }

      const formattedBalance = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(newBalance);

      let contactId: string;
      let chatId: string;

      // 1. Verificar se cliente existe no Umbler
      toast({ title: "Verificando cliente no Umbler..." });

      try {
        const contactResponse = await fetch(
          `/api/umbler/contacts/${client.phone}`
        );

        if (contactResponse.status === 404) {
          // Cliente não existe - sincronizar
          toast({ title: "Sincronizando cliente com Umbler..." });
          const syncResult = await syncCustomer.mutateAsync({
            phoneNumber: client.phone,
            name: client.name,
            email: client.email || "",
            organizationId,
          });
          contactId = syncResult.id;
        } else if (!contactResponse.ok) {
          throw new Error("Erro ao verificar contato no Umbler");
        } else {
          const contactData: UmblerContact = await contactResponse.json();
          contactId = contactData.id;
        }
      } catch (error: any) {
        throw new Error(
          `Erro ao verificar/sincronizar cliente: ${error.message}`
        );
      }

      // 2. Verificar se existe chat ou criar um novo
      toast({ title: "Verificando chat..." });

      try {
        const chatResponse = await fetch(
          `/api/umbler/chats?customerPhone=${client.phone}&userId=${userId}`,
          {
            headers: {
              "x-user-id": userId || "",
              "x-user-role": userRole || "",
            },
          }
        );

        if (!chatResponse.ok) {
          throw new Error("Erro ao verificar chat");
        }

        const chatData = await chatResponse.json();

        if (!chatData.items || chatData.items.length === 0) {
          // Não há chat - criar um
          toast({ title: "Criando chat..." });
          const newChatResult = await createChat.mutateAsync({
            contactId,
            phone: client.phone,
          });
          chatId = newChatResult.newChat.id;
        } else {
          chatId = chatData.items[0].id;
        }
      } catch (error: any) {
        throw new Error(`Erro ao verificar/criar chat: ${error.message}`);
      }

      // 3. Verificar campo de cashback e atualizar/criar
      toast({ title: "Sincronizando saldo de cashback..." });

      try {
        const cashbackFieldResponse = await fetch(
          `/api/umbler/${contactId}/cashback-field`,
          {
            headers: {
              "x-user-id": userId || "",
              "x-user-role": userRole || "",
            },
          }
        );

        if (cashbackFieldResponse.ok) {
          // Campo existe - atualizar
          const fieldData = await cashbackFieldResponse.json();
          await updateCashback.mutateAsync({
            value: formattedBalance,
            contactId,
            fieldId: fieldData.result.id,
            isAutoSync: true,
          });
        } else if (cashbackFieldResponse.status === 404) {
          // Campo não existe - criar
          await createCashback.mutateAsync({
            value: formattedBalance,
            contactId,
          });
        } else {
          throw new Error("Erro ao verificar campo de cashback");
        }
      } catch (error: any) {
        throw new Error(`Erro ao sincronizar cashback: ${error.message}`);
      }

      // 4. Buscar e iniciar bot de cashback
      toast({ title: "Iniciando bot de cashback..." });

      try {
        const botResponse = await fetch("/api/umbler/bot-cashback", {
          headers: {
            "x-user-id": userId || "",
            "x-user-role": userRole || "",
          },
        });

        if (!botResponse.ok) {
          throw new Error("Erro ao buscar bot de cashback");
        }

        const botData = await botResponse.json();

        if (!botData.result?.id) {
          throw new Error("Bot de cashback não encontrado");
        }

        await startBot.mutateAsync({
          chatId,
          botId: botData.result.id,
          triggerName: "Início",
        });

        return {
          contactId,
          chatId,
          botId: botData.result.id,
          balance: formattedBalance,
        };
      } catch (error: any) {
        throw new Error(`Erro ao iniciar bot: ${error.message}`);
      }
    },
    onSuccess: (result) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: ["/api/umbler/contacts", result.contactId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contactChat"],
      });
      queryClient.invalidateQueries({
        queryKey: ["customFields", result.contactId],
      });

      toast({
        title: "Automação de cashback concluída!",
        description:
          "O cliente foi sincronizado e a mensagem de cashback enviada.",
      });
    },
    onError: (error: any) => {
      console.error("Erro na automação Umbler:", error);
      toast({
        title: "Falha na automação Umbler",
        description: `${error.message}. A venda foi registrada, mas a automação falhou.`,
        variant: "destructive",
      });
    },
  });
}
