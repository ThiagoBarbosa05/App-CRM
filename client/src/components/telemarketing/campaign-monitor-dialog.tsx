import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type CallEntry = {
  clientId: string;
  clientName: string | null;
  callSid: string | null;
  callRecordId: string;
  status: string;
};

type CampaignCall = {
  id: string;
  status: string;
  outcome: string | null;
  aiDecision: string | null;
  duration: number | null;
  clientName: string | null;
  clientPhone: string | null;
};

const TERMINAL = new Set(["encerrada", "nao_atendeu", "ocupado", "falhou", "caixa_postal"]);

const STATUS_COLORS: Record<string, string> = {
  iniciando: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  encerrada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nao_atendeu: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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

const AI_DECISION_COLORS: Record<string, string> = {
  sim: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nao: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  sem_resposta: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const AI_DECISION_LABELS: Record<string, string> = {
  sim: "SIM",
  nao: "NÃO",
  sem_resposta: "S/ resposta",
};

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  initialCalls: CallEntry[];
}

export function CampaignMonitorDialog({
  open,
  onClose,
  campaignId,
  campaignName,
  initialCalls,
}: Props) {
  const initialIds = new Set(initialCalls.map((c) => c.callRecordId));

  const { data: campaignCalls = [] } = useQuery<CampaignCall[]>({
    queryKey: ["/api/campaigns/calls", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/calls`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    refetchInterval: 3000,
    select: (rows) => rows.filter((r) => initialIds.has(r.id)),
  });

  const callMap = new Map(campaignCalls.map((c) => [c.id, c]));

  const done = campaignCalls.filter((c) => TERMINAL.has(c.status)).length;
  const total = initialCalls.length;
  const simCount = campaignCalls.filter((c) => c.aiDecision === "sim").length;
  const naoCount = campaignCalls.filter((c) => c.aiDecision === "nao").length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Monitor — {campaignName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Progresso</span>
              <span>{done} / {total} encerradas</span>
            </div>
            <Progress value={total > 0 ? (done / total) * 100 : 0} className="h-2" />
          </div>

          {(simCount > 0 || naoCount > 0) && (
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                {simCount} SIM
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <span className="size-2 rounded-full bg-red-500 inline-block" />
                {naoCount} NÃO
              </span>
            </div>
          )}

          <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-1">
            {initialCalls.map((call) => {
              const live = callMap.get(call.callRecordId);
              const status = live?.status ?? call.status;
              const aiDecision = live?.aiDecision ?? null;
              return (
                <div
                  key={call.callRecordId}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {call.clientName ?? call.clientId}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {aiDecision && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${AI_DECISION_COLORS[aiDecision] ?? ""}`}
                      >
                        {AI_DECISION_LABELS[aiDecision] ?? aiDecision}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] ?? ""}`}
                    >
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
