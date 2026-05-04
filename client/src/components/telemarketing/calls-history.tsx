import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import {
  FileText,
  Clock,
  Phone,
  Mic,
  FileAudio,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  User,
  Loader2,
  Bot,
} from "lucide-react";

type Call = {
  id: string;
  clientId: string | null;
  campaignId: string | null;
  twilioCallSid: string | null;
  elevenLabsConversationId: string | null;
  status: string;
  outcome: string | null;
  duration: number | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  twilioTranscription: string | null;
  transcription: string | null;
  summary: string | null;
  aiDecision: string | null;
  sentiment: string | null;
  notes: string | null;
  clientName: string | null;
  clientPhone: string | null;
  toPhone: string | null;
  contactName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  iniciando:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_andamento:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  encerrada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nao_atendeu:
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  ocupado:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  falhou: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  caixa_postal:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const STATUS_LABELS: Record<string, string> = {
  iniciando: "Iniciando",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  falhou: "Falhou",
  caixa_postal: "Caixa postal",
};

const OUTCOME_LABELS: Record<string, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  caixa_postal: "Caixa postal",
  numero_invalido: "Número inválido",
  convertido: "Convertido",
  reagendado: "Reagendado",
};

const AI_DECISION_LABELS: Record<string, string> = {
  sim: "Sim",
  nao: "Não",
  sem_resposta: "Sem resposta",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positivo: "text-emerald-600 dark:text-emerald-400",
  neutro: "text-slate-500",
  negativo: "text-red-500",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type TranscriptTurn = { role: "agent" | "client"; message: string };

// Prefixos de agente: "Agent: ", "agent: " (formato legado do ElevenLabs)
const AGENT_PREFIXES = ["agent: ", "agente: "];
// Prefixos de cliente: "Cliente: ", "user: " (role nativo do ElevenLabs)
const CLIENT_PREFIXES = ["cliente: ", "user: "];

function parseTranscript(text: string): TranscriptTurn[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const lower = line.toLowerCase();
      for (const prefix of AGENT_PREFIXES) {
        if (lower.startsWith(prefix)) {
          return { role: "agent" as const, message: line.slice(prefix.length) };
        }
      }
      for (const prefix of CLIENT_PREFIXES) {
        if (lower.startsWith(prefix)) {
          return {
            role: "client" as const,
            message: line.slice(prefix.length),
          };
        }
      }
      return { role: "client" as const, message: line };
    });
}

function TranscriptView({ text }: { text: string }) {
  const turns = parseTranscript(text);
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {turns.map((turn, i) => (
        <div
          key={i}
          className={`flex ${turn.role === "agent" ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              turn.role === "agent"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none"
                : "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-tr-none"
            }`}
          >
            <span className="block text-[10px] font-semibold mb-0.5 opacity-50 uppercase tracking-wide">
              {turn.role === "agent" ? "Agente IA" : "Cliente"}
            </span>
            {turn.message}
          </div>
        </div>
      ))}
    </div>
  );
}

function getChannel(call: Call): "elevenlabs" | "twilio" | null {
  if (call.elevenLabsConversationId) return "elevenlabs";
  if (call.twilioCallSid) return "twilio";
  return null;
}

