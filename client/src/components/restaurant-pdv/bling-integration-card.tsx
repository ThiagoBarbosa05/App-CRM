import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

const BLING_CONNECTION_SETTING_KEY = "restaurant_pdv_bling_connection_id";

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
        description: "Conexão Bling usada para sincronizar o cardápio do PDV Restaurante",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({ title: "Conexão Bling salva" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar conexão", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/menu-items/sync-bling", {
        connectionId: connectionId || undefined,
      });
      return res.json() as Promise<{ created: number; updated: number; skipped: number; total: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/menu-items"] });
      toast({
        title: "Sincronização concluída",
        description: `${result.created} criados, ${result.updated} atualizados, ${result.skipped} ignorados`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
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
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={!connectionId || syncMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar com Bling"}
        </Button>
      </CardContent>
    </Card>
  );
}
