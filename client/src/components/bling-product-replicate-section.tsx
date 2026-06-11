import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  FlaskConical,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBlingAccounts } from "@/hooks/use-bling-accounts";

interface ReplicateCounters {
  processed: number;
  created: number;
  skippedExisting: number;
  skippedNonSimple: number;
  skippedInactive: number;
  categoriesCreated: number;
  linked: number;
  linkSkipped: number;
  failed: number;
}

interface ReplicateError {
  codigo: string | null;
  nome: string | null;
  error: string;
}

type ReplicateProgressEvent =
  | { type: "start"; dryRun: boolean }
  | { type: "preload"; targetCategories: number; targetProducts: number }
  | { type: "progress"; page: number; counters: ReplicateCounters }
  | {
      type: "product";
      codigo: string | null;
      nome: string | null;
      action:
        | "would-create"
        | "created"
        | "skipped-existing"
        | "skipped-non-simple"
        | "skipped-inactive"
        | "failed";
      detail?: string;
    }
  | { type: "done"; dryRun: boolean; counters: ReplicateCounters; errors: ReplicateError[] }
  | { type: "error"; message: string };

type Phase = "idle" | "running" | "done" | "error";

type LogKind = "info" | "create" | "exist" | "skip" | "fail";

interface LogEntry {
  time: string;
  kind: LogKind;
  text: string;
}

const EMPTY_COUNTERS: ReplicateCounters = {
  processed: 0,
  created: 0,
  skippedExisting: 0,
  skippedNonSimple: 0,
  skippedInactive: 0,
  categoriesCreated: 0,
  linked: 0,
  linkSkipped: 0,
  failed: 0,
};

/** Mantém o log enxuto — catálogos grandes geram milhares de eventos. */
const MAX_LOG_ENTRIES = 500;

