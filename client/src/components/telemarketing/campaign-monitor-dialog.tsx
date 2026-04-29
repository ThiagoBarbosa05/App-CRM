import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type CallEntry = {
  clientId: string;
  clientName: string | null;
  callSid: string | null;
  callRecordId: string;
  status: string;
};

type CallRecord = {
  id: string;
  status: string;
  duration: number | null;
  outcome: string | null;
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

interface Props {
  open: boolean;
  onClose: () => void;
  campaignName: string;
  initialCalls: CallEntry[];
}

export function CampaignMonitorDialog({ open, onClose, campaignName, initialCalls }: Props) {
  const [callStatuses, setCallStatuses] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const c of initialCalls) m[c.callRecordId] = c.status;
    return m;
  });

  const nonTerminal = Object.entries(callStatuses)
    .filter(([, s]) => !TERMINAL.has(s))
    .map(([id]) => id);

  const done = Object.values(callStatuses).filter((s) => TERMINAL.has(s)).length;
  const total = initialCalls.length;

  // Poll de chamadas não-terminais a cada 3s
  const { data: polledCalls } = useQuery<CallRecord[]>({
    queryKey: ["/api/calls/poll", nonTerminal.join(",")],
    queryFn: async () => {
      if (nonTerminal.length === 0) return [];
      const results = await Promise.all(
        nonTerminal.map(async (id) => {
          const res = await fetch(`/api/calls/${id}`, { credentials: "include" });
          if (!res.ok) return null;
          return res.json() as Promise<CallRecord>;
        })
      );
      return results.filter(Boolean) as CallRecord[];
    },
    enabled: open && nonTerminal.length > 0,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!polledCalls?.length) return;
    setCallStatuses((prev) => {
      const next = { ...prev };
      for (const c of polledCalls) next[c.id] = c.status;
      return next;
    });
  }, [polledCalls]);

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
              <span>{done} / {total}</span>
            </div>
            <Progress value={total > 0 ? (done / total) * 100 : 0} className="h-2" />
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[55vh] pr-1">
            {initialCalls.map((call) => {
              const status = callStatuses[call.callRecordId] ?? call.status;
              return (
                <div
                  key={call.callRecordId}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                >
                  <div>
                    <p className="text-sm font-medium">{call.clientName ?? call.clientId}</p>
                    {call.callSid && (
                      <p className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
                        {call.callSid}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] ?? ""}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
