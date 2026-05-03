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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Delete,
  ExternalLink,
  LoaderCircle,
  Radio,
  Users,
  Search,
  Timer,
  User,
  X,
  CheckCircle2,
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

const KEYPAD_LABELS: Record<string, string> = {
  "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL",
  "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ",
  "0": "+",
};

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

const OUTCOME_OPTIONS = [
  { value: "atendeu", label: "Atendeu" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "ocupado", label: "Ocupado" },
  { value: "caixa_postal", label: "Caixa postal" },
  { value: "convertido", label: "Convertido" },
  { value: "reagendado", label: "Reagendado" },
  { value: "numero_invalido", label: "Número inválido" },
] as const;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function createCallRecord(payload: {
  twilioCallSid?: string | null;
  clientId?: string;
  toPhone?: string;
  contactName?: string;
}): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          twilioCallSid: payload.twilioCallSid ?? null,
          ...(payload.clientId && { clientId: payload.clientId }),
          ...(payload.toPhone && { toPhone: payload.toPhone }),
          ...(payload.contactName && { contactName: payload.contactName }),
        }),
      });
      if (res.ok) {
        const call = (await res.json()) as { id: string };
        return call.id;
      }
      console.warn(
        `[dialer] POST /api/calls tentativa ${attempt + 1} falhou:`,
        res.status,
      );
    } catch (e) {
      console.warn(
        `[dialer] POST /api/calls tentativa ${attempt + 1} erro:`,
        e,
      );
    }
  }
  return null;
}

function NoteForm({
  watch,
  register,
  handleSubmit,
  setValue,
  saveNoteMutation,
  activeCallId,
  onSkip,
}: {
  watch: ReturnType<typeof useForm<NoteForm>>["watch"];
  register: ReturnType<typeof useForm<NoteForm>>["register"];
  handleSubmit: ReturnType<typeof useForm<NoteForm>>["handleSubmit"];
  setValue: ReturnType<typeof useForm<NoteForm>>["setValue"];
  saveNoteMutation: { isPending: boolean; mutate: (data: NoteForm & { callId: string | null }) => void };
  activeCallId: string | null;
  onSkip: () => void;
}) {
  return (
    <form
      onSubmit={handleSubmit((data) => {
        saveNoteMutation.mutate({ ...data, callId: activeCallId });
      })}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Resultado
        </Label>
        <Select
          value={watch("outcome")}
          onValueChange={(v) => setValue("outcome", v as NoteForm["outcome"])}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Anotação
        </Label>
        <Textarea
          {...register("notes")}
          placeholder="Observações sobre a chamada..."
          rows={3}
          className="rounded-xl resize-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          className="flex-1 rounded-xl gap-1.5"
          disabled={saveNoteMutation.isPending}
        >
          {saveNoteMutation.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Salvar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onSkip}
        >
          Pular
        </Button>
      </div>
    </form>
  );
}

