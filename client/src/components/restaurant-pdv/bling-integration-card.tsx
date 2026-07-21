import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";
import type { PdvUnit } from "@shared/schema";
import { getPdvCurrentUnitId } from "@/lib/pdv-unit";

/** Chave legada mantida para compatibilidade retroativa */
export const BLING_CONNECTION_SETTING_KEY = "restaurant_pdv_bling_connection_id";

const UNITS_KEY = ["/api/restaurant-pdv/units"];

interface BlingIntegrationCardProps {
  /** Se fornecido, mostra conexão da unidade específica; caso contrário usa a unidade atual do localStorage */
  unitId?: string;
}

export function BlingIntegrationCard({ unitId: unitIdProp }: BlingIntegrationCardProps = {}) {
  const { data: accounts = [] } = useBlingAccounts();
  const connectedAccounts = accounts.filter((a) => a.status === "connected");

  const { data: units = [] } = useQuery<PdvUnit[]>({ queryKey: UNITS_KEY });

  const activeUnitId = unitIdProp ?? getPdvCurrentUnitId();
  const currentUnit = units.find((u) => u.id === activeUnitId);

  const saveConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!activeUnitId) throw new Error("Nenhuma unidade PDV selecionada");
      await apiRequest("PUT", `/api/restaurant-pdv/units/${activeUnitId}`, {
        blingConnectionId: connectionId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      toast({ title: "Catálogo Bling salvo para esta unidade" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const connectionId = currentUnit?.blingConnectionId ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integração com Bling</CardTitle>
        {currentUnit && (
          <CardDescription>
            Catálogo de produtos para <strong>{currentUnit.name}</strong>. Cada unidade pode ter
            seu próprio catálogo Bling.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px] space-y-2">
          <Label>Conexão Bling</Label>
          <Select
            value={connectionId}
            onValueChange={(value) => saveConnectionMutation.mutate(value)}
            disabled={!activeUnitId}
          >
            <SelectTrigger>
              <SelectValue placeholder={activeUnitId ? "Selecione uma conexão" : "Selecione uma unidade primeiro"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem catálogo Bling</SelectItem>
              {connectedAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.blingAccountName ?? account.name}
                </SelectItem>
              ))}
              {connectedAccounts.length === 0 && (
                <SelectItem value="none" disabled>
                  Nenhuma conexão disponível
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
