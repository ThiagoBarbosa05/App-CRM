import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Loader2, MessageSquareMore, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BirthdayBotsResponse } from "server/integrations/umbler";

interface Client {
  id: string;
  name: string;
  phone: string;
  birthday: string | null;
}

const LoadingIndicator = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center p-8 gap-4">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

export function StartBirthdayBot({
  client,
  isOpen,
  onOpenChange,
}: {
  client: Client;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: umblerContact, isLoading: isLoadingContact } = useQuery({
    queryKey: [`/api/umbler/contacts`, client?.phone],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/contacts/${client?.phone}`);
      if (!response.ok) throw new Error("Failed to fetch umbler contacts");
      return response.json();
    },
    enabled: !!isOpen && !!client,
  });

  const { data: contactChat, isLoading: isLoadingChats } = useQuery<{
    items: { id: string }[];
  }>({
    queryKey: ["contactChat", client?.phone],
    queryFn: async () => {
      const response = await fetch(
        `/api/umbler/chats?customerPhone=${client?.phone}&selectedChannel=${user?.serviceChannelId}`
      );
      if (!response.ok) throw new Error("Failed to fetch umbler chats");
      return response.json();
    },
    enabled: isOpen && !!umblerContact?.id,
  });

  const { data: bots, isLoading: isLoadingBots } =
    useQuery<BirthdayBotsResponse>({
      queryKey: ["/api/umbler/birthday-bots"],
      queryFn: async () => {
        const response = await fetch("/api/umbler/birthday-bots", {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        });
        if (!response.ok) {
          throw new Error("Não foi possível obter os bots do Umbler Talk");
        }
        return response.json();
      },
      enabled: !!isOpen && !!contactChat,
    });

  const syncCustomer = useMutation({
    mutationFn: (customerData: {
      phoneNumber: string;
      name?: string;
      organizationId: string;
    }) =>
      fetch(`/api/umbler/contacts/create`, {
        method: "POST",
        body: JSON.stringify(customerData),
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      }),
    onSuccess: async (response) => {
      if (!response.ok) throw new Error("Failed to sync customer");
      toast({
        title: "Cliente sincronizado com sucesso",
        description: "O cliente foi sincronizado com o Umbler Talk.",
      });
      await queryClient.invalidateQueries({
        queryKey: [`/api/umbler/contacts`, client?.phone],
      });
    },
    onError: () => {
      toast({
        title: "Erro ao sincronizar cliente",
        description: "Não foi possível sincronizar o cliente com o Umbler Talk.",
        variant: "destructive",
      });
    },
  });

  const createChatMutation = useMutation({
    mutationFn: () =>
      fetch("/api/umbler/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({
          contactId: umblerContact?.id,
          channelId: user?.serviceChannelId,
        }),
      }),
    onSuccess: async (response) => {
      if (!response.ok) throw new Error("Failed to create chat");
      toast({
        title: "Chat criado com sucesso",
        description: "A conversa foi iniciada e já pode receber o bot.",
      });
      await queryClient.invalidateQueries({
        queryKey: ["contactChat", client?.phone],
      });
    },
    onError: () => {
      toast({
        title: "Erro ao criar chat",
        description: "Não foi possível iniciar a conversa.",
        variant: "destructive",
      });
    },
  });

  const startBotOnChatMutation = useMutation({
    mutationFn: (data: { chatId: string; botId: string; triggerName: string }) =>
      fetch("/api/start/birthday-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify(data),
      }),
    onSuccess: async (response) => {
      if (!response.ok) throw new Error("Failed to start bot");
      toast({
        title: "Bot iniciado com sucesso",
        description: "A mensagem de aniversário foi enviada.",
      });
      onOpenChange(false); // Close dialog on success
    },
    onError: () => {
      toast({
        title: "Erro ao iniciar bot",
        description: "Não foi possível enviar a mensagem de aniversário.",
        variant: "destructive",
      });
    },
  });

  const renderContent = () => {
    if (isLoadingContact) {
      return <LoadingIndicator text="Verificando contato na plataforma..." />;
    }

    if (!umblerContact) {
      return (
        <div className="p-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Este cliente não está sincronizado com a plataforma de mensagens.
          </p>
          <Button
            variant={"secondary"}
            disabled={syncCustomer.isPending}
            onClick={() =>
              syncCustomer.mutate({
                phoneNumber: client.phone,
                organizationId: "aGx7Jh43-au36EGi", // TODO: Should this be dynamic?
                name: client.name,
              })
            }
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-2",
                syncCustomer.isPending && "animate-spin"
              )}
            />
            {syncCustomer.isPending
              ? "Sincronizando..."
              : "Sincronizar com WhatsApp"}
          </Button>
        </div>
      );
    }

    if (isLoadingChats) {
      return <LoadingIndicator text="Verificando conversa existente..." />;
    }

    if (!contactChat || contactChat.items.length === 0) {
      return (
        <div className="py-4 flex items-center justify-center">
          <Button
            disabled={createChatMutation.isPending}
            onClick={() => createChatMutation.mutate()}
            className="bg-green-500 hover:bg-green-600 text-white font-medium"
          >
            <MessageSquareMore className="size-5 mr-2" />
            {createChatMutation.isPending ? "Iniciando..." : "Iniciar conversa"}
          </Button>
        </div>
      );
    }

    if (isLoadingBots) {
      return <LoadingIndicator text="Carregando bots disponíveis..." />;
    }

    const birthdayBot = bots?.items.find((bot) =>
      bot.title.includes("ANIVERSARIO - NO DIA")
    );

    if (!birthdayBot) {
      return (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum bot de aniversário ("ANIVERSARIO - NO DIA") foi encontrado.
          </p>
        </div>
      );
    }

    return (
      <div className="py-4 flex items-center justify-center">
        <Button
          variant={"default"}
          size="lg"
          className="bg-green-500 hover:bg-green-600 text-white"
          disabled={startBotOnChatMutation.isPending}
          onClick={() =>
            startBotOnChatMutation.mutate({
              botId: birthdayBot.id,
              chatId: contactChat.items[0].id,
              triggerName: "Início",
            })
          }
        >
          {startBotOnChatMutation.isPending ? (
            <Loader2 className="size-5 mr-2 animate-spin" />
          ) : (
            <Bot className="size-5 mr-2" />
          )}
          {startBotOnChatMutation.isPending
            ? "Enviando Mensagem..."
            : `Enviar Parabéns`}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bot de Aniversário para{" "}
            <span className="font-semibold">{client.name}</span>
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