function ChannelBadge({
  call,
  size = "sm",
}: {
  call: Call;
  size?: "sm" | "xs";
}) {
  const channel = getChannel(call);
  if (!channel) return null;
  if (channel === "elevenlabs") {
    return (
      <span
        title="ElevenLabs IA"
        className={`inline-flex items-center gap-1 rounded-full font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 whitespace-nowrap ${
          size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
        }`}
      >
        <Bot className={size === "xs" ? "size-2.5" : "size-3"} />
        ElevenLabs
      </span>
    );
  }
  return (
    <span
      title="Twilio"
      className={`inline-flex items-center gap-1 rounded-full font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 whitespace-nowrap ${
        size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
      }`}
    >
      <Phone className={size === "xs" ? "size-2.5" : "size-3"} />
      Twilio
    </span>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CallsHistory() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  // Rastreia IDs já auto-sincronizados para não repetir na mesma sessão
  const autoSyncedRef = useRef<Set<string>>(new Set());

  const { data, isLoading, isFetching } = useQuery<{
    data: Call[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/calls", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/calls?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar chamadas");
      return res.json();
    },
  });

  // Sync transcrição ElevenLabs
  const syncElevenLabsMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/calls/${callId}/sync-transcript`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao sincronizar");
      }
      return res.json() as Promise<Call>;
    },
    onSuccess: (updated) => {
      setSelectedCall((prev) =>
        prev?.id === updated.id ? { ...prev, ...updated } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
    },
    onError: () => {},
  });

  // Sync gravação do Twilio
  const syncRecordingMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/calls/${callId}/sync-recording`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao buscar gravação");
      }
      return res.json() as Promise<Call>;
    },
    onSuccess: (updated) => {
      setSelectedCall((prev) =>
        prev?.id === updated.id ? { ...prev, ...updated } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
    },
    onError: () => {},
  });

  // Sync transcrição Twilio Voice Intelligence
  const syncTwilioTranscriptMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/calls/${callId}/sync-twilio-transcript`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao solicitar transcrição");
      }
      return res.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {},
    onError: () => {},
  });

  // Auto-sync ao abrir o dialog
  useEffect(() => {
    if (!selectedCall) return;
    if (autoSyncedRef.current.has(selectedCall.id)) return;
    autoSyncedRef.current.add(selectedCall.id);

    // ElevenLabs: buscar transcrição se ainda não chegou via webhook
    if (selectedCall.elevenLabsConversationId && !selectedCall.transcription) {
      syncElevenLabsMutation.mutate(selectedCall.id);
    }

    // Twilio: buscar gravação se chamada não é ElevenLabs e ainda sem recordingUrl
    if (
      !selectedCall.elevenLabsConversationId &&
      selectedCall.twilioCallSid &&
      !selectedCall.recordingUrl
    ) {
      syncRecordingMutation.mutate(selectedCall.id);
    }

    // Twilio: solicitar transcrição Voice Intelligence se gravação existe mas transcript não
    if (selectedCall.recordingSid && !selectedCall.twilioTranscription) {
      syncTwilioTranscriptMutation.mutate(selectedCall.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCall?.id]);

  const calls = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Histórico de chamadas
          </h2>
          {data?.total != null && (
            <p className="text-xs text-slate-400 mt-0.5">
              {data.total} chamada{data.total !== 1 ? "s" : ""} registrada
              {data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-52 rounded-2xl">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="nao_atendeu">Não atendeu</SelectItem>
            <SelectItem value="ocupado">Ocupado</SelectItem>
            <SelectItem value="caixa_postal">Caixa postal</SelectItem>
            <SelectItem value="falhou">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative min-h-[200px]">
        {isFetching && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-blue-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Carregando chamadas…
              </span>
            </div>
          </div>
        )}
        {!isLoading && calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Phone className="size-7 opacity-40" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhuma chamada encontrada
            </p>
            {statusFilter !== "all" && (
              <button
                className="text-xs text-blue-500 hover:underline mt-1"
                onClick={() => setStatusFilter("all")}
              >
                Limpar filtro
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors group"
                onClick={() => setSelectedCall(call)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                      call.status === "encerrada"
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : call.status === "nao_atendeu" ||
                            call.status === "falhou"
                          ? "bg-slate-100 dark:bg-slate-800"
                          : "bg-blue-100 dark:bg-blue-900/30"
                    }`}
                  >
                    <Phone
                      className={`size-3.5 ${
                        call.status === "encerrada"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : call.status === "nao_atendeu" ||
                              call.status === "falhou"
                            ? "text-slate-400"
                            : "text-blue-600 dark:text-blue-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {call.clientName ??
                        call.contactName ??
                        call.clientPhone ??
                        call.toPhone ??
                        call.twilioCallSid?.slice(0, 16) ??
                        call.id.slice(0, 8)}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                      {(call.clientPhone ?? call.toPhone) &&
                        (call.clientName ?? call.contactName) && (
                          <span className="font-mono">
                            {call.clientPhone ?? call.toPhone}
                          </span>
                        )}
                      {(call.clientPhone ?? call.toPhone) &&
                        (call.clientName ?? call.contactName) && <span>·</span>}
                      <Clock className="size-3 shrink-0" />
                      <span>{formatDuration(call.duration)}</span>
                      <span>·</span>
                      <span>
                        {formatDateTime(call.startedAt ?? call.createdAt)}
                      </span>
                      {call.outcome && (
                        <>
                          <span>·</span>
                          <span>
                            {OUTCOME_LABELS[call.outcome] ?? call.outcome}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {(call.recordingUrl || call.elevenLabsConversationId) && (
                    <span
                      title="Gravação disponível"
                      className="size-6 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20"
                    >
                      <FileAudio className="size-3.5 text-blue-500" />
                    </span>
                  )}
                  {(call.twilioTranscription || call.transcription) && (
                    <span
                      title="Transcrição disponível"
                      className="size-6 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                    >
                      <FileText className="size-3.5 text-emerald-500" />
                    </span>
                  )}
                  <ChannelBadge call={call} size="xs" />
                  {call.aiDecision === "sim" && (
                    <span
                      title="Aceitou o convite"
                      className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="size-3" />
                      SIM
                    </span>
                  )}
                  {call.aiDecision === "nao" && (
                    <span
                      title="Recusou o convite"
                      className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                    >
                      <XCircle className="size-3" />
                      NÃO
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap hidden sm:inline-block ${STATUS_COLORS[call.status] ?? ""}`}
                  >
                    {STATUS_LABELS[call.status] ?? call.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginação */}
      {(page > 1 || data?.hasMore) && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl gap-1"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <span className="text-xs text-slate-400 px-2">Página {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl gap-1"
          >
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Dialog de detalhes */}
      {selectedCall && (
        <Dialog
          open={!!selectedCall}
          onOpenChange={(v) => !v && setSelectedCall(null)}
        >
          <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
            <DialogHeader className="pb-0">
              <DialogTitle className="sr-only">Detalhes da chamada</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Identidade do cliente */}
              <div className="flex items-center gap-3 pt-1">
                <div className="size-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <User className="size-5 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-base leading-tight truncate">
                    {selectedCall.clientName ??
                      selectedCall.contactName ??
                      "Cliente desconhecido"}
                  </p>
                  {(selectedCall.clientPhone ?? selectedCall.toPhone) && (
                    <p className="text-sm text-slate-400 font-mono mt-0.5">
                      {selectedCall.clientPhone ?? selectedCall.toPhone}
                    </p>
                  )}
                </div>
                <span
                  className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[selectedCall.status] ?? ""}`}
                >
                  {STATUS_LABELS[selectedCall.status] ?? selectedCall.status}
                </span>
              </div>

              {/* Banner de resposta ao convite */}
              {selectedCall.aiDecision ? (
                <div
                  className={`flex items-start gap-3 p-4 rounded-2xl ${
                    selectedCall.aiDecision === "sim"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                      : selectedCall.aiDecision === "nao"
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                        : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {selectedCall.aiDecision === "sim" ? (
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : selectedCall.aiDecision === "nao" ? (
                    <XCircle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <MinusCircle className="size-5 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        selectedCall.aiDecision === "sim"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : selectedCall.aiDecision === "nao"
                            ? "text-red-700 dark:text-red-300"
                            : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {selectedCall.aiDecision === "sim"
                        ? "Aceitou o convite"
                        : selectedCall.aiDecision === "nao"
                          ? "Recusou o convite"
                          : "Sem resposta ao convite"}
                    </p>
                    {selectedCall.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {selectedCall.notes}
                      </p>
                    )}
                  </div>
                </div>
              ) : selectedCall.notes ? (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Observações</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {selectedCall.notes}
                  </p>
                </div>
              ) : null}

              {/* Grade de detalhes */}
              <section>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Detalhes
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Canal</p>
                    <div className="mt-0.5">
                      <ChannelBadge call={selectedCall} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Duração</p>
                    <p className="font-medium">
                      {formatDuration(selectedCall.duration)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Início</p>
                    <p className="font-medium">
                      {formatDateTime(
                        selectedCall.startedAt ?? selectedCall.createdAt,
                      )}
                    </p>
                  </div>
                  {selectedCall.endedAt && (
                    <div>
                      <p className="text-xs text-slate-400">Fim</p>
                      <p className="font-medium">
                        {formatDateTime(selectedCall.endedAt)}
                      </p>
                    </div>
                  )}
                  {selectedCall.outcome && (
                    <div>
                      <p className="text-xs text-slate-400">Resultado</p>
                      <p className="font-medium">
                        {OUTCOME_LABELS[selectedCall.outcome] ??
                          selectedCall.outcome}
                      </p>
                    </div>
                  )}
                  {selectedCall.sentiment && (
                    <div>
                      <p className="text-xs text-slate-400">Sentimento</p>
                      <p
                        className={`font-medium capitalize ${SENTIMENT_COLORS[selectedCall.sentiment] ?? ""}`}
                      >
                        {selectedCall.sentiment}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Gravação */}
              <section>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Gravação
                </p>
                {selectedCall.elevenLabsConversationId ? (
                  <audio
                    controls
                    src={`/api/elevenlabs/audio/${selectedCall.id}`}
                    className="w-full rounded-xl"
                  />
                ) : syncRecordingMutation.isPending ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Buscando gravação…
                  </div>
                ) : selectedCall.recordingUrl ? (
                  <audio
                    controls
                    src={`/api/twilio/recording/${selectedCall.id}`}
                    className="w-full rounded-xl"
                  />
                ) : (
                  <p className="text-xs text-slate-400 py-2">
                    Sem gravação disponível para esta chamada.
                  </p>
                )}
              </section>

              {/* Resumo */}
              {selectedCall.summary && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Resumo
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                    {selectedCall.summary}
                  </p>
                </section>
              )}

              {/* Notas do operador */}
              {selectedCall.notes && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Anotações
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                    {selectedCall.notes}
                  </p>
                </section>
              )}

              {/* Transcrição ElevenLabs */}
              {selectedCall.elevenLabsConversationId && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <FileText className="size-3" />
                    Transcrição
                  </p>
                  {syncElevenLabsMutation.isPending ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Buscando transcrição…
                    </div>
                  ) : selectedCall.transcription ? (
                    <TranscriptView text={selectedCall.transcription} />
                  ) : (
                    <p className="text-xs text-slate-400 py-1">
                      Transcrição não disponível para esta chamada.
                    </p>
                  )}
                </section>
              )}

              {/* Transcrição Twilio Voice Intelligence */}
              {!selectedCall.elevenLabsConversationId &&
                (selectedCall.recordingSid ||
                  selectedCall.twilioTranscription) && (
                  <section>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Mic className="size-3" />
                      Transcrição
                    </p>
                    {syncTwilioTranscriptMutation.isPending ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                        <Loader2 className="size-3.5 animate-spin" />
                        Solicitando transcrição ao Twilio…
                      </div>
                    ) : selectedCall.twilioTranscription ? (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                        {selectedCall.twilioTranscription}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-1">
                        Transcrição sendo processada pelo Twilio Voice
                        Intelligence.
                      </p>
                    )}
                  </section>
                )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
