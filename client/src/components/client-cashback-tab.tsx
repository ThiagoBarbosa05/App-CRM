import {
  Bot,
  Gift,
  MessageSquareMore,
  Pencil,
  RefreshCcw,
  Wallet,
  Check,
  X,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Client, ClientCashbackBalance } from "@shared/schema";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CustomField } from "server/integrations/interfaces/create-contact";
import { Input } from "./ui/input";
import { Bot as IBot } from "server/integrations/interfaces/bot";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui/skeleton";

const cashbackFormSchema = z.object({
  value: z.string().min(1, "O valor é obrigatório."),
});

type CashbackFormData = z.infer<typeof cashbackFormSchema>;

export function ClientCashbackTab({
  client,
  contactId,
}: {
  client: Client;
  contactId?: string;
}) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const { data: cashbackBalance, isLoading: isLoadingCashbackBalance } =
    useQuery<ClientCashbackBalance>({
      queryKey: [`/api/cashback-balances/${client.id}`],
      enabled: !!client.id,
    });

  const { data: customField, isLoading: isLoadingCustomField } = useQuery<{
    result: CustomField;
  }>({
    queryKey: ["customFields", contactId],
    queryFn: async () => {
      const response = await fetch(`/api/umbler/${contactId}/cashback-field`, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      return response.json();
    },
    enabled: !!contactId,
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
      return response.json();
    },
    enabled: !!client?.phone,
  });

  const { data: botCashback, isLoading: isLoadingBotCashback } = useQuery<{
    result: IBot;
  }>({
    queryKey: ["botCashback"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/bot-cashback", {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      return response.json();
    },
    enabled: !!contactId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CashbackFormData>({
    resolver: zodResolver(cashbackFormSchema),
  });

  const watchedValue = watch("value");

  useEffect(() => {
    let initialValue = "";
    if (customField?.result?.value) {
      initialValue = customField.result.value;
    } else if (cashbackBalance?.currentBalance) {
      const num = parseFloat(cashbackBalance.currentBalance.toString());
      initialValue = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    }
    reset({ value: initialValue });
  }, [customField, cashbackBalance, reset]);

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
      console.log("Chat criado com sucesso:", newChat);
      toast({
        title: "Cliente sincronizado com sucesso",
        description: "O cliente foi sincronizado com o Umbler Talk",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/umbler/contacts`, client?.phone],
      });
      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", client?.phone],
        (old) => ({
          items: [...(old?.items ?? []), newChat],
        })
      );
    },
    onError: () => {
      toast({
        title: "Erro ao sincronizar cliente",
        description: "Não foi possível sincronizar o cliente com o Umbler Talk",
      });
    },
  });

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
          contactId: contactId,
          userId: user?.id,
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const { newChat } = data;
      console.log("Chat criado com sucesso:", newChat);
      toast({
        title: "Chat criado com sucesso",
        description: "O chat foi criado com sucesso",
      });
      queryClient.setQueryData<{ items: { id: string }[] }>(
        ["contactChat", client?.phone],
        (old) => ({
          items: [...(old?.items ?? []), newChat],
        })
      );
    },
    onError: () => {
      toast({
        title: "Erro ao criar chat",
        description: "Não foi possível criar o chat",
      });
    },
  });

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setValue("value", "", { shouldValidate: true });
      return;
    }
    const numberValue = parseInt(rawValue, 10) / 100;
    const formattedValue = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numberValue);

    setValue("value", formattedValue, { shouldValidate: true });
  };

  const createCashbackMutation = useMutation({
    mutationFn: async (data: CashbackFormData) => {
      const response = await fetch(`/api/umbler/cashback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({
          value: data.value,
          contactId: contactId,
        }),
      });
      if (!response.ok) {
        throw new Error("Erro ao cadastrar cashback");
      }
    },
    onSuccess: () => {
      toast({
        title: "Cashback cadastrado com sucesso",
      });
      queryClient.invalidateQueries({
        queryKey: ["customFields", contactId],
      });
    },
    onError: () => {
      toast({
        title: "Erro ao cadastrar cashback",
        variant: "destructive",
      });
    },
  });

  const updateCashbackMutation = useMutation({
    mutationFn: async (data: CashbackFormData) => {
      const response = await fetch(
        `/api/umbler/cashback/${customField?.result.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
          body: JSON.stringify({
            value: data.value,
            contactId: contactId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Erro ao atualizar cashback");
      }
    },
    onSuccess: () => {
      if (isEditing) {
        toast({
          title: "Cashback atualizado com sucesso",
        });
        setIsEditing(false);
      } else {
        toast({
          title: "Sincronização Automática",
          description: "O saldo de cashback foi sincronizado com a Umbler.",
          variant: "default",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["customFields", contactId] });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar cashback",
        variant: "destructive",
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
        description: "A mensagem foi enviada com sucesso.",
      });

      queryClient.invalidateQueries({
        queryKey: ["contactChat", client?.phone],
      });
    },
    onError: () => {
      toast({
        title: "Erro ao iniciar bot",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const syncBalances = () => {
      if (
        !cashbackBalance ||
        !customField?.result ||
        updateCashbackMutation.isPending
      ) {
        return;
      }

      const dbBalance = cashbackBalance.currentBalance;
      const umblerBalanceString = customField.result.value;

      if (
        dbBalance === null ||
        dbBalance === undefined ||
        !umblerBalanceString
      ) {
        return;
      }

      const dbValue = parseFloat(dbBalance.toString());
      const umblerValue = parseFloat(
        umblerBalanceString.replace(/\./g, "").replace(",", ".")
      );

      if (isNaN(dbValue) || isNaN(umblerValue)) {
        return;
      }

      if (Math.round(dbValue * 100) !== Math.round(umblerValue * 100)) {
        const formattedDbValue = new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(dbValue);

        updateCashbackMutation.mutate({ value: formattedDbValue });
      }
    };

    syncBalances();
  }, [cashbackBalance, customField, updateCashbackMutation.isPending]);

  const handleCreateSubmit = (data: CashbackFormData) => {
    createCashbackMutation.mutate(data);
  };

  const handleUpdateSubmit = (data: CashbackFormData) => {
    updateCashbackMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Saldo de Cashback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingCashbackBalance ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Saldo Disponível
                  </p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(
                      Number(cashbackBalance?.currentBalance?.toString() || "0")
                    )}
                  </p>
                </div>
                <Gift className="h-10 w-10 text-green-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Total Acumulado
                  </p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency(
                      Number(cashbackBalance?.totalEarned?.toString() || "0")
                    )}
                  </p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg dark:bg-orange-900/20">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Total Utilizado
                  </p>
                  <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                    {formatCurrency(
                      Number(cashbackBalance?.totalUsed?.toString() || "0")
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Automação de Cashback (Umbler)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contactId ? (
            <div>
              {isLoadingCustomField || isLoadingChats ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-1/2" />
                  <Skeleton className="h-10 w-1/3" />
                </div>
              ) : (
                <div>
                  {!contactChat || contactChat.items.length === 0 ? (
                    <div className="flex flex-col items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                        <Info className="h-5 w-5" />
                        <span className="font-medium">Chat não iniciado</span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Você ainda não tem um chat iniciado com esse cliente.
                        Clique no botão abaixo para criar um no WhatsApp.
                      </p>
                      <Button
                        disabled={createChatMutation.isPending}
                        onClick={() => createChatMutation.mutate()}
                        size="sm"
                      >
                        {createChatMutation.isPending ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <MessageSquareMore className="size-4 mr-2" />
                        )}
                        {createChatMutation.isPending
                          ? "Criando chat..."
                          : "Criar chat no WhatsApp"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {customField?.result ? (
                        isEditing ? (
                          <form
                            onSubmit={handleSubmit(handleUpdateSubmit)}
                            className="space-y-3"
                          >
                            <div className="flex items-center gap-2">
                              <Input
                                {...register("value")}
                                placeholder="Valor do cashback"
                                onChange={handleValueChange}
                                value={watchedValue || ""}
                                className="max-w-xs"
                              />
                              <Button
                                type="submit"
                                size="icon"
                                disabled={updateCashbackMutation.isPending}
                              >
                                {updateCashbackMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setIsEditing(false)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {errors.value && (
                              <p className="text-sm text-red-500">
                                {errors.value.message}
                              </p>
                            )}
                          </form>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                              <p className="text-2xl font-bold">
                                {formatCurrency(
                                  Number(
                                    customField.result.value.replace(
                                      ",",
                                      "."
                                    ) || "0"
                                  )
                                )}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setIsEditing(true)}
                              title="Editar Cashback"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      ) : (
                        <form
                          onSubmit={handleSubmit(handleCreateSubmit)}
                          className="space-y-3 max-w-sm"
                        >
                          <p className="text-sm text-gray-600 dark:text-gray-400 pb-1">
                            Este cliente ainda não possui um valor de cashback
                            cadastrado na Umbler.
                          </p>
                          <Input
                            {...register("value")}
                            placeholder="Digite o valor do cashback"
                            onChange={handleValueChange}
                            value={watchedValue || ""}
                          />
                          {errors.value && (
                            <p className="text-sm text-red-500">
                              {errors.value.message}
                            </p>
                          )}
                          <Button
                            type="submit"
                            disabled={createCashbackMutation.isPending}
                          >
                            {createCashbackMutation.isPending ? (
                              <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                              <Wallet className="size-4 mr-2" />
                            )}
                            {createCashbackMutation.isPending
                              ? "Cadastrando..."
                              : "Cadastrar Cashback"}
                          </Button>
                        </form>
                      )}

                      {isLoadingBotCashback ? (
                        <Skeleton className="h-10 w-48" />
                      ) : (
                        botCashback?.result && (
                          <Button
                            variant="outline"
                            onClick={async () =>
                              await startBotOnChatMutation.mutateAsync({
                                botId: botCashback.result.id,
                                chatId: contactChat.items[0].id,
                                triggerName: "Início",
                              })
                            }
                          >
                            <Bot className="mr-2 h-4 w-4" />
                            {startBotOnChatMutation.isPending
                              ? "Iniciando bot"
                              : `${botCashback.result.title}`}
                          </Button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Info className="h-5 w-5" />
                <span className="font-medium">Ação Necessária</span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Sincronize este contato com a Umbler para poder gerenciar e
                disparar o bot de cashback.
              </p>
              <Button
                onClick={() =>
                  syncCustomer.mutate({
                    phoneNumber: client.phone,
                    name: client.name,
                    organizationId: "aGx7Jh43-au36EGi",
                  })
                }
                disabled={syncCustomer.isPending}
                size="sm"
              >
                <RefreshCcw
                  className={cn(
                    "size-4 mr-2",
                    syncCustomer.isPending && "animate-spin"
                  )}
                />
                {syncCustomer.isPending ? "Sincronizando..." : "Sincronizar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
