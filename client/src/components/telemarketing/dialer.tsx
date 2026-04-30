import { useState, useCallback, useEffect, useRef } from "react";
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
  Users,
  Search,
} from "lucide-react";

type Channel = { label: string; number: string };
type Client = { id: string; name: string; phone: string | null };

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
    callSid,
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClients, setShowClients] = useState(false);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/twilio/channels"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/channels", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data: myClients = [], isFetching: clientsFetching } = useQuery<Client[]>({
    queryKey: ["/api/clients", "dialer", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/clients?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as { data?: Client[] } | Client[];
      const list = Array.isArray(data) ? data : (data.data ?? []);
      return list.filter((c) => c.phone);
    },
    enabled: showClients,
  });

  useEffect(() => {
    if (!callSid || !activeCallId) return;
    fetch(`/api/calls/${activeCallId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ twilioCallSid: callSid }),
    }).catch((e) => console.warn("[dialer] Falha ao atualizar twilioCallSid:", e));
  }, [callSid, activeCallId]);

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
        // Inclui status "encerrada" para garantir que a ligação apareça
        // corretamente no histórico mesmo que os webhooks Twilio (dial-action /
        // twilio-status) não tenham chegado a tempo ou falhado.
        body: JSON.stringify({ notes: data.notes, outcome: data.outcome, status: "encerrada" }),
      });
      if (!res.ok) throw new Error("Erro ao salvar anotação");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Anotação salva" });
      // Invalida todas as queries que começam com /api/calls (inclui o histórico
      // que usa queryKey: ["/api/calls", statusFilter, page])
      queryClient.invalidateQueries({ queryKey: ["/api/calls"], exact: false });
      setShowNote(false);
      setActiveCallId(null);
      setSelectedClientId(null);
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

    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        twilioCallSid: null,
        ...(selectedClientId && { clientId: selectedClientId }),
      }),
    });

    let callRecordId: string | undefined;
    if (res.ok) {
      const call = await res.json() as { id: string };
      callRecordId = call.id;
      setActiveCallId(call.id);
      console.log("[dialer] POST /api/calls OK — callRecordId:", callRecordId);
    } else {
      const errText = await res.text().catch(() => "(sem corpo)");
      console.error("[dialer] POST /api/calls FALHOU:", res.status, errText);
    }

    console.log("[dialer] connect() params — callRecordId:", callRecordId ?? "(ausente)");
    await connect(number, from, callRecordId ? { callRecordId } : undefined);
  };

  const handleCallClient = (client: Client) => {
    if (!client.phone) return;
    setNumber(client.phone);
    setSelectedClientId(client.id);
    setShowClients(false);
  };

  const handleHangup = async () => {
    disconnect();
    // Marca a ligação como encerrada no banco imediatamente, sem depender
    // dos webhooks Twilio (dial-action / twilio-status) para isso.
    if (activeCallId) {
      try {
        await fetch(`/api/calls/${activeCallId}/end`, {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.warn("[dialer] Falha ao encerrar chamada via /end:", e);
      }
    }
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
                  onClick={() => {
                    // Mesmo ao pular, invalida o histórico para exibir a chamada encerrada
                    queryClient.invalidateQueries({ queryKey: ["/api/calls"], exact: false });
                    setShowNote(false);
                  }}
                >
                  Pular
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de clientes para ligar */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowClients((v) => !v)}
          >
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4" />
              Ligar para cliente
            </CardTitle>
            <span className="text-xs text-slate-400">{showClients ? "Fechar" : "Abrir"}</span>
          </button>
        </CardHeader>
        {showClients && (
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={clientSearch}
                onChange={(e) => handleClientSearchChange(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-8 text-sm rounded-xl"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {clientsFetching ? (
                <p className="text-xs text-slate-400 text-center py-4">Buscando...</p>
              ) : myClients.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum cliente com telefone.</p>
              ) : (
                myClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.phone}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 rounded-xl gap-1.5"
                      disabled={inCall || deviceStatus !== "registered"}
                      onClick={() => handleCallClient(client)}
                    >
                      <Phone className="size-3" />
                      Ligar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
