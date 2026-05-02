import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Phone,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  FileAudio,
  Clock,
  Radio,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CallRecord = {
  id: string;
  status: string;
  outcome: string | null;
  aiDecision: string | null;
  duration: number | null;
  notes: string | null;
  summary: string | null;
  transcription: string | null;
  twilioTranscription: string | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  elevenLabsConversationId: string | null;
  sentiment: string | null;
  campaignId: string | null;
  campaignName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

// ─── Helpers de display ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  iniciando: "Iniciando",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  falhou: "Falhou",
  caixa_postal: "Caixa postal",
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

const SENTIMENT_COLORS: Record<string, string> = {
  positivo: "text-emerald-600 dark:text-emerald-400",
  neutro: "text-slate-500",
  negativo: "text-red-500",
};

function formatDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

// ─── Transcript por speaker ───────────────────────────────────────────────────

type Turn = { role: "agent" | "client"; message: string };

const AGENT_PREFIXES = ["agent: ", "agente: "];
const CLIENT_PREFIXES = ["cliente: ", "user: "];

function parseTranscript(text: string): Turn[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const lower = line.toLowerCase();
      for (const p of AGENT_PREFIXES) {
        if (lower.startsWith(p)) return { role: "agent" as const, message: line.slice(p.length) };
      }
      for (const p of CLIENT_PREFIXES) {
        if (lower.startsWith(p)) return { role: "client" as const, message: line.slice(p.length) };
      }
      return { role: "client" as const, message: line };
    });
}

function TranscriptView({ text }: { text: string }) {
  const turns = parseTranscript(text);
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {turns.map((turn, i) => (
        <div key={i} className={`flex ${turn.role === "agent" ? "justify-start" : "justify-end"}`}>
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

// ─── Card de chamada individual ───────────────────────────────────────────────

function CallCard({ call }: { call: CallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasTranscript = !!(call.transcription || call.twilioTranscription);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Cabeçalho sempre visível */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Ícone de decisão */}
        <div className="shrink-0">
          {call.aiDecision === "sim" ? (
            <CheckCircle2 className="size-5 text-emerald-500" />
          ) : call.aiDecision === "nao" ? (
            <XCircle className="size-5 text-red-500" />
          ) : call.aiDecision === "sem_resposta" ? (
            <MinusCircle className="size-5 text-slate-400" />
          ) : (
            <Phone className="size-5 text-slate-400" />
          )}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {call.aiDecision === "sim" && (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Aceitou o convite
              </span>
            )}
            {call.aiDecision === "nao" && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                Recusou o convite
              </span>
            )}
            {call.aiDecision === "sem_resposta" && (
              <span className="text-xs font-semibold text-slate-500">Sem resposta</span>
            )}
            {!call.aiDecision && (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {STATUS_LABELS[call.status] ?? call.status}
              </span>
            )}
            {call.campaignName && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Radio className="size-3" />
                {call.campaignName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
            <span>{formatDate(call.startedAt ?? call.createdAt)}</span>
            <span>·</span>
            <Clock className="size-3" />
            <span>{formatDuration(call.duration)}</span>
            {call.sentiment && (
              <>
                <span>·</span>
                <span className={`capitalize ${SENTIMENT_COLORS[call.sentiment] ?? ""}`}>
                  {call.sentiment}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Badges e toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasTranscript && (
            <span
              title="Transcrição disponível"
              className="size-5 flex items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/20"
            >
              <FileText className="size-3 text-emerald-500" />
            </span>
          )}
          {(call.recordingUrl || call.elevenLabsConversationId) && (
            <span
              title="Gravação disponível"
              className="size-5 flex items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/20"
            >
              <FileAudio className="size-3 text-blue-500" />
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? ""}`}
          >
            {STATUS_LABELS[call.status] ?? call.status}
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-slate-400" />
          ) : (
            <ChevronDown className="size-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-4">
          {/* Notas */}
          {call.notes && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Observações
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                {call.notes}
              </p>
            </div>
          )}

          {/* Resumo */}
          {call.summary && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Resumo da conversa
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl leading-relaxed">
                {call.summary}
              </p>
            </div>
          )}

          {/* Gravação */}
          {(call.elevenLabsConversationId || call.recordingUrl) && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Gravação
              </p>
              <audio
                controls
                src={
                  call.elevenLabsConversationId
                    ? `/api/elevenlabs/audio/${call.id}`
                    : `/api/twilio/recording/${call.id}`
                }
                className="w-full rounded-xl"
              />
            </div>
          )}

          {/* Transcrição ElevenLabs */}
          {call.transcription && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Transcrição
              </p>
              <TranscriptView text={call.transcription} />
            </div>
          )}

          {/* Transcrição Twilio (fallback) */}
          {!call.transcription && call.twilioTranscription && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Transcrição Twilio
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {call.twilioTranscription}
              </div>
            </div>
          )}

          {!hasTranscript && !call.summary && !call.notes && !call.recordingUrl && (
            <p className="text-xs text-slate-400 text-center py-2">
              Nenhum detalhe adicional disponível para esta chamada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

export function ClientTelemarketingTab({ clientId }: Props) {
  const { data, isLoading } = useQuery<{ data: CallRecord[]; total: number }>({
    queryKey: ["/api/calls", "client", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/calls?clientId=${clientId}&pageSize=100`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar chamadas");
      return res.json();
    },
    enabled: !!clientId,
  });

  const callList = data?.data ?? [];

  const sim = callList.filter((c) => c.aiDecision === "sim").length;
  const nao = callList.filter((c) => c.aiDecision === "nao").length;
  const semResposta = callList.filter((c) => c.aiDecision === "sem_resposta").length;
  const total = callList.length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (callList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="rounded-full bg-violet-100 dark:bg-violet-900/30 p-4">
          <Phone className="h-7 w-7 text-violet-500" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Nenhuma chamada registrada
        </p>
        <p className="text-xs text-slate-400 max-w-xs">
          Este cliente ainda não recebeu chamadas de telemarketing IA.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total de chamadas</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{sim}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Aceitou convite</p>
        </div>
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{nao}</p>
          <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">Recusou convite</p>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{semResposta}</p>
          <p className="text-xs text-slate-400 mt-0.5">Sem resposta</p>
        </div>
      </div>

      {/* Lista de chamadas */}
      <div className="space-y-2">
        {callList.map((call) => (
          <CallCard key={call.id} call={call} />
        ))}
      </div>
    </div>
  );
}
