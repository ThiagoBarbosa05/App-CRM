import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  PhoneOff,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type LogResult = "success" | "not_found" | "no_phone" | "error";

interface LogEntry {
  clientId: string;
  clientName: string;
  phone: string | null;
  result: LogResult;
  tags: string[];
  errorMessage?: string;
  timestamp: string;
}

interface ImportStatus {
  status: "idle" | "running" | "completed" | "error";
  total: number;
  processed: number;
  found: number;
  notFound: number;
  errors: number;
  tagsAssigned: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  logs: LogEntry[];
}

const RESULT_CONFIG: Record<
  LogResult,
  { label: string; className: string; icon: React.ReactNode }
> = {
  success: {
    label: "Encontrado",
    className: "text-green-700 bg-green-50 border-green-200",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  not_found: {
    label: "Não encontrado",
    className: "text-slate-600 bg-slate-50 border-slate-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  no_phone: {
    label: "Sem telefone válido",
    className: "text-yellow-700 bg-yellow-50 border-yellow-200",
    icon: <PhoneOff className="h-3 w-3" />,
  },
  error: {
    label: "Erro",
    className: "text-red-700 bg-red-50 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

export function UmblerTagImport() {
  const { toast } = useToast();
  const [polling, setPolling] = useState(false);
  const [filter, setFilter] = useState<LogResult | "all">("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: status, refetch } = useQuery<ImportStatus>({
    queryKey: ["/api/umbler-tag-import/status"],
    queryFn: async () => {
      const res = await fetch("/api/umbler-tag-import/status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar status");
      return res.json();
    },
    staleTime: 0,
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/umbler-tag-import/start"),
    onSuccess: () => {
      setPolling(true);
      toast({ title: "Importação iniciada" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao iniciar importação",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (polling) {
      intervalRef.current = setInterval(() => void refetch(), 2000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, refetch]);

  useEffect(() => {
    if (status?.status === "completed" || status?.status === "error") {
      setPolling(false);
    }
    if (status?.status === "running") setPolling(true);
  }, [status?.status]);

  // Auto-scroll ao fim do log quando estiver rodando
  useEffect(() => {
    if (status?.status === "running") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [status?.logs?.length, status?.status]);

  const isRunning = status?.status === "running" || startMutation.isPending;
  const percent =
    status && status.total > 0
      ? Math.round((status.processed / status.total) * 100)
      : 0;

  const filteredLogs =
    !status?.logs
      ? []
      : filter === "all"
      ? status.logs
      : status.logs.filter((l) => l.result === filter);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Importação de Etiquetas Umbler
              </CardTitle>
              <CardDescription>
                Busca as etiquetas de cada cliente pelo telefone e associa ao
                CRM. Esta funcionalidade é temporária e será removida após a
                importação.
              </CardDescription>
            </div>
            <StatusBadge status={status?.status ?? "idle"} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {status && status.status !== "idle" && (
            <>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {status.processed} / {status.total} clientes
                  </span>
                  <span>{percent}%</span>
                </div>
                <Progress value={percent} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatBox
                  label="Encontrados"
                  value={status.found}
                  color="text-green-600"
                />
                <StatBox
                  label="Não encontrados"
                  value={status.notFound}
                  color="text-muted-foreground"
                />
                <StatBox
                  label="Tags atribuídas"
                  value={status.tagsAssigned}
                  color="text-blue-600"
                />
                <StatBox
                  label="Erros"
                  value={status.errors}
                  color="text-destructive"
                />
              </div>
            </>
          )}

          {status?.status === "error" && status.errorMessage && (
            <p className="text-xs text-destructive">{status.errorMessage}</p>
          )}

          {status?.completedAt && (
            <p className="text-xs text-muted-foreground">
              Concluído em{" "}
              {new Date(status.completedAt).toLocaleString("pt-BR")}
            </p>
          )}

          <Button
            onClick={() => startMutation.mutate()}
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isRunning ? "Importando..." : "Iniciar Importação"}
          </Button>
        </CardContent>
      </Card>

      {/* Log table */}
      {status && status.logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Log de clientes{" "}
                <span className="text-muted-foreground font-normal">
                  (últimos {status.logs.length})
                </span>
              </CardTitle>
              {/* Filter tabs */}
              <div className="flex gap-1">
                {(["all", "success", "error", "not_found", "no_phone"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded px-2 py-0.5 text-xs transition-colors ${
                        filter === f
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f === "all"
                        ? "Todos"
                        : RESULT_CONFIG[f].label}
                    </button>
                  )
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Telefone
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Etiquetas / Detalhe
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.map((entry, i) => {
                    const cfg = RESULT_CONFIG[entry.result];
                    return (
                      <tr key={i} className="hover:bg-muted/40">
                        <td className="px-4 py-2 font-medium max-w-[160px] truncate">
                          {entry.clientName}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground font-mono">
                          {entry.phone ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.className}`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 max-w-[260px]">
                          {entry.result === "success" && entry.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {entry.tags.map((t) => (
                                <Badge
                                  key={t}
                                  variant="secondary"
                                  className="text-xs h-4 px-1"
                                >
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          ) : entry.errorMessage ? (
                            <span className="text-destructive truncate block">
                              {entry.errorMessage}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ImportStatus["status"] }) {
  if (status === "idle") return <Badge variant="secondary">Aguardando</Badge>;
  if (status === "running")
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-400">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Executando
      </Badge>
    );
  if (status === "completed")
    return (
      <Badge variant="outline" className="text-green-600 border-green-400">
        <CheckCircle className="mr-1 h-3 w-3" />
        Concluído
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <AlertCircle className="mr-1 h-3 w-3" />
      Erro
    </Badge>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
