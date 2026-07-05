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
import { CheckCircle2, XCircle, RefreshCw, Link2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const VOLUMES = ["187ml", "375ml", "750ml", "1500ml"] as const;
const TYPES = ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] as const;

interface BlingConnection {
  id: string;
  name: string;
  status: string;
  blingAccountName: string | null;
}

type SyncProgressEvent =
  | { type: "start" }
  | { type: "progress"; page: number; processed: number; linked: number; updated: number; created: number; skipped: number }
  | { type: "done"; linked: number; updated: number; created: number; skipped: number }
  | { type: "error"; message: string };

type Phase = "select" | "configure" | "syncing" | "done" | "error";

interface SyncStats {
  processed: number;
  linked: number;
  updated: number;
  created: number;
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
  const [defaultCountry, setDefaultCountry] = useState<string>("OUTROS");
  const [defaultVolume, setDefaultVolume] = useState<string>("750ml");
  const [defaultType, setDefaultType] = useState<string>("TINTO");
  const [stats, setStats] = useState<SyncStats>({ processed: 0, linked: 0, updated: 0, created: 0, skipped: 0, page: 0 });
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: connectionsData, isLoading: isLoadingConnections } = useQuery({
    queryKey: ["/api/bling-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bling-accounts", {
        headers: {
        },
      });
      if (!res.ok) throw new Error("Falha ao carregar contas Bling");
      const body = await res.json() as { data: BlingConnection[] };
      return body.data;
    },
    enabled: open && !!user,
  });

  const { data: countries = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/tags/countries"],
    staleTime: 5 * 60 * 1000,
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
    setStats({ processed: 0, linked: 0, updated: 0, created: 0, skipped: 0, page: 0 });
    setLogs([]);

    const params = new URLSearchParams({
      connectionId: selectedConnectionId,
      defaultCountry,
      defaultVolume,
      defaultType,
    });

    try {
      const response = await fetch(`/api/bling-products/sync?${params.toString()}`, {
        headers: {
        },
        signal: abortRef.current.signal,
      });

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
              created: event.created,
              skipped: event.skipped,
              page: event.page,
            });
            appendLog(
              `Pag. ${event.page}: ${event.processed} processados | ${event.linked} vinculados | ${event.updated} atualizados | ${event.created} criados | ${event.skipped} sem correspondencia`,
            );
          } else if (event.type === "done") {
            setStats((prev) => ({
              ...prev,
              linked: event.linked,
              updated: event.updated,
              created: event.created,
              skipped: event.skipped,
            }));
            setPhase("done");
            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
            toast({
              title: "Sincronizacao concluida",
              description: `${event.linked} vinculados, ${event.created} criados, ${event.updated} atualizados.`,
            });
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
  }, [selectedConnectionId, defaultCountry, defaultVolume, defaultType, user, appendLog, toast]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("select");
  }, []);

  const handleClose = useCallback(() => {
    if (phase === "syncing") abortRef.current?.abort();
    setPhase("select");
    setSelectedConnectionId("");
    setDefaultCountry("OUTROS");
    setDefaultVolume("750ml");
    setDefaultType("TINTO");
    setStats({ processed: 0, linked: 0, updated: 0, created: 0, skipped: 0, page: 0 });
    setLogs([]);
    setErrorMessage("");
    onOpenChange(false);
  }, [phase, onOpenChange]);

  const statsCards = (s: SyncStats) => [
    { label: "Vinculados", value: s.linked, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Criados", value: s.created, color: "text-violet-600 dark:text-violet-400" },
    { label: "Atualizados", value: s.updated, color: "text-blue-600 dark:text-blue-400" },
    { label: "Sem match", value: s.skipped, color: "text-slate-500 dark:text-slate-400" },
  ];

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

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => setPhase("configure")}
                disabled={!selectedConnectionId || connectedAccounts.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Próximo
              </Button>
            </div>
          </div>
        )}

        {/* CONFIGURE PHASE */}
        {phase === "configure" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Defina os valores padrão para produtos do Bling que <span className="font-medium text-slate-800 dark:text-slate-200">não tiverem correspondência</span> no catálogo. Um novo produto será criado com esses valores.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">País de origem</label>
                <Select value={defaultCountry} onValueChange={setDefaultCountry}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Volume</label>
                <Select value={defaultVolume} onValueChange={setDefaultVolume}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOLUMES.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="outline" onClick={() => setPhase("select")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-white">
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
              <Progress className="h-2" />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {statsCards(stats).map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-center">
                  <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s.label}</p>
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

            <div className="grid grid-cols-4 gap-2">
              {statsCards(stats).map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-center">
                  <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s.label}</p>
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
