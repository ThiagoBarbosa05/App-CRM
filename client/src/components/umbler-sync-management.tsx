import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCcw,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
  Play,
  StopCircle,
  RotateCcw,
  Trash2,
  Settings,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

interface SyncStats {
  total: number;
  synced: number;
  pending: number;
  notFound: number;
  error: number;
  lastSyncDate: string | null;
}

interface SchedulerStatus {
  isActive: boolean;
  lastExecution: string | null;
  lastResult: {
    success: boolean;
    message: string;
    stats: {
      clientsProcessed: number;
      clientsSynced: number;
      clientsNotFound: number;
      clientsError: number;
      duration: number;
    } | null;
  } | null;
}

interface SyncStatus {
  isRunning: boolean;
  stats: SyncStats;
  scheduler: SchedulerStatus;
}

export default function UmblerSyncManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "administrador" || user?.role === "admin";

  const [batchSize, setBatchSize] = useState(100);
  const [cronExpression, setCronExpression] = useState("*/5 8-22 * * *");
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);

  // Buscar status completo com polling
  const { data: status, isLoading: statusLoading } = useQuery<SyncStatus>({
    queryKey: ["/api/umbler-sync/status"],
    queryFn: async () => {
      const res = await fetch("/api/umbler-sync/status");
      if (!res.ok) throw new Error("Falha ao buscar status");
      const data = await res.json();
      return data.data;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    staleTime: 10000,
  });

  // Mutation: Disparar sincronização manual
  const triggerSyncMutation = useMutation({
    mutationFn: async (params: { batchSize: number }) => {
      const res = await fetch("/api/umbler-sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao iniciar sincronização");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/umbler-sync/status"] });
      toast({
        title: "✓ Sincronização iniciada",
        description: data.message || "Processando clientes...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "✗ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation: Iniciar scheduler
  const startSchedulerMutation = useMutation({
    mutationFn: async (expression?: string) => {
      const res = await fetch("/api/umbler-sync/scheduler/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expression ? { cronExpression: expression } : {}),
      });
      if (!res.ok) throw new Error("Erro ao iniciar scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/umbler-sync/status"] });
      toast({
        title: "✓ Scheduler iniciado",
        description: "Sincronização automática ativada",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "✗ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation: Parar scheduler
  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/umbler-sync/scheduler/stop", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erro ao parar scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/umbler-sync/status"] });
      toast({
        title: "✓ Scheduler parado",
        description: "Sincronização automática desativada",
      });
      setShowStopDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "✗ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation: Reiniciar scheduler
  const restartSchedulerMutation = useMutation({
    mutationFn: async (expression: string) => {
      const res = await fetch("/api/umbler-sync/scheduler/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cronExpression: expression }),
      });
      if (!res.ok) throw new Error("Erro ao reiniciar scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/umbler-sync/status"] });
      toast({
        title: "✓ Scheduler reiniciado",
        description: "Nova configuração aplicada",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "✗ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation: Limpar snapshots órfãos
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/umbler-sync/cleanup", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erro ao limpar snapshots");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/umbler-sync/status"] });
      toast({
        title: "✓ Limpeza concluída",
        description: `${data.data.deletedCount} snapshot(s) órfão(s) removido(s)`,
      });
      setShowCleanupDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "✗ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTriggerSync = () => {
    triggerSyncMutation.mutate({ batchSize });
  };

  const handleStartScheduler = () => {
    startSchedulerMutation.mutate(cronExpression);
  };

  const handleStopScheduler = () => {
    setShowStopDialog(true);
  };

  const handleRestartScheduler = () => {
    restartSchedulerMutation.mutate(cronExpression);
  };

  const handleCleanup = () => {
    setShowCleanupDialog(true);
  };

  const estimatedTime = Math.ceil((status?.stats.total || 0) / batchSize) * 5;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 dark:border-t-blue-400 dark:border-blue-100 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 dark:text-slate-300">Carregando status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Sincronização Umbler
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Gerencie a sincronização automática de tags entre Umbler e CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.scheduler.isActive ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 dark:border-green-700 border-green-200 gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-200 animate-pulse" />
              Ativo
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 border-gray-200 gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              Inativo
            </Badge>
          )}
        </div>
      </div>

      {/* Sync em andamento */}
      {status?.isRunning && (
        <Card className="border-2 border-blue-200 dark:from-blue-900 dark:to-indigo-900 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 dark:bg-blue-400 rounded-lg">
                <RefreshCcw className="h-6 w-6 text-white animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900 dark:text-blue-100 text-lg">
                  Sincronização em andamento
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Processando clientes... Aguarde a conclusão.
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-400 dark:text-blue-200 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border-l-4 border-l-blue-500 dark:border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-100">
              Total de Clientes
            </CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-600 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-100" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-200 mb-2">
              {status?.stats.total || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">
              Clientes no sistema
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-green-50 dark:from-green-900 dark:to-emerald-900 dark:border-l-green-500 to-emerald-50 border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-100">
              Sincronizados
            </CardTitle>
            <div className="p-2 bg-green-100 dark:bg-green-600 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-100" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-300 mb-2">
              {status?.stats.synced || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">
              {status?.stats.total
                ? `${Math.round(
                    ((status.stats.synced || 0) / status.stats.total) * 100
                  )}% do total`
                : "0% do total"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-yellow-50 dark:from-yellow-900 dark:to-amber-900 dark:border-l-yellow-500 to-amber-50 border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-100">
              Pendentes
            </CardTitle>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-500 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-100" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-200 mb-2">
              {status?.stats.pending || 0}
            </div>
            <p className="text-sm text-gray- dark:text-slate-300 font-medium">
              Aguardando sincronização
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-br from-red-50 dark:from-red-900 dark:to-rose-900 dark:border-l-red-500 to-rose-50 border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-100">
              Erros
            </CardTitle>
            <div className="p-2 bg-red-100 dark:bg-red-600 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-100" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-200 mb-2">
              {status?.stats.error || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">
              Falhas na sincronização
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status do Scheduler */}
        <Card className="border-2 border-purple-200/60 bg-gradient-to-br from-background via-purple-50/30 to-background relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600" />
                Scheduler Automático
              </CardTitle>
              {status?.scheduler.isActive ? (
                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700">
                  Ativo
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                  Parado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 font-medium">Status:</span>
                <span className="font-semibold text-gray-900">
                  {status?.scheduler.isActive
                    ? "Executando automaticamente"
                    : "Pausado"}
                </span>
              </div>

              {status?.scheduler.lastExecution && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">
                    Última execução:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatDistanceToNow(
                      new Date(status.scheduler.lastExecution),
                      {
                        addSuffix: true,
                        locale: ptBR,
                      }
                    )}
                  </span>
                </div>
              )}

              {status?.scheduler.lastResult && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">
                    Último resultado:
                  </span>
                  <Badge
                    className={
                      status.scheduler.lastResult.success
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-red-100 text-red-800 border-red-200"
                    }
                  >
                    {status.scheduler.lastResult.success ? "Sucesso" : "Falha"}
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="cron-expression" className="text-sm font-medium">
                Expressão Cron
              </Label>
              <Input
                id="cron-expression"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="*/5 8-22 * * *"
                disabled={!isAdmin}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Padrão: A cada 5 minutos, das 8h às 22h
              </p>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                {status?.scheduler.isActive ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStopScheduler}
                      disabled={stopSchedulerMutation.isPending}
                      className="flex-1"
                    >
                      {stopSchedulerMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Parando...
                        </>
                      ) : (
                        <>
                          <StopCircle className="h-4 w-4 mr-2" />
                          Parar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRestartScheduler}
                      disabled={restartSchedulerMutation.isPending}
                      className="flex-1"
                    >
                      {restartSchedulerMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-700 rounded-full animate-spin mr-2" />
                          Reiniciando...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reiniciar
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white w-full"
                    size="sm"
                    onClick={handleStartScheduler}
                    disabled={startSchedulerMutation.isPending}
                  >
                    {startSchedulerMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar Scheduler
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {!isAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Apenas administradores podem controlar o scheduler
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sincronização Manual */}
        <Card className="border-2 border-blue-200/60 bg-gradient-to-br from-background via-blue-50/30 to-background relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-blue-600" />
              Sincronização Manual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="batch-size" className="text-sm font-medium">
                  Tamanho do Batch
                </Label>
                <span className="text-sm font-bold text-blue-600">
                  {batchSize} clientes
                </span>
              </div>
              <Slider
                id="batch-size"
                min={10}
                max={500}
                step={10}
                value={[batchSize]}
                onValueChange={([value]) => setBatchSize(value)}
                disabled={status?.isRunning}
                className="py-2"
              />
              <p className="text-xs text-gray-500">
                Tempo estimado: ~{estimatedTime} minutos para todos os clientes
              </p>
            </div>

            <div className="bg-white/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Clientes por execução:</span>
                <span className="font-semibold text-gray-900">{batchSize}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Execuções necessárias:</span>
                <span className="font-semibold text-gray-900">
                  {Math.ceil((status?.stats.total || 0) / batchSize)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Rate limit:</span>
                <span className="font-semibold text-gray-900">100 req/5s</span>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
              onClick={handleTriggerSync}
              disabled={
                status?.isRunning || triggerSyncMutation.isPending || !isAdmin
              }
            >
              {triggerSyncMutation.isPending || status?.isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Sincronizar Agora
                </>
              )}
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                className="w-full border-gray-300 hover:bg-gray-50"
                onClick={handleCleanup}
                disabled={cleanupMutation.isPending || status?.isRunning}
              >
                {cleanupMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-700 rounded-full animate-spin mr-2" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar Snapshots Órfãos
                  </>
                )}
              </Button>
            )}

            {!isAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Apenas administradores podem executar sincronização manual
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Última Execução - Detalhes */}
      {status?.scheduler.lastResult?.stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-600" />
              Última Execução - Detalhes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {status.scheduler.lastResult.stats.clientsProcessed}
                </div>
                <div className="text-xs text-gray-600 mt-1">Processados</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {status.scheduler.lastResult.stats.clientsSynced}
                </div>
                <div className="text-xs text-gray-600 mt-1">Sincronizados</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {status.scheduler.lastResult.stats.clientsNotFound}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Não encontrados
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {status.scheduler.lastResult.stats.clientsError}
                </div>
                <div className="text-xs text-gray-600 mt-1">Erros</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {(status.scheduler.lastResult.stats.duration / 1000).toFixed(
                    1
                  )}
                  s
                </div>
                <div className="text-xs text-gray-600 mt-1">Duração</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações Adicionais */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="info">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              Informações sobre a Sincronização
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">
                  Como funciona?
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>
                    O scheduler executa automaticamente de acordo com a
                    expressão cron configurada
                  </li>
                  <li>
                    Cada execução processa um batch de clientes (padrão: 100)
                  </li>
                  <li>
                    As tags do Umbler são sincronizadas automaticamente com o
                    CRM
                  </li>
                  <li>Rate limit respeitado: 100 requisições por 5 segundos</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-green-900 mb-2">
                  Boas Práticas
                </h4>
                <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                  <li>
                    Mantenha o scheduler ativo para sincronização automática
                  </li>
                  <li>Execute limpeza de snapshots órfãos semanalmente</li>
                  <li>
                    Use sincronização manual apenas quando necessário (urgente)
                  </li>
                  <li>
                    Monitore os logs para identificar problemas recorrentes
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-yellow-900 mb-2">
                  Expressões Cron Comuns
                </h4>
                <div className="text-sm text-yellow-800 space-y-1">
                  <div className="flex justify-between">
                    <code className="font-mono bg-yellow-100 px-2 py-1 rounded">
                      */5 8-22 * * *
                    </code>
                    <span>A cada 5 min, 8h-22h (padrão)</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="font-mono bg-yellow-100 px-2 py-1 rounded">
                      */10 * * * *
                    </code>
                    <span>A cada 10 min, 24/7</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="font-mono bg-yellow-100 px-2 py-1 rounded">
                      0 */2 * * *
                    </code>
                    <span>A cada 2 horas</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="font-mono bg-yellow-100 px-2 py-1 rounded">
                      */5 8-18 * * 1-5
                    </code>
                    <span>A cada 5 min, comercial, úteis</span>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Dialog: Confirmar Limpeza */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Limpeza</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover snapshots de clientes que não existem mais
              no CRM. Esta operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cleanupMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Confirmar Parar Scheduler */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar Scheduler</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja parar o scheduler? A sincronização
              automática será desativada até que você inicie novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stopSchedulerMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Parar Scheduler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
