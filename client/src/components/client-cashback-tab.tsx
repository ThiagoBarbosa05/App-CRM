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
import { useQuery } from "@tanstack/react-query";
import { Client, ClientCashbackBalance } from "@shared/schema";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "./ui/input";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui/skeleton";
import {
  useUmblerContactChats,
  useUmblerCashbackField,
  useUmblerBotCashback,
  useCreateUmblerChat,
  useSyncUmblerCustomer,
  useStartUmblerBot,
  useCreateUmblerCashback,
  useUpdateUmblerCashback,
} from "../hooks/use-umbler";

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

  const { data: customField, isLoading: isLoadingCustomField } =
    useUmblerCashbackField(contactId, user?.id, user?.role, !!contactId);

  const { data: contactChat, isLoading: isLoadingChats } =
    useUmblerContactChats(client?.phone, user?.id, !!client?.phone);

  const { data: botCashback, isLoading: isLoadingBotCashback } =
    useUmblerBotCashback(contactId, user?.id, user?.role, !!contactId);

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

  const syncCustomer = useSyncUmblerCustomer(user?.id, user?.role);
  const createChatMutation = useCreateUmblerChat(user?.id, user?.role);
  const createCashbackMutation = useCreateUmblerCashback(user?.id, user?.role);
  const updateCashbackMutation = useUpdateUmblerCashback(user?.id, user?.role);
  const startBotOnChatMutation = useStartUmblerBot(user?.id, user?.role);

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
        umblerBalanceString.replace(/\./g, "").replace(",", "."),
      );

      if (isNaN(dbValue) || isNaN(umblerValue)) {
        return;
      }

      if (Math.round(dbValue * 100) !== Math.round(umblerValue * 100)) {
        const formattedDbValue = new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(dbValue);

        updateCashbackMutation.mutate({
          value: formattedDbValue,
          contactId: contactId!,
          fieldId: customField.result.id,
          isAutoSync: true,
        });
      }
    };

    syncBalances();
  }, [cashbackBalance, customField, updateCashbackMutation.isPending]);

  const handleCreateSubmit = (data: CashbackFormData) => {
    createCashbackMutation.mutate({
      value: data.value,
      contactId: contactId!,
    });
  };

  const handleUpdateSubmit = (data: CashbackFormData) => {
    updateCashbackMutation.mutate({
      value: data.value,
      contactId: contactId!,
      fieldId: customField?.result.id!,
    });
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
                      Number(
                        cashbackBalance?.currentBalance?.toString() || "0",
                      ),
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
                      Number(cashbackBalance?.totalEarned?.toString() || "0"),
                    )}
                  </p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg dark:bg-orange-900/20">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Total Utilizado
                  </p>
                  <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                    {formatCurrency(
                      Number(cashbackBalance?.totalUsed?.toString() || "0"),
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
                        onClick={() =>
                          createChatMutation.mutate({
                            contactId: contactId!,
                          })
                        }
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
                                <X className="h-4 w-4 dark:text-slate-200" />
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
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 dark:text-slate-200 rounded-md">
                              <p className="text-2xl font-bold">
                                {formatCurrency(
                                  Number(
                                    customField.result.value.replace(
                                      ",",
                                      ".",
                                    ) || "0",
                                  ),
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
                    syncCustomer.isPending && "animate-spin",
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
