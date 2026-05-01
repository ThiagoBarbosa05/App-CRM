import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, MinusCircle, Phone, Clock } from "lucide-react";

type ProgressRow = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  campaignStatus: string;
  callId: string | null;
  callStatus: string | null;
  aiDecision: string | null;
  startedAt: string | null;
};

const CALL_STATUS_LABELS: Record<string, string> = {
  iniciando: "Iniciando",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  falhou: "Falhou",
  caixa_postal: "Caixa postal",
};

const CALL_STATUS_COLORS: Record<string, string> = {
  iniciando: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  encerrada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nao_atendeu: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  ocupado: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  falhou: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  caixa_postal: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const TERMINAL_CALL = new Set(["encerrada", "nao_atendeu", "ocupado", "falhou", "caixa_postal"]);

function sortRows(rows: ProgressRow[]): ProgressRow[] {
  const order = (r: ProgressRow) => {
    if (r.callStatus === "em_andamento") return 0;
    if (r.callStatus === "iniciando") return 1;
    if (r.aiDecision === "sim") return 2;
    if (r.aiDecision === "nao") return 3;
    if (r.callStatus && TERMINAL_CALL.has(r.callStatus)) return 4;
    return 5; // novo / sem chamada
  };
  return [...rows].sort((a, b) => order(a) - order(b));
}

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
}

export function CampaignMonitorDialog({ open, onClose, campaignId, campaignName }: Props) {
  const { data: rows = [], isLoading } = useQuery<ProgressRow[]>({
    queryKey: ["/api/campaigns/progress", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/progress`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    refetchInterval: 3000,
  });

  const total = rows.length;
  const contacted = rows.filter((r) => r.campaignStatus !== "novo").length;
  const simCount = rows.filter((r) => r.aiDecision === "sim").length;
  const naoCount = rows.filter((r) => r.aiDecision === "nao").length;
  const activeCount = rows.filter(
    (r) => r.callStatus === "em_andamento" || r.callStatus === "iniciando",
  ).length;

  const sorted = sortRows(rows);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[88vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-base font-semibold">{campaignName}</DialogTitle>

          {/* Barra de progresso */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {contacted} de {total} cliente{total !== 1 ? "s" : ""} contactado
                {contacted !== 1 ? "s" : ""}
              </span>
              {activeCount > 0 && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                  <Phone className="size-3" />
                  {activeCount} em andamento
                </span>
              )}
            </div>
            <Progress
              value={total > 0 ? (contacted / total) * 100 : 0}
              className="h-2"
            />
          </div>

          {/* Contadores */}
          {(simCount > 0 || naoCount > 0) && (
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-3.5" />
                {simCount} aceitaram
              </span>
              <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                <XCircle className="size-3.5" />
                {naoCount} recusaram
              </span>
              {rows.filter((r) => r.campaignStatus === "novo").length > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Clock className="size-3.5" />
                  {rows.filter((r) => r.campaignStatus === "novo").length} pendentes
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Lista de clientes */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              Carregando...
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              Nenhum cliente nesta campanha
            </div>
          ) : (
            sorted.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {/* Ícone de decisão */}
                <div className="shrink-0">
                  {row.aiDecision === "sim" ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : row.aiDecision === "nao" ? (
                    <XCircle className="size-4 text-red-500" />
                  ) : row.callStatus === "em_andamento" || row.callStatus === "iniciando" ? (
                    <Phone className="size-4 text-blue-500 animate-pulse" />
                  ) : row.aiDecision === "sem_resposta" ? (
                    <MinusCircle className="size-4 text-slate-400" />
                  ) : (
                    <div className="size-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                </div>

                {/* Dados do cliente */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {row.clientName ?? row.clientId ?? "—"}
                  </p>
                  {row.clientPhone && (
                    <p className="text-xs text-slate-400 font-mono">{row.clientPhone}</p>
                  )}
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {row.aiDecision === "sim" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Aceitou
                    </span>
                  )}
                  {row.aiDecision === "nao" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                      Recusou
                    </span>
                  )}
                  {row.aiDecision === "sem_resposta" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Sem resposta
                    </span>
                  )}
                  {!row.aiDecision && row.callStatus && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${CALL_STATUS_COLORS[row.callStatus] ?? ""}`}
                    >
                      {CALL_STATUS_LABELS[row.callStatus] ?? row.callStatus}
                    </span>
                  )}
                  {!row.callStatus && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                      Pendente
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
