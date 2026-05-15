import { useState, useCallback, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTwilioDeviceContext } from "@/contexts/twilio-device-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  LoaderCircle,
  Users,
  Search,
  X,
  CheckCircle2,
  User,
  RefreshCw,
  PhoneCall,
  Bot,
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
  status: z
    .enum(["encerrada", "nao_atendeu", "ocupado", "falhou", "caixa_postal"])
    .optional(),
});
type NoteForm = z.infer<typeof noteSchema>;

const KEYPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const KEYPAD_LABELS: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
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

const CALL_STATUS_OPTIONS = [
  { value: "encerrada", label: "Encerrada" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "ocupado", label: "Ocupado" },
  { value: "falhou", label: "Falhou" },
  { value: "caixa_postal", label: "Caixa postal" },
] as const;

const TWILIO_STATUS_LABELS: Record<string, string> = {
  iniciando: "Iniciando",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  falhou: "Falhou",
  caixa_postal: "Caixa postal",
};

const TWILIO_STATUS_COLORS: Record<string, string> = {
  encerrada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  nao_atendeu:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ocupado:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  falhou: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  caixa_postal:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  em_andamento:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  iniciando:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function mapStatusToOutcome(status: string): NoteForm["outcome"] {
  const map: Partial<Record<string, NoteForm["outcome"]>> = {
    encerrada: "atendeu",
    nao_atendeu: "nao_atendeu",
    ocupado: "ocupado",
    falhou: "numero_invalido",
    caixa_postal: "caixa_postal",
  };
  return map[status] ?? "atendeu";
}

// ─── Helpers de formatação de telefone ──────────────────────────────────────

/** Dígitos válidos para um número E.164 brasileiro (sem o +) */
const MAX_PHONE_DIGITS = 13; // +55 (2) + DDD (2) + número (9)

/**
 * Sanitiza a entrada do teclado: mantém apenas dígitos, `+` (somente no início),
 * `*` e `#`. Limita a MAX_PHONE_DIGITS dígitos.
 */
function sanitizePhone(input: string): string {
  // Remove chars de formatação (espaço, traço, parênteses, ponto)
  let raw = input.replace(/[\s\-().]/g, "");
  // Remove chars inválidos (mantém dígitos, +, *, #)
  raw = raw.replace(/[^\d+*#]/g, "");
  // + só permitido no início
  if (raw.startsWith("+")) {
    raw = "+" + raw.slice(1).replace(/\+/g, "");
  } else {
    raw = raw.replace(/\+/g, "");
  }
  // Limita DTMF (*#) a no máximo 1 de cada
  if (/[*#]/.test(raw)) return raw;
  // Limita quantidade de dígitos
  const digits = raw.replace(/\D/g, "");
  if (digits.length > MAX_PHONE_DIGITS) {
    const prefix = raw.startsWith("+") ? "+" : "";
    return prefix + digits.slice(0, MAX_PHONE_DIGITS);
  }
  return raw;
}

/**
 * Formata o número armazenado (raw) para exibição progressiva:
 * - Internacional: +55 (21) 98901-4962
 * - BR local:      (21) 98901-4962
 * - DTMF (asterisco/cerquilha): sem formatação
 */
function formatDialerDisplay(raw: string): string {
  if (!raw) return "";
  if (/[*#]/.test(raw)) return raw;

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  const len = digits.length;

  if (hasPlus) {
    if (len <= 2) return "+" + digits;
    if (len <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (len <= 6)
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    if (len <= 10)
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }

  if (len <= 2) return digits;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

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
  twilioStatus,
  twilioStatusLoading,
  onRefreshStatus,
}: {
  watch: ReturnType<typeof useForm<NoteForm>>["watch"];
  register: ReturnType<typeof useForm<NoteForm>>["register"];
  handleSubmit: ReturnType<typeof useForm<NoteForm>>["handleSubmit"];
  setValue: ReturnType<typeof useForm<NoteForm>>["setValue"];
  saveNoteMutation: {
    isPending: boolean;
    mutate: (data: NoteForm & { callId: string | null }) => void;
  };
  activeCallId: string | null;
  onSkip: () => void;
  twilioStatus: string | null;
  twilioStatusLoading: boolean;
  onRefreshStatus: () => void;
}) {
  return (
    <form
      onSubmit={handleSubmit((data) => {
        saveNoteMutation.mutate({ ...data, callId: activeCallId });
      })}
      className="space-y-4"
    >
      {/* Badge de status retornado pelo Twilio */}
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <PhoneCall className="size-3.5 shrink-0 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Status Twilio
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {twilioStatusLoading ? (
            <LoaderCircle className="size-3.5 animate-spin text-slate-400" />
          ) : twilioStatus ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                TWILIO_STATUS_COLORS[twilioStatus] ??
                  "bg-slate-100 text-slate-600",
              )}
            >
              {TWILIO_STATUS_LABELS[twilioStatus] ?? twilioStatus}
            </span>
          ) : (
            <span className="text-xs italic text-slate-400">—</span>
          )}
          <button
            type="button"
            onClick={onRefreshStatus}
            disabled={twilioStatusLoading}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 disabled:opacity-40"
            title="Atualizar status"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </div>

      {/* Status manual (permite corrigir caso o Twilio não tenha atualizado) */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Status da chamada
        </Label>
        <Select
          value={watch("status") ?? "encerrada"}
          onValueChange={(v) =>
            setValue("status", v as NonNullable<NoteForm["status"]>)
          }
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resultado (perspectiva comercial) */}
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
  } = useTwilioDeviceContext();

  const [callMode, setCallMode] = useState<"humano" | "ia">("humano");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [aiCallSid, setAiCallSid] = useState<string | null>(null);
  const [aiCallStatus, setAiCallStatus] = useState<string | null>(null);

  const [number, setNumber] = useState("");
  const [callerId, setCallerId] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(
    null,
  );
  const [manualClientName, setManualClientName] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<string | null>(null);
  const [twilioStatusLoading, setTwilioStatusLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  // Em desktop (xl) a coluna de clientes fica sempre visível; em mobile começa fechada
  const [showClients, setShowClients] = useState(true);
  // Rastreia o breakpoint xl (≥1280px) de forma reativa para evitar
  // que o backdrop do Sheet apareça em telas grandes
  const [isXl, setIsXl] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1280,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsXl(e.matches);
      if (e.matches) setShowClients(true);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const search = useSearch();
  const callButtonRef = useRef<HTMLButtonElement>(null);
  const noteFormRef = useRef<HTMLDivElement>(null);
  const prevCallStatusRef = useRef(callStatus);

  // Pré-preenche o discador quando vindo da página de clientes via URL params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const phoneParam = params.get("phone");
    const clientIdParam = params.get("clientId");
    const clientNameParam = params.get("clientName");
    if (!phoneParam) return;
    setNumber(phoneParam);
    if (clientIdParam) setSelectedClientId(clientIdParam);
    if (clientNameParam) {
      setSelectedClientName(clientNameParam);
      if (!clientIdParam) setManualClientName(clientNameParam);
    }
    // Limpa os params da URL sem recarregar a página
    window.history.replaceState({}, "", "/telemarketing");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Detecta encerramento remoto da chamada (a outra parte desliga)
  // e garante que o modal de resultado sempre seja exibido
  useEffect(() => {
    const prev = prevCallStatusRef.current;
    prevCallStatusRef.current = callStatus;

    const wasInCall =
      prev === "in-progress" || prev === "ringing" || prev === "connecting";

    if (callStatus === "disconnected" && wasInCall) {
      setShowNote(true);
    }
  }, [callStatus]);

  // Rola até o formulário assim que ele aparece
  useEffect(() => {
    if (!showNote) return;
    const frame = requestAnimationFrame(() => {
      noteFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [showNote]);

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

  const { data: agents = [] } = useQuery<{ agentId: string; name: string }[]>({
    queryKey: ["/api/elevenlabs/agents"],
    queryFn: async () => {
      const res = await fetch("/api/elevenlabs/agents", { credentials: "include" });
      if (!res.ok) return [];
      const data = (await res.json()) as { agents?: { agentId: string; name: string }[] } | { agentId: string; name: string }[];
      return Array.isArray(data) ? data : (data.agents ?? []);
    },
    staleTime: 60_000,
  });

  // Polling do status quando há chamada IA em andamento
  useEffect(() => {
    if (!aiCallSid) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/twilio/test-call/${aiCallSid}/status`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string };
        setAiCallStatus(data.status);
        if (["completed", "failed", "busy", "no-answer", "canceled"].includes(data.status)) {
          setAiCallSid(null);
          setShowNote(true);
        }
      } catch {
        // silencioso
      }
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [aiCallSid]);

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

  const { data: myClients = [], isFetching: clientsFetching } = useQuery<
    Client[]
  >({
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
    defaultValues: { notes: "", outcome: "atendeu", status: "encerrada" },
  });

  const fetchTwilioStatus = useCallback(async () => {
    if (!activeCallId) return;
    setTwilioStatusLoading(true);
    try {
      const res = await fetch(`/api/calls/${activeCallId}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const call = (await res.json()) as { status: string; outcome?: string };
      setTwilioStatus(call.status);
      // Auto-preenche os selects com base no status retornado pelo Twilio
      const mappedOutcome = mapStatusToOutcome(call.status);
      setValue("outcome", mappedOutcome);
      const mappedStatus = CALL_STATUS_OPTIONS.find(
        (o) => o.value === call.status,
      );
      if (mappedStatus)
        setValue(
          "status",
          mappedStatus.value as NonNullable<NoteForm["status"]>,
        );
    } catch (e) {
      console.warn("[dialer] Falha ao buscar status Twilio:", e);
    } finally {
      setTwilioStatusLoading(false);
    }
  }, [activeCallId, setValue]);

  // Busca o status Twilio após 1.5s (tempo para o webhook processar)
  useEffect(() => {
    if (!showNote || !activeCallId) return;
    const timer = setTimeout(fetchTwilioStatus, 1500);
    return () => clearTimeout(timer);
  }, [showNote, activeCallId, fetchTwilioStatus]);

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
          status: data.status ?? "encerrada",
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar anotação");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Anotação salva" });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"], exact: false });
      setShowNote(false);
      setTwilioStatus(null);
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
    setTwilioStatus(null);
    setActiveCallId(null);
    setSelectedClientId(null);
    setSelectedClientName(null);
    setManualClientName("");
    reset();
  }, [reset]);

  const handleKey = useCallback((key: string) => {
    setNumber((n) => sanitizePhone(n + key));
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
        description: "Digite o nome do contato antes de ligar.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedClientId && manualClientName.trim()) {
      setSelectedClientName(manualClientName.trim());
    }

    // ── Modo IA: chama via servidor com agente ElevenLabs ──────────────────
    if (callMode === "ia") {
      if (!selectedAgentId) {
        toast({ title: "Selecione um agente IA", variant: "destructive" });
        return;
      }
      const callRecordId = await createCallRecord({
        clientId: selectedClientId ?? undefined,
        toPhone: !selectedClientId ? number : undefined,
        contactName: !selectedClientId ? manualClientName.trim() || undefined : undefined,
      });
      if (callRecordId) setActiveCallId(callRecordId);

      try {
        const res = await fetch("/api/twilio/test-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phone: number,
            elevenlabsAgentId: selectedAgentId,
            callerId: from,
            callRecordId: callRecordId || undefined,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { message?: string };
          toast({
            title: "Erro ao iniciar chamada IA",
            description: err.message,
            variant: "destructive",
          });
          return;
        }
        const data = (await res.json()) as { callSid: string; callRecordId?: string };
        setAiCallSid(data.callSid);
        setAiCallStatus("iniciando");
        if (data.callRecordId && !callRecordId) setActiveCallId(data.callRecordId);
      } catch (e) {
        toast({ title: "Erro de conexão ao iniciar chamada IA", variant: "destructive" });
      }
      return;
    }

    // ── Modo Humano: chama via SDK no navegador ────────────────────────────
    const callRecordId = await createCallRecord({
      clientId: selectedClientId ?? undefined,
      toPhone: !selectedClientId ? number : undefined,
      contactName: !selectedClientId
        ? manualClientName.trim() || undefined
        : undefined,
    });

    if (callRecordId) {
      setActiveCallId(callRecordId);
    } else {
      console.error("[dialer] POST /api/calls falhou após 2 tentativas");
      toast({
        title: "Aviso",
        description:
          "Não foi possível registrar a chamada previamente. O histórico será criado ao encerrar.",
        variant: "destructive",
      });
    }

    await connect(number, from, callRecordId ? { callRecordId } : undefined);
  }, [number, callerId, channels, selectedClientId, manualClientName, callMode, selectedAgentId, connect]);

  const handleCallClient = useCallback(
    (client: Client) => {
      if (!client.phone) return;
      setNumber(client.phone);
      setSelectedClientId(client.id);
      setSelectedClientName(client.name);
      setManualClientName("");
      // Em mobile fecha o painel; em desktop mantém aberto
      if (!isXl) setShowClients(false);
      // Foca no botão de ligar para facilitar o fluxo com Enter
      setTimeout(() => callButtonRef.current?.focus(), 50);
    },
    [isXl],
  );

  const handleHangup = useCallback(async () => {
    // ── Modo IA: encerra via API Twilio (servidor) ─────────────────────────
    if (callMode === "ia" && aiCallSid) {
      try {
        await fetch(`/api/twilio/test-call/${aiCallSid}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch (e) {
        console.warn("[dialer] Falha ao encerrar chamada IA:", e);
      }
      setAiCallSid(null);
      setAiCallStatus(null);
      setShowNote(true);
      return;
    }

    // ── Modo Humano: encerra via SDK ───────────────────────────────────────
    disconnect();

    let resolvedCallId = activeCallId;

    if (!resolvedCallId && callSid) {
      resolvedCallId = await createCallRecord({
        twilioCallSid: callSid,
        clientId: selectedClientId ?? undefined,
        toPhone: !selectedClientId ? number : undefined,
        contactName: !selectedClientId
          ? manualClientName.trim() || undefined
          : undefined,
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
  }, [
    callMode,
    aiCallSid,
    disconnect,
    activeCallId,
    callSid,
    selectedClientId,
    number,
    manualClientName,
  ]);

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
    callStatus === "connecting" ||
    aiCallSid !== null;

  const deviceBadgeVariant =
    deviceStatus === "registered"
      ? "default"
      : deviceStatus === "error"
        ? "destructive"
        : "secondary";

  const activeChannel = callerId
    ? channels.find((c) => c.number === callerId)
    : channels[0];

  if (isCheckingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin text-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Verificando configuração…
          </span>
        </div>
      </div>
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
    twilioStatus,
    twilioStatusLoading,
    onRefreshStatus: fetchTwilioStatus,
  };

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
      {/* ── Coluna esquerda: discador ── */}
      <div className="space-y-5 xl:sticky xl:top-6">
        <Card className="border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
          <CardContent className="space-y-4 p-5 sm:p-6">
            {/* Status do dispositivo */}
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5",
                deviceStatus === "error"
                  ? "border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  : inCall || deviceStatus === "registered"
                    ? "border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                    : "border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    deviceStatus === "error"
                      ? "bg-red-500"
                      : inCall || deviceStatus === "registered"
                        ? "bg-emerald-500"
                        : "animate-pulse bg-amber-500",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-xs font-semibold",
                    deviceStatus === "error"
                      ? "text-red-600 dark:text-red-400"
                      : inCall || deviceStatus === "registered"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-600 dark:text-slate-400",
                  )}
                >
                  {aiCallSid
                    ? `IA · ${aiCallStatus ?? "iniciando"}…`
                    : inCall
                      ? `${CALL_STATUS_LABELS[callStatus]}${callStatus === "in-progress" ? ` · ${formatElapsed(elapsedSeconds)}` : ""}`
                      : callMode === "ia"
                        ? "Modo IA — agente ElevenLabs"
                        : errorMessage ||
                          `${DEVICE_STATUS_LABELS[deviceStatus]} — áudio no navegador`}
                </span>
              </div>
              {errorMessage ? (
                <button
                  type="button"
                  onClick={clearError}
                  className="shrink-0 rounded-full p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
                  aria-label="Fechar erro"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            {/* Toggle de modo: Humano / IA */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => !inCall && setCallMode("humano")}
                disabled={inCall}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                  callMode === "humano"
                    ? "bg-white shadow-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
                )}
              >
                <Phone className="size-3.5" />
                Humano
              </button>
              <button
                type="button"
                onClick={() => !inCall && setCallMode("ia")}
                disabled={inCall}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                  callMode === "ia"
                    ? "bg-white shadow-sm text-violet-700 dark:bg-slate-800 dark:text-violet-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
                )}
              >
                <Bot className="size-3.5" />
                IA
              </button>
            </div>

            {/* Agente ElevenLabs (apenas no modo IA) */}
            {callMode === "ia" && (
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Agente IA
                </Label>
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                  disabled={inCall}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue
                      placeholder={
                        agents.length === 0
                          ? "Nenhum agente configurado"
                          : "Selecione o agente"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.agentId} value={a.agentId}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Canal de saída */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Canal de saída
              </Label>
              <Select
                value={callerId || channels[0]?.number || ""}
                onValueChange={setCallerId}
                disabled={inCall || channels.length === 0}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue
                    placeholder={
                      channels.length === 0
                        ? "Nenhum canal configurado"
                        : "Selecione o canal"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.number} value={ch.number}>
                      {ch.label} {ch.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome do cliente (digitação manual quando não há cliente selecionado) */}
            {!selectedClientId && (
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Nome do cliente
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={manualClientName}
                    onChange={(e) => setManualClientName(e.target.value)}
                    placeholder="Nome do contato"
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm shadow-none dark:border-slate-800 dark:bg-slate-950"
                    disabled={inCall}
                  />
                </div>
              </div>
            )}

            {/* Display do número */}
            <Input
              value={formatDialerDisplay(number)}
              onChange={(e) => setNumber(sanitizePhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="h-14 rounded-2xl border-slate-200 bg-slate-50 text-center font-mono text-2xl shadow-none dark:border-slate-800 dark:bg-slate-950"
              disabled={inCall}
              inputMode="tel"
            />

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {KEYPAD.flat().map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  className="flex h-14 flex-col items-center justify-center gap-0 rounded-2xl border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 sm:h-[58px]"
                  onClick={() => handleKey(key)}
                  disabled={inCall}
                >
                  <span className="text-xl font-semibold leading-tight">
                    {key}
                  </span>
                  {KEYPAD_LABELS[key] ? (
                    <span className="text-[8px] font-medium leading-none tracking-widest text-slate-400">
                      {KEYPAD_LABELS[key]}
                    </span>
                  ) : (
                    <span className="text-[8px] leading-none">&nbsp;</span>
                  )}
                </Button>
              ))}
            </div>

            {/* Apagar + Limpar */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 gap-2 rounded-xl border-slate-200 text-sm font-medium dark:border-slate-800"
                onClick={handleBackspace}
                disabled={inCall || !number}
              >
                <Delete className="size-4" />
                Apagar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl px-5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => setNumber("")}
                disabled={inCall || !number}
              >
                Limpar
              </Button>
            </div>

            {/* Botão de chamada */}
            {!inCall ? (
              <Button
                ref={callButtonRef}
                onClick={handleCall}
                disabled={
                  !number ||
                  (!selectedClientId && !manualClientName.trim()) ||
                  (callMode === "humano" && deviceStatus !== "registered") ||
                  (callMode === "ia" && !selectedAgentId)
                }
                className={cn(
                  "h-12 w-full gap-2.5 rounded-xl text-base font-semibold transition-all",
                  callMode === "ia"
                    ? "bg-violet-600 shadow-[0_4px_14px_-2px_rgba(124,58,237,0.4)] hover:bg-violet-700 dark:shadow-violet-900/40"
                    : "bg-emerald-500 shadow-[0_4px_14px_-2px_rgba(16,185,129,0.4)] hover:bg-emerald-600 dark:shadow-emerald-900/40",
                )}
              >
                {callMode === "ia" ? (
                  <Bot className="size-5" />
                ) : (
                  <Phone className="size-5" />
                )}
                Ligar
              </Button>
            ) : (
              <div className="flex gap-3">
                {/* Botão de mudo: apenas no modo humano */}
                {callMode === "humano" && (
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    className="h-12 w-12 shrink-0 rounded-xl p-0 transition-all border-slate-200 dark:border-slate-800"
                  >
                    {isMuted ? (
                      <MicOff className="size-5 text-red-500" />
                    ) : (
                      <Mic className="size-5" />
                    )}
                  </Button>
                )}
                <Button
                  onClick={handleHangup}
                  className="h-12 flex-1 gap-2.5 rounded-xl bg-red-500 text-base font-semibold shadow-[0_4px_14px_-2px_rgba(239,68,68,0.4)] transition-all hover:bg-red-600 dark:shadow-red-900/40"
                >
                  <PhoneOff className="size-5" />
                  Desligar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulário de anotação pós-chamada — inline em desktop */}
        {showNote && (
          <>
            {/* Desktop: inline abaixo do discador */}
            <Card
              ref={noteFormRef}
              className="hidden xl:block animate-in slide-in-from-bottom-2 duration-200 border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl"
            >
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

            {/* Mobile: bottom sheet — só monta em telas < xl para o backdrop não cobrir a tela */}
            {!isXl && (
              <Sheet
                open={showNote}
                onOpenChange={(open) => {
                  if (!open) handleSkipNote();
                }}
              >
                <SheetContent side="bottom" className="rounded-t-3xl pb-8 px-5">
                  <SheetHeader className="mb-4 text-left">
                    <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      Resultado da chamada
                    </SheetTitle>
                  </SheetHeader>
                  <NoteForm {...noteFormProps} />
                </SheetContent>
              </Sheet>
            )}
          </>
        )}
      </div>

      {/* ── Coluna direita: lista de clientes ── */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-slate-900 rounded-3xl min-h-[420px] xl:min-h-[560px] flex flex-col overflow-hidden">
        <CardHeader className="gap-4 border-b border-slate-100 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-900/70">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left xl:cursor-default"
            onClick={() => {
              if (!isXl) setShowClients((v) => !v);
            }}
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
              <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px] xl:max-h-[560px] pr-2 -mr-2 custom-scrollbar">
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
                  <div className="flex items-center gap-2 px-2 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <LoaderCircle className="size-4 animate-spin text-blue-500" />
                    Buscando clientes...
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
                        "flex items-start justify-between gap-3 rounded-2xl border px-3 py-3 transition-colors",
                        selectedClientId === client.id
                          ? "border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/20"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/80",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {client.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
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
                        variant={
                          selectedClientId === client.id ? "default" : "outline"
                        }
                        className={cn(
                          "ml-2 mt-0.5 shrink-0 rounded-xl gap-1.5",
                          selectedClientId === client.id
                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                        )}
                        disabled={inCall || deviceStatus !== "registered"}
                        onClick={() => handleCallClient(client)}
                      >
                        <Phone className="size-3" />
                        <span className="hidden sm:inline">Selecionar</span>
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
