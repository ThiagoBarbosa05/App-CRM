import { Bot, Gift, Pencil, RefreshCcw, SquarePen, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Client, ClientCashbackBalance } from "@shared/schema";
import { cn, formatCurrency } from "@/lib/utils";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CustomField } from "server/integrations/interfaces/create-contact";
import { Input } from "./ui/input";
import { Bot as IBot } from "server/integrations/interfaces/bot";

export function ClientCashbackTab({client, contactId}: {client: Client, contactId?: string}) {

    const {user} = useAuth()

      const { data: cashbackBalance } = useQuery<ClientCashbackBalance>({
        queryKey: [`/api/cashback-balances/${client.id}`],
        enabled: !!client.id
      });

      const {data: customField, isLoading: isLoadingCustomField} = useQuery<{
        result: CustomField
      }>({
        queryKey: ["customFields", contactId],
        queryFn: async () => {
            const response = await fetch(`/api/umbler/${contactId}/cashback-field`, {
                headers: {
                "x-user-id": user?.id || "",
                "x-user-role": user?.role || "",
                }
            })

        return await response.json()
        },

        enabled: !!contactId
      })

      const {data: botCashback, isLoading: isLoadingBotCashback} = useQuery<{
        result: IBot
      }>({
        queryKey: ["botCashback"],
        queryFn: async () => {
          const response = await fetch("/api/umbler/bot-cashback", {
            headers: {

          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",

            }
          })

          return await response.json()
        },

        enabled: !!contactId
      })



//        const { data: botCashback, isLoading: isLoadingBotCahback } = useQuery<{
//     items: {
//       id: string;
//       title: string;
//       triggers: string[];
//     }[];
//   }>({
//     queryKey: ["bots", "cas"],
//     queryFn: async () => {
//       const response = await fetch(
//         "https://app-utalk.umbler.com/api/v1/bots/?organizationId=aGx7Jh43-au36EGi&query=cashback&Skip=0&Take=50&Behavior=GetSliceOnly",
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization:
//               "Bearer crm-integracao-2025-08-19-2093-09-06--149E63C849F8BCB5592608AD389BF0E4DB13FCB478F902B0B3CD488E88E5A784",
//           },
//         },
//       );
//       return response.json();
//     },
//   });

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
            // queryClient.invalidateQueries({
            //   queryKey: ["contactChat", client?.phone],
            // });

            queryClient.setQueryData<{ items: { id: string }[] }>(
              ["contactChat", client?.phone],
              (old) => {
                console.log(old);
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

        console.log(customField)

    return (
        <div className="space-y-4"><Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-green-600" />
                          Saldo de Cashback
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                          <div>
                            <p className="text-sm font-medium text-green-600">
                              Saldo Disponível
                            </p>
                            <p className="text-2xl font-bold text-green-700">
                              {cashbackBalance
                                ? formatCurrency(
                                    Number(cashbackBalance.currentBalance?.toString() || "0")
                                  )
                                : formatCurrency(0)}
                            </p>
                          </div>
                          <Gift className="h-8 w-8 text-green-600" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-600">
                              Total Acumulado
                            </p>
                            <p className="text-lg font-bold text-blue-700">
                              {cashbackBalance
                                ? formatCurrency(
                                    Number(cashbackBalance.totalEarned?.toString() || "0")
                                  )
                                : formatCurrency(0)}
                            </p>
                          </div>
                          <div className="text-center p-3 bg-orange-50 rounded-lg">
                            <p className="text-sm font-medium text-orange-600">
                              Total Utilizado
                            </p>
                            <p className="text-lg font-bold text-orange-700">
                              {cashbackBalance
                                ? formatCurrency(
                                    Number(cashbackBalance.totalUsed?.toString() || "0")
                                  )
                                : formatCurrency(0)}
                            </p>
                          </div>
                        </div>

                      </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                                 <CardTitle className="text-lg flex items-center gap-2">
                          <Bot className="h-5 w-5 text-blue-500" />
                         Bot Cashback
                        </CardTitle>
                            </CardHeader>
                        <CardContent>
                            <div>
                            {contactId ? (<div>

                                {isLoadingCustomField ? (
                                    <div>Carregando Informações...</div>
                                ) : (
                                    <div>
                                        {customField?.result ? ( <div>
                                                <div className="flex items-center gap-2">
                                                <Input defaultValue={customField.result.value} />
                                                <Button variant={"outline"} size={"icon"} title="Editar Cashback"><SquarePen /></Button>
                                                </div>
                                                {isLoadingBotCashback ? (<div>
                                                  Carregando bot de cashback...
                                                </div>) : (
                                                  <Button className="bg-green-200 border-green-400 mt-2" variant={"outline"}>
                                                    <Bot />
                                                    {botCashback?.result.title}
                                                  </Button>
                                                )}  
                                            </div>) : (
                                           <div>
                                            <p className="text-sm text-gray-700 pb-1 italic">Cliente {client.name} ainda não possui um cashback cadastrado no Umbler. Clique no botão abaixo para cadastrar.</p>
                                            <Input defaultValue={cashbackBalance?.currentBalance} />
                                            <Button className="mt-1">

                                                Cadastrar cashback
                                            </Button>
                                           </div>
                                        )}
                                    </div>
                                )}

                            </div>) : (<div>

                                <span className="block mb-2 text-gray-600 italic text-sm">Sincronize esse contato para disparar o Bot de cashback.</span>
                                <Button 
                                className="bg-green-200 border-green-300 hover:bg-green-300" 
                                variant={"outline"} >
                                    <RefreshCcw className={cn("size-5", syncCustomer.isPending && "animate-spin")} /> 
                                    {syncCustomer.isPending ? "Sincronizando..." : "Sincronizar"}
                                </Button>
                            </div>)}
                        </div>
                        </CardContent>
                    </Card>

        </div>

    )
}