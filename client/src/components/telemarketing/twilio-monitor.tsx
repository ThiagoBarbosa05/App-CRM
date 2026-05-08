import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  RefreshCw,
  Shield,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CallRecord = {
  id: string;
  status: string;
  twilioCallSid: string | null;
  toPhone: string | null;
  contactName: string | null;
  clientName: string | null;
  campaignName: string | null;
  operatorId: string;
  duration: number | null;
  startedAt: string | null;
  createdAt: string;
};

type CallsResponse = {
  data: CallRecord[];
  total: number;
};

type StatsResponse = {
  summary: {
    total: number;
    hoje: number;
    taxaConversao: number;
    duracaoMedia: number;
  };
  porStatus: Array<{ status: string; count: number }>;
};

type TwilioAlert = {
  sid: string;
  log_level: string;
  error_code: string;
  alert_text: string;
  timestamp: string;
  request_url: string | null;
  more_info: string | null;
};

type AlertsResponse = {
  alerts: TwilioAlert[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return phone;
}

function liveElapsed(startedAt: string | null): string {
  if (!startedAt) return "—";
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return formatDuration(secs);
}

const STATUS_LABEL: Record<string, string> = {
  iniciando: "Iniciando",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  falhou: "Falhou",
  caixa_postal: "Caixa postal",
};

const STATUS_COLOR: Record<string, string> = {
  iniciando: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_andamento: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  encerrada: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  nao_atendeu: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  ocupado: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  falhou: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  caixa_postal: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

// ─── Card de Resumo ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", color)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Seção: Chamadas Ativas ───────────────────────────────────────────────────

function LiveCallsSection() {
  const { data, isLoading, dataUpdatedAt } = useQuery<CallsResponse>({
    queryKey: ["/api/calls", "live"],
    queryFn: async () => {
      const res = await fetch(
        "/api/calls?status=em_andamento,iniciando&pageSize=50",
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Erro ao buscar chamadas ativas");
      return res.json();
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/calls/${callId}/end`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao encerrar chamada");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Chamada encerrada" });
      void queryClient.invalidateQueries({ queryKey: ["/api/calls", "live"] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const liveCalls = data?.data ?? [];
  const hasLive = liveCalls.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Chamadas Ativas
          </h2>
          {hasLive && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              AO VIVO
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {isLoading ? "Atualizando..." : `Atualizado às ${format(new Date(dataUpdatedAt), "HH:mm:ss")}`}
        </span>
      </div>

      {isLoading && liveCalls.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : liveCalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 dark:border-slate-700">
          <Phone className="size-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma chamada ativa no momento</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contato</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Telefone</th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:table-cell">Campanha</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Duração</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveCalls.map((call) => (
                <tr key={call.id} className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {call.contactName ?? call.clientName ?? "Desconhecido"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {formatPhone(call.toPhone)}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 dark:text-slate-400 sm:table-cell">
                    {call.campaignName ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn("text-xs font-semibold", STATUS_COLOR[call.status] ?? "")}>
                      {STATUS_LABEL[call.status] ?? call.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                    {call.status === "em_andamento"
                      ? liveElapsed(call.startedAt)
                      : call.duration
                        ? formatDuration(call.duration)
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      disabled={endCallMutation.isPending && endCallMutation.variables === call.id}
                      onClick={() => endCallMutation.mutate(call.id)}
                      title="Encerrar chamada"
                    >
                      {endCallMutation.isPending && endCallMutation.variables === call.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <PhoneOff className="size-3.5" />
                      )}
                      Encerrar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Seção: Alertas do Twilio ─────────────────────────────────────────────────

const DATE_RANGE_OPTIONS = [
  { value: "1", label: "Últimas 24h" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

const LOG_LEVEL_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "error", label: "Erros" },
  { value: "warning", label: "Avisos" },
];

function AlertLevelBadge({ level }: { level: string }) {
  if (level === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <XCircle className="size-3" /> Erro
      </span>
    );
  if (level === "warning")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <AlertTriangle className="size-3" /> Aviso
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      <Info className="size-3" /> {level}
    </span>
  );
}

function AlertsSection() {
  const [logLevel, setLogLevel] = useState("all");
  const [dateRange, setDateRange] = useState("7");

  const startDate = format(startOfDay(subDays(new Date(), parseInt(dateRange))), "yyyy-MM-dd");

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<AlertsResponse>({
    queryKey: ["/api/twilio/alerts", logLevel, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, pageSize: "100" });
      if (logLevel !== "all") params.set("logLevel", logLevel);
      const res = await fetch(`/api/twilio/alerts?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar alertas");
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Erros e Avisos do Twilio
          </h2>
          {alerts.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {alerts.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void refetch()}
            disabled={isFetching}
            title="Atualizar alertas"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Info sobre webhook */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
        <Shield className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Para receber erros em tempo real, configure um webhook no{" "}
          <a
            href="https://console.twilio.com/us1/monitor/logs/debugger/webhook"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
          >
            painel do Twilio <ExternalLink className="size-3" />
          </a>
          . Os alertas abaixo são buscados da API (últimos 30 dias).
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-red-200 py-10 text-center dark:border-red-900/40">
          <AlertTriangle className="size-7 text-red-400" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Erro ao buscar alertas
          </p>
          <p className="text-xs text-slate-400">Verifique as credenciais do Twilio nas configurações.</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 dark:border-slate-700">
          <CheckCircle2 className="size-8 text-emerald-400" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhum alerta encontrado no período
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nível</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descrição</th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:table-cell">URL</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((alert) => (
                <tr key={alert.sid} className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    <AlertLevelBadge level={alert.log_level} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {alert.error_code ?? "—"}
                    {alert.more_info && (
                      <a
                        href={alert.more_info}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-blue-500 hover:text-blue-700"
                        title="Ver mais informações"
                      >
                        <ExternalLink className="inline size-3" />
                      </a>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-300">
                    <p className="line-clamp-2 text-xs">{alert.alert_text ?? "—"}</p>
                  </td>
                  <td className="hidden max-w-[200px] px-4 py-3 md:table-cell">
                    {alert.request_url ? (
                      <p className="truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                        {alert.request_url}
                      </p>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
                    {alert.timestamp
                      ? format(new Date(alert.timestamp), "dd/MM HH:mm", { locale: ptBR })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dataUpdatedAt > 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-right text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Atualizado às {format(new Date(dataUpdatedAt), "HH:mm:ss")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Seção: Chamadas Recentes ─────────────────────────────────────────────────

function RecentCallsSection() {
  const { data, isLoading } = useQuery<CallsResponse>({
    queryKey: ["/api/calls", "recent-monitor"],
    queryFn: async () => {
      const res = await fetch("/api/calls?pageSize=20", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar chamadas");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const calls = data?.data ?? [];

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Chamadas Recentes
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-8 dark:border-slate-700">
          <Phone className="size-7 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma chamada registrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contato</th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:table-cell">Telefone</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="hidden px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:table-cell">Duração</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Início</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {calls.map((call) => (
                <tr key={call.id} className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {call.contactName ?? call.clientName ?? "Desconhecido"}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 sm:table-cell">
                    {formatPhone(call.toPhone)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn("text-xs font-semibold", STATUS_COLOR[call.status] ?? "")}>
                      {STATUS_LABEL[call.status] ?? call.status}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400 sm:table-cell">
                    {call.duration ? formatDuration(call.duration) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
                    {call.startedAt
                      ? format(new Date(call.startedAt), "dd/MM HH:mm", { locale: ptBR })
                      : format(new Date(call.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TwilioMonitor() {
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["/api/calls/stats"],
    queryFn: async () => {
      const res = await fetch("/api/calls/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const { data: liveData } = useQuery<CallsResponse>({
    queryKey: ["/api/calls", "live"],
    staleTime: 4_000,
  });

  const falhasCount =
    stats?.porStatus
      .filter((s) => ["falhou", "nao_atendeu", "ocupado"].includes(s.status))
      .reduce((acc, s) => acc + s.count, 0) ?? 0;

  const liveCount = liveData?.data.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40">
          <Activity className="size-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Monitor de Ligações
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chamadas em tempo real, erros e estatísticas do Twilio
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={PhoneCall}
          label="Chamadas hoje"
          value={stats?.summary.hoje ?? "—"}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          icon={Activity}
          label="Ao vivo agora"
          value={liveCount}
          sub={liveCount > 0 ? "em andamento" : "sem chamadas"}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Taxa de conversão"
          value={
            stats ? `${stats.summary.taxaConversao.toFixed(1)}%` : "—"
          }
          color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
        />
        <StatCard
          icon={PhoneMissed}
          label="Não atendidas / Falhas"
          value={falhasCount > 0 ? falhasCount : stats ? falhasCount : "—"}
          color="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
        />
      </div>

      {/* Chamadas ativas */}
      <LiveCallsSection />

      {/* Erros e Avisos */}
      <AlertsSection />

      {/* Chamadas recentes */}
      <RecentCallsSection />
    </div>
  );
}
