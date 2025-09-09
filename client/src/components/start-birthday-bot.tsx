import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Cake, Loader2, MessageSquareMore, RefreshCw } from "lucide-react";
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
  <div className="flex flex-col items-center justify-center p-8 gap-4 min-h-[250px]">
    <Loader2 className="h-8 w-8 animate-spin text-bordeaux-700" />
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

  const { data: contactChat, isLoading: isLoadingChats } = useQuery({
    queryKey: ["contactChat", client?.phone],
    queryFn: async () => {
      const response = await fetch(
        `/api/umbler/chats?customerPhone=${client?.phone}&userId=${user?.id}`,
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }

      return await response.json();
    },
    enabled: !!client?.phone && isOpen,
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
    mutationFn: async (customerData: {
      phoneNumber: string;
      name?: string;
      email?: string;
      organizationId: string;
    }) => {
      const response = await fetch(
        `/api/umbler/contacts/create?userId=${user?.id}`,
        {
          method: "POST",
          body: JSON.stringify(customerData),
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to update customer");
      return response.json();
    },
    onSuccess: (data) => {
      const { newChat } = data;

      toast({
        title: "Cliente sincronizado com sucesso",
        description: "O cliente foi sincronizado com o Umbler Talk",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/umbler/contacts`, client?.phone],
      });

      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", client?.phone],
        (old) => {
          return {
            items: [...(old?.items ?? []), newChat],
          };
        }
      );
    },
    onError: () => {
      toast({
        title: "Erro ao sincronizar cliente",
        description: "Não foi possível sincronizar o cliente com o Umbler Talk",
      });
    },
  });

  function formatDate(date: string) {
    const dateObj = new Date(date);
    const day = dateObj.getUTCDate().toString().padStart(2, "0");
    const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, "0");
    const year = dateObj.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/umbler/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({
          contactId: umblerContact?.id,
          userId: user?.id,
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const { newChat } = data;

      toast({
        title: "Chat criado com sucesso",
        description: "O chat foi criado com sucesso",
      });

      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", client?.phone],
        (old) => {
          return {
            items: [...(old?.items ?? []), newChat],
          };
        }
      );
    },
    onError: () => {
      toast({
        title: "Erro ao criar chat",
        description: "Não foi possível criar o chat",
      });
    },
  });

  const startBotOnChatMutation = useMutation({
    mutationFn: (data: {
      chatId: string;
      botId: string;
      triggerName: string;
    }) =>
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
        <div className="p-6 text-center bg-bordeaux-50/50 rounded-lg m-4 border border-dashed border-bordeaux-200">
          <div className="mx-auto mb-3 bg-bordeaux-100 text-bordeaux-700 p-2 rounded-full w-fit">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h3 className="font-semibold mb-1 text-bordeaux-900">
            Cliente Não Sincronizado
          </h3>
          <p className="mb-4 text-sm text-bordeaux-800/80">
            Para enviar mensagens, primeiro sincronize este cliente com a
            plataforma de WhatsApp.
          </p>
          <Button
            className="bg-bordeaux-600 text-white hover:bg-bordeaux-700"
            disabled={syncCustomer.isPending}
            onClick={() =>
              syncCustomer.mutate({
                phoneNumber: client.phone,
                organizationId: "aGx7Jh43-au36EGi",
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
              : "Sincronizar Cliente"}
          </Button>
        </div>
      );
    }

    if (isLoadingChats) {
      return <LoadingIndicator text="Verificando conversa existente..." />;
    }

    if (!contactChat || contactChat.items.length === 0) {
      return (
        <div className="p-6 text-center bg-bordeaux-50/50 rounded-lg m-4 border border-dashed border-bordeaux-200">
          <div className="mx-auto mb-3 bg-bordeaux-100 text-bordeaux-700 p-2 rounded-full w-fit">
            <MessageSquareMore className="h-6 w-6" />
          </div>
          <h3 className="font-semibold mb-1 text-bordeaux-900">
            Nenhuma Conversa Ativa
          </h3>
          <p className="mb-4 text-sm text-bordeaux-800/80">
            É preciso iniciar uma conversa no WhatsApp com este cliente antes de
            enviar a mensagem de aniversário.
          </p>
          <Button
            className="bg-bordeaux-600 text-white hover:bg-bordeaux-700"
            disabled={createChatMutation.isPending}
            onClick={() => createChatMutation.mutate()}
          >
            <MessageSquareMore className="size-4 mr-2" />
            {createChatMutation.isPending ? "Iniciando..." : "Iniciar Conversa"}
          </Button>
        </div>
      );
    }

    if (isLoadingBots) {
      return <LoadingIndicator text="Carregando bots disponíveis..." />;
    }

    return (
      <div className="px-4 pb-4 pt-2">
        <p className="text-sm text-center text-muted-foreground mb-4">
          Escolha uma das mensagens automáticas abaixo para enviar.
        </p>
        <div className="flex flex-col gap-2">
          {bots?.items.map((bot) => (
            <Button
              key={bot.id}
              variant="outline"
              className="w-full justify-start h-auto py-3 transition-colors duration-150 hover:bg-bordeaux-50 hover:border-bordeaux-300 group"
              disabled={
                startBotOnChatMutation.isPending &&
                startBotOnChatMutation.variables?.botId === bot.id
              }
              onClick={() =>
                startBotOnChatMutation.mutate({
                  botId: bot.id,
                  chatId: contactChat.items[0].id,
                  triggerName: "Início",
                })
              }
            >
              {startBotOnChatMutation.isPending &&
              startBotOnChatMutation.variables?.botId === bot.id ? (
                <Loader2 className="h-5 w-5 mr-3 animate-spin text-bordeaux-700" />
              ) : (
                <Bot className="h-5 w-5 mr-3 text-bordeaux-600/80 transition-colors duration-150 group-hover:text-bordeaux-700" />
              )}
              <div className="text-left">
                <span className="font-semibold transition-colors duration-150 group-hover:text-bordeaux-800">
                  {bot.title}
                </span>
                <p className="text-xs text-muted-foreground font-normal">
                  Clique para enviar esta mensagem de aniversário.
                </p>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pt-4">
          <div className="mx-auto mb-2 bg-bordeaux-100 text-bordeaux-700 p-3 rounded-full">
            <Cake className="h-8 w-8" />
          </div>
          <DialogTitle className="text-xl text-center">
            Feliz Aniversário,{" "}
            <span className="font-semibold text-bordeaux-700">
              {client.name}!
            </span>
          </DialogTitle>
          <DialogDescription className="text-center">
            Data de Nascimento: {formatDate(client.birthday || "2000-01-01")}
            <br />
            Envie uma mensagem especial para celebrar.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