export function Dialer() {
  const {
    deviceStatus,
    callStatus,
    callSid,
    connectedAt,
    isMuted,
    errorMessage,
    isConfigured,
    isCheckingConfig,
    connect,
    disconnect,
    toggleMute,
    clearError,
  } = useTwilioDevice();

  const [number, setNumber] = useState("");
  const [callerId, setCallerId] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [manualClientName, setManualClientName] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  // Em desktop (xl) a coluna de clientes fica sempre visível; em mobile começa fechada
  const [showClients, setShowClients] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1280,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const callButtonRef = useRef<HTMLButtonElement>(null);

  // Timer durante chamada ativa
  useEffect(() => {
    if (callStatus !== "in-progress" || !connectedAt) {
      setElapsedSeconds(0);
      return;
    }
    const id = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - connectedAt.getTime()) / 1000),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [callStatus, connectedAt]);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/twilio/channels"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/channels", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedClientSearch = clientSearch.trim();
  const normalizedDebouncedSearch = debouncedSearch.trim();
  const hasClientSearch = normalizedClientSearch.length > 0;

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data: myClients = [], isFetching: clientsFetching } = useQuery<Client[]>({
    queryKey: ["/api/clients", "dialer", normalizedDebouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      params.set("search", normalizedDebouncedSearch);
      const res = await fetch(`/api/clients?${params}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Client[] } | Client[];
      const list = Array.isArray(data) ? data : (data.data ?? []);
      return list.filter((c) => c.phone);
    },
    enabled: showClients && normalizedDebouncedSearch.length > 0,
  });

  useEffect(() => {
    if (!callSid || !activeCallId) return;
    fetch(`/api/calls/${activeCallId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ twilioCallSid: callSid }),
    }).catch((e) =>
      console.warn("[dialer] Falha ao atualizar twilioCallSid:", e),
    );
  }, [callSid, activeCallId]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { notes: "", outcome: "atendeu" },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (data: NoteForm & { callId: string | null }) => {
      let callId = data.callId;

      if (!callId) {
        callId = await createCallRecord({
          twilioCallSid: callSid,
          clientId: selectedClientId ?? undefined,
        });
        if (!callId)
          throw new Error("Não foi possível criar o registro da chamada");
        setActiveCallId(callId);
      }

      const res = await fetch(`/api/calls/${callId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: data.notes,
          outcome: data.outcome,
          status: "encerrada",
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar anotação");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Anotação salva" });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"], exact: false });
      setShowNote(false);
      setActiveCallId(null);
      setSelectedClientId(null);
      setSelectedClientName(null);
      setManualClientName("");
      reset();
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSkipNote = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/calls"], exact: false });
    setShowNote(false);
    setActiveCallId(null);
    setSelectedClientId(null);
    setSelectedClientName(null);
    setManualClientName("");
    reset();
  }, [reset]);

  const handleKey = useCallback((key: string) => {
    setNumber((n) => n + key);
  }, []);

  const handleBackspace = useCallback(() => {
    setNumber((n) => n.slice(0, -1));
  }, []);

  const handleCall = useCallback(async () => {
    if (!number) return;
    const from = callerId || channels[0]?.number || "";
    if (!from) {
      toast({ title: "Selecione um canal de saída", variant: "destructive" });
      return;
    }

    if (!selectedClientId && !manualClientName.trim()) {
      toast({
        title: "Informe o nome do cliente",
        description: "Digite o nome do cliente a ser contactado antes de ligar.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedClientId && manualClientName.trim()) {
      setSelectedClientName(manualClientName.trim());
    }

    const callRecordId = await createCallRecord({
      clientId: selectedClientId ?? undefined,
      toPhone: !selectedClientId ? number : undefined,
      contactName: !selectedClientId ? manualClientName.trim() || undefined : undefined,
    });

    if (callRecordId) {
      setActiveCallId(callRecordId);
    } else {
      console.error("[dialer] POST /api/calls falhou após 2 tentativas");
      toast({
        title: "Aviso",
        description: "Não foi possível registrar a chamada previamente. O histórico será criado ao encerrar.",
        variant: "destructive",
      });
    }

    await connect(number, from, callRecordId ? { callRecordId } : undefined);
  }, [number, callerId, channels, selectedClientId, manualClientName, connect]);

  const handleCallClient = useCallback((client: Client) => {
    if (!client.phone) return;
    setNumber(client.phone);
    setSelectedClientId(client.id);
    setSelectedClientName(client.name);
    setManualClientName("");
    setShowClients(false);
    // Foca no botão de ligar para facilitar o fluxo com Enter
    setTimeout(() => callButtonRef.current?.focus(), 50);
  }, []);

  const handleHangup = useCallback(async () => {
    disconnect();

    let resolvedCallId = activeCallId;

    if (!resolvedCallId && callSid) {
      resolvedCallId = await createCallRecord({
        twilioCallSid: callSid,
        clientId: selectedClientId ?? undefined,
        toPhone: !selectedClientId ? number : undefined,
        contactName: !selectedClientId ? manualClientName.trim() || undefined : undefined,
      });
      if (resolvedCallId) {
        setActiveCallId(resolvedCallId);
      }
    }

    if (resolvedCallId) {
      try {
        await fetch(`/api/calls/${resolvedCallId}/end`, {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.warn("[dialer] Falha ao encerrar chamada via /end:", e);
      }
    }

    setShowNote(true);
  }, [disconnect, activeCallId, callSid, selectedClientId, number, manualClientName]);

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Enter" && !inCall && !isInput) {
        e.preventDefault();
        void handleCall();
        return;
      }

      if (e.key === "Escape" && inCall) {
        e.preventDefault();
        void handleHangup();
        return;
      }

      if (!isInput && !inCall && /^[0-9*#]$/.test(e.key)) {
        handleKey(e.key);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleCall, handleHangup, handleKey]);

  const inCall =
    callStatus === "in-progress" ||
    callStatus === "ringing" ||
    callStatus === "connecting";

  const deviceBadgeVariant =
    deviceStatus === "registered"
      ? "default"
      : deviceStatus === "error"
        ? "destructive"
        : "secondary";

  const activeChannel =
    callerId
      ? channels.find((c) => c.number === callerId)
      : channels[0];

  if (isCheckingConfig) {
    return (
      <div className="max-w-sm mx-auto space-y-4">
        <Skeleton className="h-8 w-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <Card className="max-w-sm mx-auto border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Phone className="size-4" />
            Discador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Voice SDK não configurado. Configure as credenciais em{" "}
            <a
              href="/configuracoes?tab=telephony"
              className="text-blue-500 underline"
            >
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

  const noteFormProps = {
    watch,
    register,
    handleSubmit,
    setValue,
    saveNoteMutation,
    activeCallId,
    onSkip: handleSkipNote,
  };

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
      {/* ── Coluna esquerda: discador ── */}
      <div className="space-y-5 xl:sticky xl:top-6">
        {/* Status do dispositivo */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={deviceBadgeVariant} className="gap-1.5">
              <Radio className="size-3" />
              {DEVICE_STATUS_LABELS[deviceStatus]}
            </Badge>
            {inCall && (
              <Badge variant="default" className="bg-emerald-600 gap-1.5">
                <Phone className="size-3" />
                {CALL_STATUS_LABELS[callStatus]}
                {callStatus === "in-progress" && (
                  <span className="ml-1 font-mono">
                    {formatElapsed(elapsedSeconds)}
                  </span>
                )}
              </Badge>
            )}
          </div>
          {errorMessage ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-500 truncate max-w-[160px]">
                {errorMessage}
              </span>
              <button
                type="button"
                onClick={clearError}
                className="shrink-0 rounded-full p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 transition-colors"
                aria-label="Fechar erro"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Card info durante chamada ativa */}
        {inCall && (selectedClientName || number) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="size-9 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center shrink-0">
              <User className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              {selectedClientName && (
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 truncate">
                  {selectedClientName}
                </p>
              )}
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                {number}
              </p>
              {activeChannel && (
                <p className="text-[11px] text-emerald-500 dark:text-emerald-500 mt-0.5 truncate">
                  via {activeChannel.label} · {activeChannel.number}
                </p>
              )}
            </div>
            {callStatus === "in-progress" && (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Timer className="size-3.5" />
                <span className="text-sm font-mono font-semibold">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            )}
          </div>
        )}

        <Card className="border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
          <CardContent className="space-y-5 p-5 sm:p-6">
            {/* Canal de saída */}
            {channels.length > 1 ? (
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
            ) : channels.length === 1 ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50">
                <Phone className="size-3.5 shrink-0 text-slate-400" />
                <span className="text-xs text-slate-500">
                  {channels[0].label}
                </span>
                <span className="ml-auto font-mono text-xs text-slate-400">
                  {channels[0].number}
                </span>
              </div>
            ) : null}

            {/* Nome do cliente (digitação manual) */}
            {!selectedClientId && (
              <div className="animate-in fade-in-0 slide-in-from-top-1 duration-150 space-y-1.5">
                <Label className="text-xs text-slate-500">
                  Nome do cliente <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <User className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={manualClientName}
                    onChange={(e) => setManualClientName(e.target.value)}
                    placeholder="Nome do contato a ser ligado"
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 text-sm shadow-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:focus-visible:ring-blue-950"
                    disabled={inCall}
                  />
                </div>
              </div>
            )}

            {/* Display do número */}
            <div className="relative">
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="+5511999999999"
                className="h-14 rounded-2xl border-slate-200 bg-slate-50 pr-10 text-center font-mono text-xl shadow-none dark:border-slate-800 dark:bg-slate-950"
                disabled={inCall}
              />
              {number && !inCall && (
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <Delete className="size-4" />
                </button>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 sm:gap-3.5">
              {KEYPAD.flat().map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  className="h-14 flex flex-col items-center justify-center gap-0 rounded-2xl border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 sm:h-[58px]"
                  onClick={() => handleKey(key)}
                  disabled={inCall}
                >
                  <span className="text-xl font-semibold leading-tight">{key}</span>
                  {KEYPAD_LABELS[key] ? (
                    <span className="text-[8px] font-medium tracking-widest text-slate-400 leading-none">
                      {KEYPAD_LABELS[key]}
                    </span>
                  ) : (
                    <span className="text-[8px] leading-none">&nbsp;</span>
                  )}
                </Button>
              ))}
            </div>

            {/* Controles de chamada */}
            <div className="flex items-center justify-center gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
              {!inCall ? (
                <Button
                  ref={callButtonRef}
                  onClick={handleCall}
                  disabled={
                    !number ||
                    deviceStatus !== "registered" ||
                    (!selectedClientId && !manualClientName.trim())
                  }
                  className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 p-0 shadow-[0_4px_14px_-2px_rgba(16,185,129,0.4)] dark:shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95"
                >
                  <Phone className="size-7" />
                </Button>
              ) : (
                <>
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    className="h-14 w-14 rounded-full p-0 transition-all hover:scale-105 active:scale-95 border-slate-200"
                  >
                    {isMuted ? (
                      <MicOff className="size-6 text-red-500" />
                    ) : (
                      <Mic className="size-6" />
                    )}
                  </Button>
                  <Button
                    onClick={handleHangup}
                    className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 p-0 shadow-[0_4px_14px_-2px_rgba(239,68,68,0.4)] dark:shadow-red-900/40 transition-all hover:scale-105 active:scale-95"
                  >
                    <PhoneOff className="size-7" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Formulário de anotação pós-chamada — inline em desktop */}
        {showNote && (
          <>
            {/* Desktop: inline abaixo do discador */}
            <Card className="hidden xl:block animate-in slide-in-from-bottom-2 duration-200 border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Resultado da chamada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NoteForm {...noteFormProps} />
              </CardContent>
            </Card>

            {/* Mobile: bottom sheet */}
            <Sheet
              open={showNote}
              onOpenChange={(open) => {
                if (!open) handleSkipNote();
              }}
            >
              <SheetContent
                side="bottom"
                className="xl:hidden rounded-t-3xl pb-8 px-5"
              >
                <SheetHeader className="mb-4 text-left">
                  <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    Resultado da chamada
                  </SheetTitle>
                </SheetHeader>
                <NoteForm {...noteFormProps} />
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {/* ── Coluna direita: lista de clientes ── */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl min-h-[420px] xl:min-h-[560px] flex flex-col overflow-hidden">
        <CardHeader className="gap-4 border-b border-slate-100 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-900/70">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left xl:cursor-default"
            onClick={() => setShowClients((v) => !v)}
          >
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Users className="size-5 text-blue-600" />
                Ligar para cliente
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Selecione um contato com telefone válido para preencher o
                discador.
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 xl:hidden px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10">
              {showClients ? "Ocultar" : "Mostrar"}
            </span>
          </button>
        </CardHeader>
        {showClients && (
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 p-4 sm:p-5">
            <div className="relative">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={clientSearch}
                onChange={(e) => handleClientSearchChange(e.target.value)}
                placeholder="Buscar cliente..."
                className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 text-sm shadow-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:focus-visible:ring-blue-950"
              />
              {hasClientSearch && clientsFetching && (
                <LoaderCircle className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-blue-500" />
              )}
            </div>

            <div className="flex min-h-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex-1 space-y-2 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                {!hasClientSearch ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-400 dark:border-slate-800">
                    <Search className="mx-auto mb-3 size-8 opacity-30" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Pesquise por nome ou telefone para localizar clientes.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      A lista permanece oculta até que uma busca seja informada.
                    </p>
                  </div>
                ) : clientsFetching ? (
                  <div className="space-y-3 py-3">
                    <div className="flex items-center gap-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      <LoaderCircle className="size-4 animate-spin text-blue-500" />
                      Buscando clientes...
                    </div>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                  </div>
                ) : myClients.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-400 dark:border-slate-800">
                    <Users className="mx-auto mb-3 size-8 opacity-30" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Nenhum cliente encontrado para esta busca.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Ajuste o nome, telefone ou tente outro termo.
                    </p>
                  </div>
                ) : (
                  myClients.map((client) => (
                    <div
                      key={client.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 transition-colors",
                        selectedClientId === client.id
                          ? "border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/20"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/80",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {client.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {client.name}
                            </p>
                            {selectedClientId === client.id && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                Selecionado
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-xs text-slate-400">
                            {client.phone}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedClientId === client.id ? "default" : "outline"}
                        className={cn(
                          "ml-2 shrink-0 rounded-xl gap-1.5",
                          selectedClientId === client.id
                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                        )}
                        disabled={inCall || deviceStatus !== "registered"}
                        onClick={() => handleCallClient(client)}
                      >
                        <Phone className="size-3" />
                        Selecionar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
