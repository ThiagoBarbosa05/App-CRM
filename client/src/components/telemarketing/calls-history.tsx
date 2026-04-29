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
import { RefreshCw, FileText, Clock, Phone } from "lucide-react";

type Call = {
  id: string;
  clientId: string | null;
  campaignId: string | null;
  twilioCallSid: string | null;
  status: string;
  outcome: string | null;
  duration: number | null;
  transcription: string | null;
  summary: string | null;
  aiDecision: string | null;
  sentiment: string | null;
  notes: string | null;
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
  sim: "✅ Sim",
  nao: "❌ Não",
  sem_resposta: "— Sem resposta",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CallsHistory() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const { data, isLoading, isFetching } = useQuery<{ data: Call[]; page: number; pageSize: number }>({
    queryKey: ["/api/calls", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/calls?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar chamadas");
      return res.json();
    },
  });

  const syncMutation = useMutation({
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
      toast({ title: "Transcrição sincronizada" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const calls = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48 rounded-2xl">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="nao_atendeu">Não atendeu</SelectItem>
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
        <div className="text-center py-16 text-slate-400">
          <Phone className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma chamada encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Phone className="size-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {call.twilioCallSid ?? call.id.slice(0, 8)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="size-3" />
                    {formatDuration(call.duration)}
                    {call.outcome && (
                      <span>· {OUTCOME_LABELS[call.outcome] ?? call.outcome}</span>
                    )}
                    {call.aiDecision && (
                      <span>· IA: {AI_DECISION_LABELS[call.aiDecision] ?? call.aiDecision}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? ""}`}
                >
                  {call.status.replace("_", " ")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-xl"
                  onClick={() => setSelectedCall(call)}
                  title="Ver transcrição"
                >
                  <FileText className="size-4 text-slate-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {calls.length === 20 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl"
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl"
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Dialog de transcrição */}
      {selectedCall && (
        <Dialog open={!!selectedCall} onOpenChange={(v) => !v && setSelectedCall(null)}>
          <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center justify-between">
                <span>Chamada — {selectedCall.twilioCallSid?.slice(0, 16) ?? selectedCall.id.slice(0, 8)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-xl"
                  onClick={() => syncMutation.mutate(selectedCall.id)}
                  disabled={syncMutation.isPending}
                  title="Sincronizar transcrição do ElevenLabs"
                >
                  <RefreshCw className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="font-medium">{selectedCall.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Duração</p>
                  <p className="font-medium">{formatDuration(selectedCall.duration)}</p>
                </div>
                {selectedCall.outcome && (
                  <div>
                    <p className="text-xs text-slate-400">Outcome</p>
                    <p className="font-medium">{OUTCOME_LABELS[selectedCall.outcome] ?? selectedCall.outcome}</p>
                  </div>
                )}
                {selectedCall.aiDecision && (
                  <div>
                    <p className="text-xs text-slate-400">Decisão IA</p>
                    <p className="font-medium">{AI_DECISION_LABELS[selectedCall.aiDecision]}</p>
                  </div>
                )}
                {selectedCall.sentiment && (
                  <div>
                    <p className="text-xs text-slate-400">Sentimento</p>
                    <p className="font-medium capitalize">{selectedCall.sentiment}</p>
                  </div>
                )}
              </div>

              {selectedCall.summary && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Resumo</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                    {selectedCall.summary}
                  </p>
                </div>
              )}

              {selectedCall.notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Anotações</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                    {selectedCall.notes}
                  </p>
                </div>
              )}

              {selectedCall.transcription ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Transcrição</p>
                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {selectedCall.transcription}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <p className="text-sm">Sem transcrição disponível.</p>
                  <p className="text-xs mt-1">
                    Clique em <RefreshCw className="size-3 inline" /> para buscar do ElevenLabs.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