const LOG_KIND_CLASSES: Record<LogKind, string> = {
  info: "text-slate-500 dark:text-slate-400",
  create: "text-emerald-600 dark:text-emerald-400",
  exist: "text-blue-600 dark:text-blue-400",
  skip: "text-amber-600 dark:text-amber-400",
  fail: "text-red-600 dark:text-red-400",
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function productLogEntry(
  event: Extract<ReplicateProgressEvent, { type: "product" }>,
): { kind: LogKind; text: string } | null {
  const label = event.codigo ?? event.nome ?? "?";
  const suffix = event.nome && event.codigo ? ` — ${event.nome}` : "";
  const detail = event.detail ? ` (${event.detail})` : "";

  switch (event.action) {
    case "would-create":
      return { kind: "create", text: `SERIA CRIADO ${label}${suffix}${detail}` };
    case "created":
      return { kind: "create", text: `CRIADO ${label}${suffix}${detail}` };
    case "skipped-existing":
      return {
        kind: "exist",
        text: `JÁ EXISTE ${label}${suffix} — pulado${detail}`,
      };
    case "skipped-non-simple":
      return { kind: "skip", text: `NÃO SIMPLES ${label}${suffix} — pulado${detail}` };
    case "failed":
      return {
        kind: "fail",
        text: `FALHA ${label}${suffix}: ${event.detail ?? "erro desconhecido"}`,
      };
    default:
      // skipped-inactive: omitido do log para não poluir (aparece nos contadores)
      return null;
  }
}

export function BlingProductReplicateSection() {
  const { toast } = useToast();
  const { data: connections } = useBlingAccounts();

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [lastRunDryRun, setLastRunDryRun] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [preloadStats, setPreloadStats] = useState<{
    categories: number;
    products: number;
  } | null>(null);
  const [counters, setCounters] = useState<ReplicateCounters>(EMPTY_COUNTERS);
  const [errors, setErrors] = useState<ReplicateError[]>([]);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  // Auto-scroll fica ativo apenas enquanto o usuário está no fim do log;
  // se ele rolar para cima para ler, o log para de "puxar" para baixo.
  const autoScrollRef = useRef(true);

  const connectedAccounts = (connections ?? []).filter(
    (connection) => connection.status === "connected",
  );

  const pushLog = useCallback((kind: LogKind, text: string) => {
    const time = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, { time, kind, text }].slice(-MAX_LOG_ENTRIES));
  }, []);

  // Rola somente o container do log (nunca a página), e apenas se o usuário
  // já estava acompanhando o fim do log.
  useEffect(() => {
    const el = logContainerRef.current;
    if (el && autoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const handleLogScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    autoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }, []);

  // Cronômetro da execução
  useEffect(() => {
    if (phase !== "running" || startedAt === null) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startedAt]);

  const isRunning = phase === "running";
  const skippedTotal = counters.skippedNonSimple + counters.skippedInactive;

  const handleStart = useCallback(async () => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    abortRef.current = new AbortController();
    const runDryRun = dryRun;
    setLastRunDryRun(runDryRun);
    setPhase("running");
    setStage("Conectando ao servidor...");
    setCurrentPage(0);
    setPreloadStats(null);
    setCounters(EMPTY_COUNTERS);
    setErrors([]);
    setShowAllErrors(false);
    setErrorMessage("");
    setLogs([]);
    autoScrollRef.current = true;
    const runStartedAt = Date.now();
    setStartedAt(runStartedAt);
    setElapsedMs(0);

    const params = new URLSearchParams({
      sourceConnectionId: sourceId,
      targetConnectionId: targetId,
      dryRun: String(runDryRun),
    });

    try {
      const response = await fetch(
        `/api/bling-products/replicate?${params.toString()}`,
        { signal: abortRef.current.signal },
      );

      if (!response.ok || !response.body) {
        throw new Error("Falha ao iniciar replicação");
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
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          const event = JSON.parse(dataLine.slice(6)) as ReplicateProgressEvent;

          if (event.type === "start") {
            setLastRunDryRun(event.dryRun);
            setStage("Indexando conta de destino...");
            pushLog(
              "info",
              event.dryRun
                ? "Replicação iniciada em modo simulação"
                : "Replicação iniciada em modo real",
            );
            pushLog("info", "Indexando categorias e produtos da conta de destino...");
          } else if (event.type === "preload") {
            setPreloadStats({
              categories: event.targetCategories,
              products: event.targetProducts,
            });
            setStage("Replicando produtos...");
            pushLog(
              "info",
              `Destino indexado: ${event.targetCategories} categorias, ${event.targetProducts} produtos`,
            );
            pushLog("info", "Buscando produtos da conta de origem...");
          } else if (event.type === "product") {
            const entry = productLogEntry(event);
            if (entry) pushLog(entry.kind, entry.text);
          } else if (event.type === "progress") {
            setCurrentPage(event.page);
            setCounters(event.counters);
            setStage(`Replicando produtos — página ${event.page} concluída`);
            pushLog(
              "info",
              `Página ${event.page} concluída: ${event.counters.processed} processados, ${event.counters.created} ${runDryRun ? "seriam criados" : "criados"}, ${event.counters.skippedExisting} já existentes`,
            );
          } else if (event.type === "done") {
            setCounters(event.counters);
            setErrors(event.errors);
            setPhase("done");
            setStage("");
            const duration = formatElapsed(Date.now() - runStartedAt);
            setElapsedMs(Date.now() - runStartedAt);
            pushLog(
              "info",
              `Concluído em ${duration} — ${event.counters.processed} processados, ${event.counters.created} ${event.dryRun ? "seriam criados" : "criados"}, ${event.counters.failed} falhas`,
            );
            toast({
              title: event.dryRun ? "Simulação concluída" : "Replicação concluída",
              description: `${event.counters.created} ${event.dryRun ? "seriam criados" : "criados"}, ${event.counters.skippedExisting} já existentes, ${event.counters.failed} falhas em ${duration}.`,
            });
          } else if (event.type === "error") {
            setErrorMessage(event.message);
            setPhase("error");
            setStage("");
            pushLog("fail", `Erro: ${event.message}`);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setPhase("idle");
        setStage("");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido");
      setPhase("error");
      setStage("");
    }
  }, [sourceId, targetId, dryRun, pushLog, toast]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const hasActivity = phase !== "idle";
  const visibleErrors = showAllErrors ? errors : errors.slice(0, 5);

  const counterCells = [
    { label: "Processados", value: counters.processed, className: "text-slate-900 dark:text-slate-100" },
    { label: lastRunDryRun ? "Seriam criados" : "Criados", value: counters.created, className: "text-emerald-600 dark:text-emerald-400" },
    { label: "Já existem", value: counters.skippedExisting, className: "text-blue-600 dark:text-blue-400" },
    { label: "Ignorados", value: skippedTotal, className: "text-slate-500 dark:text-slate-400" },
    { label: "Categorias", value: counters.categoriesCreated, className: "text-violet-600 dark:text-violet-400" },
    { label: "Vinculados", value: counters.linked, className: "text-emerald-600 dark:text-emerald-400" },
    { label: "Falhas", value: counters.failed, className: "text-red-600 dark:text-red-400" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Replicar produtos entre contas
        </span>
        {isRunning && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Replicando...
          </Badge>
        )}
        {phase === "done" && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Concluída
          </Badge>
        )}
        {phase === "error" && (
          <Badge className="bg-red-100 text-red-700 border-red-200">Falhou</Badge>
        )}
        {hasActivity && elapsedMs > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3 w-3" />
            {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Copia o catálogo de produtos de uma conta Bling para outra, recriando as
        categorias (país e tipo do vinho) e vinculando os produtos ao CRM
        automaticamente. Produtos que já existem no destino (mesmo código ou,
        para produtos sem código, mesmo nome) são pulados.
      </p>

      {dryRun ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Modo simulação: nenhum produto será criado no Bling. O relatório
            mostra o que seria criado.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700 dark:text-red-400" />
          <p className="text-xs text-red-700 dark:text-red-400">
            Modo real: os produtos e categorias serão criados de verdade na
            conta de destino.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="replicate-dry-run"
          checked={dryRun}
          onCheckedChange={(checked) => setDryRun(checked !== false)}
          disabled={isRunning}
        />
        <Label
          htmlFor="replicate-dry-run"
          className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
        >
          Modo simulação (apenas relatório, sem criar nada)
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Conta de origem</Label>
          <Select value={sourceId} onValueChange={setSourceId} disabled={isRunning}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a conta de origem" />
            </SelectTrigger>
            <SelectContent>
              {connectedAccounts.map((connection) => (
                <SelectItem
                  key={connection.id}
                  value={connection.id}
                  disabled={connection.id === targetId}
                >
                  {connection.name}
                  {connection.blingAccountName ? ` — ${connection.blingAccountName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Conta de destino</Label>
          <Select value={targetId} onValueChange={setTargetId} disabled={isRunning}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a conta de destino" />
            </SelectTrigger>
            <SelectContent>
              {connectedAccounts.map((connection) => (
                <SelectItem
                  key={connection.id}
                  value={connection.id}
                  disabled={connection.id === sourceId}
                >
                  {connection.name}
                  {connection.blingAccountName ? ` — ${connection.blingAccountName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleStart}
          disabled={isRunning || !sourceId || !targetId || sourceId === targetId}
        >
          {isRunning ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
          )}
          Iniciar replicação
        </Button>

        {isRunning && (
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
        )}
      </div>

      {hasActivity && (
        <div className="space-y-3">
          {(stage || preloadStats || currentPage > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {stage && (
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
                  {stage}
                </span>
              )}
              {currentPage > 0 && <span>Página {currentPage}</span>}
              {preloadStats && (
                <span>
                  Destino: {preloadStats.categories} categorias · {preloadStats.products} produtos
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900 sm:grid-cols-4 lg:grid-cols-7">
            {counterCells.map((cell) => (
              <div key={cell.label} className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">{cell.label}</p>
                <p className={`text-sm font-semibold ${cell.className}`}>{cell.value}</p>
              </div>
            ))}
          </div>

          {skippedTotal > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ignorados: {counters.skippedNonSimple} com variações/composição,{" "}
              {counters.skippedInactive} inativos.
              {counters.linkSkipped > 0 &&
                ` ${counters.linkSkipped} sem vínculo local na origem.`}
            </p>
          )}

          <div
            ref={logContainerRef}
            onScroll={handleLogScroll}
            className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-48 overflow-y-auto p-3 space-y-1 text-xs font-mono"
          >
            {logs.length === 0 ? (
              <span className="text-slate-400">Iniciando...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-slate-400 dark:text-slate-500">
                    {log.time}
                  </span>
                  <span className={cn("break-all", LOG_KIND_CLASSES[log.kind])}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>

          {phase === "error" && errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Erros ({errors.length}):
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {visibleErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <span className="font-medium">
                      {err.codigo ?? err.nome ?? "Produto"}:
                    </span>{" "}
                    {err.error}
                  </div>
                ))}
              </div>
              {errors.length > 5 && (
                <button
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                  onClick={() => setShowAllErrors((prev) => !prev)}
                >
                  {showAllErrors ? "Mostrar menos" : `Ver todos (${errors.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
