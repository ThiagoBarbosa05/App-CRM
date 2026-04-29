import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTwilioDevice } from "@/hooks/use-twilio-device";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Delete,
  ExternalLink,
  Radio,
} from "lucide-react";

type Channel = { label: string; number: string };

const noteSchema = z.object({
  notes: z.string().optional(),
  outcome: z.enum([
    "atendeu",
    "nao_atendeu",
    "ocupado",
    "caixa_postal",
    "numero_invalido",
    "convertido",
    "reagendado",
  ]),
});
type NoteForm = z.infer<typeof noteSchema>;

const KEYPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const DEVICE_STATUS_LABELS: Record<string, string> = {
  offline: "Offline",
  registering: "Conectando...",
  registered: "Pronto",
  error: "Erro",
};

const CALL_STATUS_LABELS: Record<string, string> = {
  idle: "Aguardando",
  connecting: "Conectando",
  ringing: "Chamando",
  "in-progress": "Em chamada",
  disconnected: "Encerrada",
};

export function Dialer() {
  const {
    deviceStatus,
    callStatus,
    isMuted,
    errorMessage,
    isConfigured,
    connect,
    disconnect,
    toggleMute,
  } = useTwilioDevice();

  const [number, setNumber] = useState("");
  const [callerId, setCallerId] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/twilio/channels"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/channels", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { notes: "", outcome: "atendeu" },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (data: NoteForm & { callId: string }) => {
      const res = await fetch(`/api/calls/${data.callId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: data.notes, outcome: data.outcome }),
      });
      if (!res.ok) throw new Error("Erro ao salvar anotação");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Anotação salva" });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      setShowNote(false);
      setActiveCallId(null);
      reset();
    },
  });

  const handleKey = useCallback((key: string) => {
    setNumber((n) => n + key);
  }, []);

  const handleBackspace = useCallback(() => {
    setNumber((n) => n.slice(0, -1));
  }, []);

  const handleCall = async () => {
    if (!number) return;
    const from = callerId || channels[0]?.number || "";
    if (!from) {
      toast({ title: "Selecione um canal de saída", variant: "destructive" });
      return;
    }

    // Criar registro da chamada primeiro
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ twilioCallSid: null }),
    });
    if (res.ok) {
      const call = await res.json() as { id: string };
      setActiveCallId(call.id);
    }

    await connect(number, from);
  };

  const handleHangup = () => {
    disconnect();
    setShowNote(true);
  };

  const inCall = callStatus === "in-progress" || callStatus === "ringing" || callStatus === "connecting";

  const deviceBadgeVariant =
    deviceStatus === "registered"
      ? "default"
      : deviceStatus === "error"
      ? "destructive"
      : "secondary";

  // Fallback: link tel: se SDK não configurado
  if (!isConfigured) {
    return (
      <Card className="max-w-sm mx-auto border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Phone className="size-4" />
            Discador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Voice SDK não configurado. Configure as credenciais em{" "}
            <a href="/configuracoes?tab=telephony" className="text-blue-500 underline">
              Configurações → Telefonia & IA
            </a>
            .
          </p>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+5511999999999"
          />
          <Button asChild className="w-full gap-2" disabled={!number}>
            <a href={`tel:${number}`}>
              <ExternalLink className="size-4" />
              Ligar via telefone
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={deviceBadgeVariant} className="gap-1.5">
            <Radio className="size-3" />
            {DEVICE_STATUS_LABELS[deviceStatus]}
          </Badge>
          {inCall && (
            <Badge variant="default" className="bg-emerald-600 gap-1.5">
              <Phone className="size-3" />
              {CALL_STATUS_LABELS[callStatus]}
            </Badge>
          )}
        </div>
        {errorMessage && (
          <span className="text-xs text-red-500 truncate max-w-[160px]">
            {errorMessage}
          </span>
        )}
      </div>

      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
        <CardContent className="pt-6 space-y-4">
          {/* Canal de saída */}
          {channels.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Canal de saída</Label>
              <Select value={callerId} onValueChange={setCallerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o número de origem" />
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

          {/* Display do número */}
          <div className="relative">
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+5511999999999"
              className="text-center text-xl font-mono pr-10"
              disabled={inCall}
            />
            {number && !inCall && (
              <button
                type="button"
                onClick={handleBackspace}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <Delete className="size-4" />
              </button>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {KEYPAD.flat().map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                className="h-12 text-lg font-medium rounded-2xl"
                onClick={() => handleKey(key)}
                disabled={inCall}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* Controles de chamada */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {!inCall ? (
              <Button
                onClick={handleCall}
                disabled={!number || deviceStatus !== "registered"}
                className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 p-0"
              >
                <Phone className="size-6" />
              </Button>
            ) : (
              <>
                <Button
                  onClick={toggleMute}
                  variant="outline"
                  className="h-12 w-12 rounded-full p-0"
                >
                  {isMuted ? (
                    <MicOff className="size-5 text-red-500" />
                  ) : (
                    <Mic className="size-5" />
                  )}
                </Button>
                <Button
                  onClick={handleHangup}
                  className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 p-0"
                >
                  <PhoneOff className="size-6" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulário de anotação pós-chamada */}
      {showNote && (
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resultado da chamada</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((data) => {
                if (activeCallId) {
                  saveNoteMutation.mutate({ ...data, callId: activeCallId });
                } else {
                  setShowNote(false);
                }
              })}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Outcome</Label>
                <Select
                  value={watch("outcome")}
                  onValueChange={(v) =>
                    setValue("outcome", v as NoteForm["outcome"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atendeu">Atendeu</SelectItem>
                    <SelectItem value="nao_atendeu">Não atendeu</SelectItem>
                    <SelectItem value="ocupado">Ocupado</SelectItem>
                    <SelectItem value="caixa_postal">Caixa postal</SelectItem>
                    <SelectItem value="convertido">Convertido</SelectItem>
                    <SelectItem value="reagendado">Reagendado</SelectItem>
                    <SelectItem value="numero_invalido">Número inválido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anotação</Label>
                <Textarea
                  {...register("notes")}
                  placeholder="Observações sobre a chamada..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saveNoteMutation.isPending}
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNote(false)}
                >
                  Pular
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
