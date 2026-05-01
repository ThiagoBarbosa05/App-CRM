import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  RefreshCw,
  FileText,
  Clock,
  Phone,
  Mic,
  FileAudio,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Call = {
  id: string;
  clientId: string | null;
  campaignId: string | null;
  twilioCallSid: string | null;
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
  iniciando: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  encerrada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nao_atendeu: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  ocupado: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  falhou: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  caixa_postal: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
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

  const { data, isLoading } = useQuery<{
    data: Call[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/calls", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/calls?${params}`, { credentials: "include" });
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
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Erro ao sincronizar");
      }
      return res.json() as Promise<Call>;
    },
    onSuccess: (updated) => {
      setSelectedCall(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({ title: "Transcrição ElevenLabs sincronizada" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Sync gravação do Twilio
  const syncRecordingMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/calls/${callId}/sync-recording`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Erro ao buscar gravação");
      }
      return res.json() as Promise<Call>;
    },
    onSuccess: (updated) => {
      setSelectedCall(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({ title: "Gravação encontrada e vinculada" });
    },
    onError: (err: Error) =>
      toast({ title: "Gravação não encontrada", description: err.message, variant: "destructive" }),
  });

  // Sync transcrição Twilio Voice Intelligence
  const syncTwilioTranscriptMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/calls/${callId}/sync-twilio-transcript`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Erro ao solicitar transcrição");
      }
      return res.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      toast({
        title: "Transcrição solicitada",
        description: "O Twilio Voice Intelligence processará a transcrição e ela aparecerá automaticamente.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const calls = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Histórico de chamadas</h2>
          {data?.total != null && (
            <p className="text-xs text-slate-400 mt-0.5">{data.total} chamada{data.total !== 1 ? "s" : ""} registrada{data.total !== 1 ? "s" : ""}</p>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Phone className="size-7 opacity-40" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma chamada encontrada</p>
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
                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                  call.status === "encerrada"
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : call.status === "nao_atendeu" || call.status === "falhou"
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}>
                  <Phone className={`size-3.5 ${
                    call.status === "encerrada"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : call.status === "nao_atendeu" || call.status === "falhou"
                      ? "text-slate-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {call.clientName ?? call.contactName ?? call.clientPhone ?? call.toPhone ?? call.twilioCallSid?.slice(0, 16) ?? call.id.slice(0, 8)}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                    {(call.clientPhone ?? call.toPhone) && (call.clientName ?? call.contactName) && (
                      <span className="font-mono">{call.clientPhone ?? call.toPhone}</span>
                    )}
                    {(call.clientPhone ?? call.toPhone) && (call.clientName ?? call.contactName) && <span>·</span>}
                    <Clock className="size-3 shrink-0" />
                    <span>{formatDuration(call.duration)}</span>
                    <span>·</span>
                    <span>{formatDateTime(call.startedAt ?? call.createdAt)}</span>
                    {call.outcome && (
                      <>
                        <span>·</span>
                        <span>{OUTCOME_LABELS[call.outcome] ?? call.outcome}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {call.recordingUrl && (
                  <span title="Gravação disponível" className="size-6 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <FileAudio className="size-3.5 text-blue-500" />
                  </span>
                )}
                {(call.twilioTranscription || call.transcription) && (
                  <span title="Transcrição disponível" className="size-6 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <FileText className="size-3.5 text-emerald-500" />
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
        <Dialog open={!!selectedCall} onOpenChange={(v) => !v && setSelectedCall(null)}>
          <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base">
                {selectedCall.clientName ?? selectedCall.contactName ?? selectedCall.clientPhone ?? selectedCall.toPhone ?? selectedCall.twilioCallSid?.slice(0, 20) ?? selectedCall.id.slice(0, 8)}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {/* Detalhes */}
              <section>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Detalhes</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${STATUS_COLORS[selectedCall.status] ?? ""}`}>
                      {STATUS_LABELS[selectedCall.status] ?? selectedCall.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Duração</p>
                    <p className="font-medium">{formatDuration(selectedCall.duration)}</p>
                  </div>
                  {(selectedCall.clientPhone ?? selectedCall.toPhone) && (
                    <div>
                      <p className="text-xs text-slate-400">Telefone</p>
                      <p className="font-medium font-mono">{selectedCall.clientPhone ?? selectedCall.toPhone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400">Início</p>
                    <p className="font-medium">{formatDateTime(selectedCall.startedAt ?? selectedCall.createdAt)}</p>
                  </div>
                  {selectedCall.endedAt && (
                    <div>
                      <p className="text-xs text-slate-400">Fim</p>
                      <p className="font-medium">{formatDateTime(selectedCall.endedAt)}</p>
                    </div>
                  )}
                  {selectedCall.outcome && (
                    <div>
                      <p className="text-xs text-slate-400">Resultado</p>
                      <p className="font-medium">{OUTCOME_LABELS[selectedCall.outcome] ?? selectedCall.outcome}</p>
                    </div>
                  )}
                  {selectedCall.aiDecision && (
                    <div>
                      <p className="text-xs text-slate-400">Decisão IA</p>
                      <p className="font-medium">{AI_DECISION_LABELS[selectedCall.aiDecision] ?? selectedCall.aiDecision}</p>
                    </div>
                  )}
                  {selectedCall.sentiment && (
                    <div>
                      <p className="text-xs text-slate-400">Sentimento</p>
                      <p className={`font-medium capitalize ${SENTIMENT_COLORS[selectedCall.sentiment] ?? ""}`}>
                        {selectedCall.sentiment}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Gravação */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Gravação</p>
                  {!selectedCall.recordingUrl && selectedCall.twilioCallSid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1 rounded-lg"
                      onClick={() => syncRecordingMutation.mutate(selectedCall.id)}
                      disabled={syncRecordingMutation.isPending}
                    >
                      <RefreshCw className={`size-3 ${syncRecordingMutation.isPending ? "animate-spin" : ""}`} />
                      Buscar no Twilio
                    </Button>
                  )}
                </div>
                {selectedCall.recordingUrl ? (
                  <audio
                    controls
                    src={`/api/twilio/recording/${selectedCall.id}`}
                    className="w-full rounded-xl"
                  />
                ) : (
                  <p className="text-xs text-slate-400 py-2">
                    {selectedCall.twilioCallSid
                      ? "Gravação não disponível ainda. Clique em \"Buscar no Twilio\" para tentar."
                      : "Sem gravação para esta chamada."}
                  </p>
                )}
              </section>

              {/* Resumo */}
              {selectedCall.summary && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Resumo</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                    {selectedCall.summary}
                  </p>
                </section>
              )}

              {/* Notas do operador */}
              {selectedCall.notes && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Anotações</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                    {selectedCall.notes}
                  </p>
                </section>
              )}

              {/* Transcrição Twilio Voice Intelligence */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Mic className="size-3" />
                    Transcrição Twilio
                  </p>
                  {selectedCall.recordingSid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1 rounded-lg"
                      onClick={() => syncTwilioTranscriptMutation.mutate(selectedCall.id)}
                      disabled={syncTwilioTranscriptMutation.isPending}
                      title="Solicitar transcrição ao Twilio Voice Intelligence"
                    >
                      <RefreshCw className={`size-3 ${syncTwilioTranscriptMutation.isPending ? "animate-spin" : ""}`} />
                      Solicitar
                    </Button>
                  )}
                </div>
                {selectedCall.twilioTranscription ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                    {selectedCall.twilioTranscription}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-1">
                    {selectedCall.recordingSid
                      ? "Transcrição não disponível. Clique em \"Solicitar\" para acionar o Voice Intelligence."
                      : "Sem gravação vinculada — transcrição Twilio indisponível."}
                  </p>
                )}
              </section>

              {/* Transcrição ElevenLabs */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="size-3" />
                    Transcrição ElevenLabs
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 rounded-lg"
                    onClick={() => syncElevenLabsMutation.mutate(selectedCall.id)}
                    disabled={syncElevenLabsMutation.isPending}
                    title="Sincronizar transcrição do ElevenLabs"
                  >
                    <RefreshCw className={`size-3 ${syncElevenLabsMutation.isPending ? "animate-spin" : ""}`} />
                    Sincronizar
                  </Button>
                </div>
                {selectedCall.transcription ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {selectedCall.transcription}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-1">
                    Sem transcrição ElevenLabs. Clique em &quot;Sincronizar&quot; para buscar.
                  </p>
                )}
              </section>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
