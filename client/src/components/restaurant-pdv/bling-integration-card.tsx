import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

export const BLING_CONNECTION_SETTING_KEY = "restaurant_pdv_bling_connection_id";

export function BlingIntegrationCard() {
  const { data: accounts = [] } = useBlingAccounts();
  const connectedAccounts = accounts.filter((a) => a.status === "connected");

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings"],
  });
  const connectionId = settings?.[BLING_CONNECTION_SETTING_KEY] ?? "";

  const saveConnectionMutation = useMutation({
    mutationFn: async (value: string) =>
      apiRequest("PUT", `/api/system-settings/${BLING_CONNECTION_SETTING_KEY}`, {
        value,
        description: "Conexão Bling usada para filtrar produtos disponíveis no cardápio do PDV Restaurante",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({ title: "Conexão Bling salva" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar conexão", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integração com Bling</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px] space-y-2">
          <Label>Conexão Bling do restaurante</Label>
          <Select value={connectionId} onValueChange={(value) => saveConnectionMutation.mutate(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conexão conectada" />
            </SelectTrigger>
            <SelectContent>
              {connectedAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.blingAccountName ?? account.name}
                </SelectItem>
              ))}
              {connectedAccounts.length === 0 && (
                <SelectItem value="none" disabled>
                  Nenhuma conexão conectada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
