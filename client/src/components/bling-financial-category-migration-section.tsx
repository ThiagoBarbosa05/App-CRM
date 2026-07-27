import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  FolderTree,
  Loader2,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type PreviewAction = "create" | "reuse" | "conflict";

interface PreviewNode {
  sourceId: number;
  parentSourceId: number;
  descricao: string;
  depth: number;
  path: string[];
  action: PreviewAction;
  targetCategoryId: number | null;
  issue: string | null;
  children: PreviewNode[];
}

interface MigrationPreview {
  source: { id: string; name: string };
  target: { id: string; name: string };
  generatedAt: string;
  fingerprint: string;
  canMigrate: boolean;
  totals: {
    total: number;
    create: number;
    reuse: number;
    conflicts: number;
    maxDepth: number;
  };
  validations: string[];
  tree: PreviewNode[];
}

interface MigrationCounters {
  total: number;
  processed: number;
  created: number;
  reused: number;
  failed: number;
  blocked: number;
}

type MigrationEvent =
  | { type: "start"; counters: MigrationCounters }
  | {
      type: "category";
      sourceId: number;
      path: string[];
      action: "created" | "reused" | "failed" | "blocked";
      detail?: string;
      counters: MigrationCounters;
    }
  | { type: "progress"; counters: MigrationCounters }
  | {
      type: "done";
      cancelled: boolean;
      counters: MigrationCounters;
      errors: Array<{ sourceId: number; path: string; error: string }>;
    }
  | { type: "error"; message: string };

type Phase =
  | "idle"
  | "previewing"
  | "ready"
  | "running"
  | "completed"
  | "cancelled"
  | "error";

interface LogEntry {
  id: number;
  kind: "created" | "reused" | "failed" | "blocked" | "info";
  text: string;
}

const EMPTY_COUNTERS: MigrationCounters = {
  total: 0,
  processed: 0,
  created: 0,
  reused: 0,
  failed: 0,
  blocked: 0,
};

const ACTION_LABELS: Record<
  PreviewAction,
  { label: string; className: string }
