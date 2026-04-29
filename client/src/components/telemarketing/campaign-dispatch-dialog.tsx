import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap, Users } from "lucide-react";

type Channel = { label: string; number: string };
type Campaign = {
  id: string;
  name: string;
  type: "humano" | "ia";
};
type CampaignClientRow = { status: string };

type DispatchResult = {
  dispatched: number;
  total: number;
  calls: Array<{
    clientId: string;
    clientName: string | null;
    callSid: string | null;
    callRecordId: string;
    status: string;
  }>;
};

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  onDispatched: (result: DispatchResult) => void;
}

export function CampaignDispatchDialog({ open, onClose, campaign, onDispatched }: Props) {
  const [fromNumber, setFromNumber] = useState("");

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/twilio/channels"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/channels", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: campaignClients = [] } = useQuery<CampaignClientRow[]>({
    queryKey: ["/api/campaigns", campaign.id, "clients"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}/clients`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const novosCount = campaignClients.filter((c) => c.status === "novo").length;

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fromNumber: fromNumber || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Erro ao disparar");
      }
      return res.json() as Promise<DispatchResult>;
    },
    onSuccess: (data) => {
      toast({
        title: "Campanha disparada",
        description: `${data.dispatched} de ${data.total} chamadas iniciadas.`,
      });
      onDispatched(data);
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao disparar", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Zap className="size-4" />
            Disparar campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
            <Users className="size-5 text-slate-400" />
            <div>
              <p className="text-sm font-semibold">{novosCount} cliente(s) com status "novo"</p>
              <p className="text-xs text-slate-500">
                Apenas clientes com status "novo" receberão chamadas.
              </p>
            </div>
          </div>

          {novosCount === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
              Nenhum cliente disponível para discagem.
            </p>
          )}

          {channels.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-sm">Canal de saída</Label>
              <Select value={fromNumber} onValueChange={setFromNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Número padrão das configurações" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.number} value={ch.number}>
                      {ch.label} — {ch.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Tipo: <strong>{campaign.type === "ia" ? "IA (ElevenLabs)" : "Humano (WebRTC)"}</strong>
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => dispatchMutation.mutate()}
            disabled={dispatchMutation.isPending || novosCount === 0}
            className="gap-2"
          >
            {dispatchMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            Confirmar disparo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
