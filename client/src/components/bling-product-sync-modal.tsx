import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, RefreshCw, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlingConnection {
  id: string;
  name: string;
  status: string;
  blingAccountName: string | null;
}

type SyncProgressEvent =
  | { type: "start" }
  | { type: "progress"; page: number; processed: number; linked: number; updated: number; skipped: number }
  | { type: "done"; linked: number; updated: number; skipped: number }
  | { type: "error"; message: string };

type Phase = "select" | "syncing" | "done" | "error";

interface SyncStats {
  processed: number;
  linked: number;
  updated: number;
  skipped: number;
  page: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlingProductSyncModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [stats, setStats] = useState<SyncStats>({ processed: 0, linked: 0, updated: 0, skipped: 0, page: 0 });
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: connectionsData, isLoading: isLoadingConnections } = useQuery({
    queryKey: ["/api/bling-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bling-accounts", {
        headers: {
          "x-user-id": user?.id ?? "",
          "x-user-role": user?.role ?? "",
        },
      });
      if (!res.ok) throw new Error("Falha ao carregar contas Bling");
      return res.json() as Promise<BlingConnection[]>;
    },
    enabled: open && !!user,
  });

  const connectedAccounts = (connectionsData ?? []).filter((c) => c.status === "connected");

  const appendLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const handleStart = useCallback(async () => {
    if (!selectedConnectionId || !user) return;

    abortRef.current = new AbortController();
    setPhase("syncing");
    setStats({ processed: 0, linked: 0, updated: 0, skipped: 0, page: 0 });
    setLogs([]);

    try {
      const response = await fetch(
        `/api/bling-products/sync?connectionId=${encodeURIComponent(selectedConnectionId)}`,
        {
          headers: {
            "x-user-id": user.id,
            "x-user-role": user.role,
          },
          signal: abortRef.current.signal,
        },
      );

      if (!response.ok || !response.body) {
        throw new Error("Falha ao iniciar sincronizacao");
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

          const event = JSON.parse(dataLine.slice(6)) as SyncProgressEvent;

          if (event.type === "start") {
            appendLog("Sincronizacao iniciada. Buscando produtos do Bling...");
          } else if (event.type === "progress") {
            setStats({
              processed: event.processed,
              linked: event.linked,
              updated: event.updated,
              skipped: event.skipped,
              page: event.page,
            });
            appendLog(
              `Pagina ${event.page}: ${event.processed} processados | ${event.linked} vinculados | ${event.updated} atualizados | ${event.skipped} sem correspondencia`,
            );
          } else if (event.type === "done") {
            setStats((prev) => ({
              ...prev,
              linked: event.linked,
              updated: event.updated,
              skipped: event.skipped,
            }));
            setPhase("done");
            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
            toast({ title: "Sincronizacao concluida", description: `${event.linked} vinculados, ${event.updated} atualizados.` });
          } else if (event.type === "error") {
            setErrorMessage(event.message);
            setPhase("error");
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setErrorMessage(msg);
      setPhase("error");
    }
  }, [selectedConnectionId, user, appendLog, toast]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("select");
  }, []);

  const handleClose = useCallback(() => {
    if (phase === "syncing") {
      abortRef.current?.abort();
    }
    setPhase("select");
    setSelectedConnectionId("");
    setStats({ processed: 0, linked: 0, updated: 0, skipped: 0, page: 0 });
    setLogs([]);
    setErrorMessage("");
    onOpenChange(false);
  }, [phase, onOpenChange]);

  const totalEstimated = stats.processed + stats.skipped;
  const progressValue = totalEstimated > 0 ? Math.min(100, (stats.processed / (totalEstimated || 1)) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Sincronizar Produtos do Bling
          </DialogTitle>
          <DialogDescription>
            Vincula automaticamente os produtos do Bling aos produtos do catálogo por similaridade de nome.
          </DialogDescription>
        </DialogHeader>

        {/* SELECT PHASE */}
        {phase === "select" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Conta Bling
              </label>
              {isLoadingConnections ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : connectedAccounts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                  Nenhuma conta Bling conectada. Configure uma conta em Configurações.
                </p>
              ) : (
                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma conta Bling" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedAccounts.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.name}
                        {conn.blingAccountName ? ` — ${conn.blingAccountName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-3 text-sm text-amber-800 dark:text-amber-300">
              A sincronização atualiza o preço de tabela dos produtos vinculados com o preço do Bling.
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleStart}
                disabled={!selectedConnectionId || connectedAccounts.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Iniciar Sincronização
              </Button>
            </div>
          </div>
        )}

        {/* SYNCING PHASE */}
        {phase === "syncing" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Página {stats.page > 0 ? stats.page : "—"}
                </span>
                <span className="text-slate-500 dark:text-slate-500">
                  {stats.processed} processados
                </span>
              </div>
              <Progress value={phase === "syncing" ? undefined : progressValue} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Vinculados", value: stats.linked, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Atualizados", value: stats.updated, color: "text-blue-600 dark:text-blue-400" },
                { label: "Sem match", value: stats.skipped, color: "text-slate-500 dark:text-slate-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-center">
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-32 overflow-y-auto p-3 space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
              {logs.length === 0 ? (
                <span className="text-slate-400">Iniciando...</span>
              ) : (
                logs.map((log, i) => <div key={i}>{log}</div>)
              )}
              <div ref={logsEndRef} />
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleCancel} size="sm">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* DONE PHASE */}
        {phase === "done" && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col items-center gap-2 py-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Sincronização concluída
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Vinculados", value: stats.linked, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Atualizados", value: stats.updated, color: "text-blue-600 dark:text-blue-400" },
                { label: "Sem match", value: stats.skipped, color: "text-slate-500 dark:text-slate-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-center">
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPhase("select")}>
                Sincronizar novamente
              </Button>
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white">
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* ERROR PHASE */}
        {phase === "error" && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col items-center gap-2 py-3">
              <XCircle className="h-10 w-10 text-red-500" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Erro na sincronização
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                {errorMessage}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPhase("select")}>
                Tentar novamente
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