> = {
  create: {
    label: "Será criada",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  reuse: {
    label: "Já existe",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  },
  conflict: {
    label: "Conflito",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  },
};

const LOG_CLASSES: Record<LogEntry["kind"], string> = {
  created: "text-emerald-700 dark:text-emerald-300",
  reused: "text-sky-700 dark:text-sky-300",
  failed: "text-red-700 dark:text-red-300",
  blocked: "text-amber-700 dark:text-amber-300",
  info: "text-slate-500 dark:text-slate-400",
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function SnapshotTreeNode({ node }: { node: PreviewNode }) {
  const action = ACTION_LABELS[node.action];
  return (
    <li className="[content-visibility:auto]">
      <div
        className="flex min-h-10 items-center gap-2 border-b border-slate-100 px-2 py-2 last:border-b-0 dark:border-slate-800"
        style={{ paddingLeft: `${Math.min(node.depth, 8) * 20 + 8}px` }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
          {node.descricao}
        </span>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${action.className}`}>
          {action.label}
        </Badge>
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <SnapshotTreeNode key={child.sourceId} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function BlingFinancialCategoryMigrationSection() {
  const { toast } = useToast();
  const { data: connections = [] } = useBlingAccounts();
  const connectedAccounts = useMemo(
    () => connections.filter((connection) => connection.status === "connected"),
    [connections],
  );

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [counters, setCounters] = useState(EMPTY_COUNTERS);
  const [currentPath, setCurrentPath] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errors, setErrors] = useState<
    Array<{ sourceId: number; path: string; error: string }>
  >([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const logIdRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const isRunning = phase === "running";
  const progressPercent =
    counters.total > 0 ? (counters.processed / counters.total) * 100 : 0;

  const pushLog = useCallback((kind: LogEntry["kind"], text: string) => {
    logIdRef.current += 1;
    setLogs((current) =>
      [...current, { id: logIdRef.current, kind, text }].slice(-500),
    );
  }, []);

  useEffect(() => {
    if (!isRunning || startedAt === null) return;
    const interval = window.setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [isRunning, startedAt]);

  useEffect(() => {
    const element = logRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [logs]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const resetSnapshot = useCallback(() => {
    setPreview(null);
    setPhase("idle");
    setCounters(EMPTY_COUNTERS);
    setLogs([]);
    setErrors([]);
    setErrorMessage("");
    setCurrentPath("");
  }, []);

  const handleSourceChange = (value: string) => {
    setSourceId(value);
    resetSnapshot();
  };

  const handleTargetChange = (value: string) => {
    setTargetId(value);
    resetSnapshot();
  };

  const handlePreview = async () => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setPhase("previewing");
    setErrorMessage("");
    try {
      const response = await apiRequest(
        "POST",
        "/api/bling-financial-categories/preview",
        { sourceConnectionId: sourceId, targetConnectionId: targetId },
      );
      const body = (await response.json()) as {
        success: boolean;
        data: MigrationPreview;
      };
      setPreview(body.data);
      setPhase("ready");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível gerar o snapshot";
      setErrorMessage(message);
      setPhase("error");
      toast({
        title: "Falha ao gerar snapshot",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleMigrationEvent = useCallback(
    (event: MigrationEvent) => {
      if (event.type === "start") {
        setCounters(event.counters);
        pushLog("info", "Snapshot validado. Migração iniciada.");
        return;
      }
      if (event.type === "category") {
        setCounters(event.counters);
        const path = event.path.join(" / ");
        setCurrentPath(path);
        const prefix = {
          created: "CRIADA",
          reused: "REUTILIZADA",
          failed: "FALHA",
          blocked: "BLOQUEADA",
        }[event.action];
        pushLog(
          event.action,
          `${prefix} · ${path}${event.detail ? ` — ${event.detail}` : ""}`,
        );
        return;
      }
      if (event.type === "progress") {
        setCounters(event.counters);
        return;
      }
      if (event.type === "done") {
        setCounters(event.counters);
        setErrors(event.errors);
        setCurrentPath("");
        setPhase(event.cancelled ? "cancelled" : "completed");
        pushLog(
          "info",
          event.cancelled
            ? "Migração cancelada."
            : `Migração concluída: ${event.counters.created} criadas e ${event.counters.reused} reutilizadas.`,
        );
        toast({
          title: event.cancelled ? "Migração cancelada" : "Migração concluída",
          description: `${event.counters.created} criadas, ${event.counters.reused} reutilizadas e ${event.counters.failed} falhas.`,
        });
        return;
      }

      setErrorMessage(event.message);
      setPhase("error");
      pushLog("failed", event.message);
    },
    [pushLog, toast],
  );

  const handleStart = async () => {
    if (!preview?.canMigrate) return;
    setConfirmOpen(false);
    setPhase("running");
    setCounters({ ...EMPTY_COUNTERS, total: preview.totals.total });
    setLogs([]);
    setErrors([]);
    setErrorMessage("");
    setCurrentPath("");
    const started = Date.now();
    setStartedAt(started);
    setElapsedMs(0);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        "/api/bling-financial-categories/migrate",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceConnectionId: sourceId,
            targetConnectionId: targetId,
            fingerprint: preview.fingerprint,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok || !response.body) {
        const rawBody = await response.text();
        let message = rawBody;
        try {
          const parsedBody = JSON.parse(rawBody) as { error?: string };
          message = parsedBody.error ?? rawBody;
        } catch {
          // Respostas não JSON continuam legíveis no feedback.
        }
        throw new Error(message || "Não foi possível iniciar a migração");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          handleMigrationEvent(
            JSON.parse(dataLine.slice(6)) as MigrationEvent,
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setPhase("cancelled");
        setCurrentPath("");
        pushLog("info", "Cancelamento solicitado pelo usuário.");
        return;
      }
      const message =
        error instanceof Error ? error.message : "Erro durante a migração";
      setErrorMessage(message);
      setPhase("error");
      pushLog("failed", message);
      toast({
        title: "Falha na migração",
        description: message,
        variant: "destructive",
      });
    } finally {
      abortRef.current = null;
      setElapsedMs(Date.now() - started);
    }
  };

  const statusBadge =
    phase === "running"
      ? {
          label: "Migrando",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : phase === "completed"
        ? {
            label: "Concluída",
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
          }
        : phase === "cancelled"
          ? {
              label: "Cancelada",
              className: "border-slate-200 bg-slate-50 text-slate-600",
            }
          : phase === "error"
            ? {
                label: "Falhou",
                className: "border-red-200 bg-red-50 text-red-700",
              }
            : null;

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />

      <div className="flex flex-wrap items-center gap-2">
        <FolderTree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Migrar categorias financeiras
        </h3>
        {statusBadge ? (
          <Badge variant="outline" className={`ml-auto ${statusBadge.className}`}>
            {phase === "running" ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            {statusBadge.label}
          </Badge>
        ) : null}
      </div>

      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Copia somente categorias de despesas, preservando todos os níveis da
        árvore. Antes de criar qualquer item, você revisa um snapshot completo
        da origem e do que já existe no destino.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Conta de origem</Label>
          <Select
            value={sourceId}
            onValueChange={handleSourceChange}
            disabled={isRunning || phase === "previewing"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent>
              {connectedAccounts.map((connection) => (
                <SelectItem
                  key={connection.id}
                  value={connection.id}
                  disabled={connection.id === targetId}
                >
                  {connection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden h-10 items-center justify-center sm:flex">
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Conta de destino</Label>
          <Select
            value={targetId}
            onValueChange={handleTargetChange}
            disabled={isRunning || phase === "previewing"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o destino" />
            </SelectTrigger>
            <SelectContent>
              {connectedAccounts.map((connection) => (
                <SelectItem
                  key={connection.id}
                  value={connection.id}
                  disabled={connection.id === sourceId}
                >
                  {connection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePreview}
          disabled={
            isRunning ||
            phase === "previewing" ||
            !sourceId ||
            !targetId ||
            sourceId === targetId
          }
        >
          {phase === "previewing" ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : preview ? (
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
          ) : (
            <Eye className="mr-2 h-3.5 w-3.5" />
          )}
          {preview ? "Atualizar snapshot" : "Gerar snapshot"}
        </Button>

        {preview ? (
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={!preview.canMigrate || phase !== "ready"}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Play className="mr-2 h-3.5 w-3.5" />
            Confirmar migração
          </Button>
        ) : null}

        {isRunning ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => abortRef.current?.abort()}
          >
            Cancelar
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Total", preview.totals.total, "text-slate-900 dark:text-slate-100"],
              ["Serão criadas", preview.totals.create, "text-emerald-600"],
              ["Já existem", preview.totals.reuse, "text-sky-600"],
              ["Conflitos", preview.totals.conflicts, "text-red-600"],
            ].map(([label, value, className]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className={`text-lg font-semibold ${className}`}>{value}</p>
              </div>
            ))}
          </div>

          {preview.validations.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" />
                Corrija os conflitos antes de migrar
              </div>
              <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-300">
                {preview.validations.map((validation) => (
                  <li key={validation}>• {validation}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Snapshot da hierarquia
              </span>
              <span className="text-[10px] text-slate-500">
                {preview.totals.maxDepth + 1} nível(is)
              </span>
            </div>
            <ScrollArea className="h-72">
              <ul>
                {preview.tree.map((node) => (
                  <SnapshotTreeNode key={node.sourceId} node={node} />
                ))}
              </ul>
            </ScrollArea>
          </div>
        </div>
      ) : null}

      {phase === "running" ||
      phase === "completed" ||
      phase === "cancelled" ||
      (phase === "error" && logs.length > 0) ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="min-w-12 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
              {Math.round(progressPercent)}%
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock3 className="h-3 w-3" />
              {formatElapsed(elapsedMs)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              ["Processadas", `${counters.processed}/${counters.total}`, "text-slate-800 dark:text-slate-100"],
              ["Criadas", counters.created, "text-emerald-600"],
              ["Reutilizadas", counters.reused, "text-sky-600"],
              ["Falhas", counters.failed, "text-red-600"],
              ["Bloqueadas", counters.blocked, "text-amber-600"],
            ].map(([label, value, className]) => (
              <div key={String(label)} className="text-center">
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className={`text-sm font-semibold ${className}`}>{value}</p>
              </div>
            ))}
          </div>

          {currentPath ? (
            <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs dark:bg-slate-950">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-500" />
              <span className="shrink-0 text-slate-500">Processando:</span>
              <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                {currentPath}
              </span>
            </div>
          ) : null}

          <div
            ref={logRef}
            className="h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950"
          >
            {logs.map((log) => (
              <p key={log.id} className={LOG_CLASSES[log.kind]}>
                {log.text}
              </p>
            ))}
          </div>

          {errors.length > 0 ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                <XCircle className="h-3.5 w-3.5" />
                Erros ({errors.length})
              </p>
              {errors.slice(0, 10).map((error) => (
                <p
                  key={`${error.sourceId}-${error.path}`}
                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                  <strong>{error.path}:</strong> {error.error}
                </p>
              ))}
            </div>
          ) : null}

          {phase === "completed" && counters.failed === 0 ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Hierarquia migrada com sucesso.
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage && phase === "error" ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar migração financeira</DialogTitle>
            <DialogDescription>
              Esta ação criará categorias na conta de destino. Categorias que já
              existem serão apenas reutilizadas.
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3 rounded-lg bg-slate-50 px-3 py-4 text-sm font-semibold dark:bg-slate-900">
                <span>{preview.source.name}</span>
                <ArrowRight className="h-4 w-4 text-emerald-500" />
                <span>{preview.target.name}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Serão criadas <strong>{preview.totals.create}</strong> categorias
                e reutilizadas <strong>{preview.totals.reuse}</strong>.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={handleStart}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirmar e migrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
