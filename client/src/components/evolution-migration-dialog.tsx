import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSetEvolutionBackend, type WhatsappChannel } from "@/hooks/use-whatsapp";
import { EvolutionChannelConnect } from "@/components/evolution-channel-connect";

export function EvolutionMigrationDialog({ channel, open, onOpenChange }: { channel: WhatsappChannel | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const mutation = useSetEvolutionBackend();
  const [step, setStep] = useState<1 | 2>(1);
  const [target, setTarget] = useState<"gateway" | "evolution_api">("evolution_api");
  const [pendingChannel, setPendingChannel] = useState<WhatsappChannel | null>(null);
  useEffect(() => { if (channel) { setTarget(channel.qrBackend === "gateway" ? "evolution_api" : "gateway"); setStep(1); setPendingChannel(null); } }, [channel]);
  const sourceLabel = channel?.qrBackend === "gateway" ? "Baileys Gateway" : "Evolution API";
  const targetLabel = target === "gateway" ? "Baileys Gateway" : "Evolution API";
  const submit = () => mutation.mutate({ channelId: channel!.id, qrBackend: target }, { onSuccess: (data) => { setPendingChannel(data); setStep(2); } });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Trocar backend do canal</DialogTitle><DialogDescription>O canal ficará temporariamente bloqueado e será necessário escanear um novo QR Code.</DialogDescription></DialogHeader>{step === 1 ? <div className="space-y-4"><div className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><span>Atual</span><Badge variant="outline">{sourceLabel}</Badge></div><div className="flex justify-between mt-2"><span>Destino</span><Badge>{targetLabel}</Badge></div></div><div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />Mensagens, campanhas e bots ficam bloqueados até a nova conexão ser confirmada.</div></div> : <div className="space-y-4"><div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-600" />Backend preparado. Escaneie o QR Code para concluir.</div>{pendingChannel && <EvolutionChannelConnect channel={pendingChannel} />}</div>}<DialogFooter>{step === 1 ? <><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continuar</Button></> : <Button variant="outline" onClick={() => onOpenChange(false)}><QrCode className="mr-2 h-4 w-4" />Fechar</Button>}</DialogFooter></DialogContent></Dialog>;
}
