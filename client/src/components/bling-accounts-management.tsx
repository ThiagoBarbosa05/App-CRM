import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  KeyRound,
  Link2,
  Loader2,
  PlugZap,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  Unplug,
  Upload,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useBlingAccounts,
  useCreateBlingConnection,
  useDisconnectBlingConnection,
  useReconnectBlingConnection,
  useRefreshBlingConnection,
  useUpdateBlingConnection,
  type BlingAccountConnection,
} from "@/hooks/use-bling-accounts";
import {
  useExportStatus,
  useStartExport,
  useCancelExport,
  type ExportProgress,
} from "@/hooks/use-bling-export";
import {
  useImportStatus,
  useStartImport,
  useCancelImport,
  type ImportProgress,
} from "@/hooks/use-bling-import";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlingProductReplicateSection } from "@/components/bling-product-replicate-section";

function getExportStatusBadge(status: ExportProgress["status"]) {
  switch (status) {
    case "running":
      return { label: "Exportando...", className: "bg-amber-100 text-amber-700 border-amber-200" };
    case "completed":
      return { label: "Concluída", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "cancelled":
      return { label: "Cancelada", className: "bg-slate-100 text-slate-700 border-slate-200" };
    case "failed":
      return { label: "Falhou", className: "bg-red-100 text-red-700 border-red-200" };
    default:
      return null;
  }
}

type UserOption = { id: string; name: string; role: string; isActive: string };

function ClientExportSection({ connectionId }: { connectionId: string }) {
  const [includeBlingSourced, setIncludeBlingSourced] = useState(false);
  const [responsavelId, setResponsavelId] = useState("");
  const [showAllErrors, setShowAllErrors] = useState(false);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });

  const activeUsers = users.filter((u) => u.isActive === "true");

  const { data: exportStatus } = useExportStatus(connectionId);
  const startExportMutation = useStartExport();
  const cancelExportMutation = useCancelExport();

  const isRunning = exportStatus?.status === "running";
  const hasActivity = exportStatus && exportStatus.status !== "idle";

  const handleStart = async () => {
    try {
      await startExportMutation.mutateAsync({
        connectionId,
        includeBlingSourced,
        responsavelId: responsavelId || undefined,
      });
    } catch (error) {
      toast({
        title: "Erro ao iniciar exportação",
        description: error instanceof Error ? error.message : "Não foi possível iniciar a exportação",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelExportMutation.mutateAsync(connectionId);
    } catch (error) {
      toast({
        title: "Erro ao cancelar exportação",
        description: error instanceof Error ? error.message : "Não foi possível cancelar",
        variant: "destructive",
      });
    }
  };

  const exportBadge = exportStatus ? getExportStatusBadge(exportStatus.status) : null;
  const visibleErrors = showAllErrors
    ? (exportStatus?.errors ?? [])
    : (exportStatus?.errors ?? []).slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Exportar Clientes para o Bling
        </span>
        {exportBadge && (
          <Badge className={`ml-auto text-xs ${exportBadge.className}`}>
            {isRunning && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {exportBadge.label}
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-slate-600 dark:text-slate-400">
          Filtrar por vendedor
        </Label>
        <Select
          value={responsavelId}
          onValueChange={setResponsavelId}
          disabled={isRunning}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os clientes</SelectItem>
            {activeUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`include-bling-sourced-${connectionId}`}
          checked={includeBlingSourced}
          onCheckedChange={(checked) => setIncludeBlingSourced(checked === true)}
          disabled={isRunning}
        />
        <Label
          htmlFor={`include-bling-sourced-${connectionId}`}
          className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
        >
          Incluir clientes originados do Bling
        </Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleStart}
          disabled={isRunning || startExportMutation.isPending}
        >
          {startExportMutation.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-2 h-3.5 w-3.5" />
          )}
          Iniciar exportação
        </Button>

        {isRunning && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={cancelExportMutation.isPending}
          >
            Cancelar
          </Button>
        )}
      </div>

      {hasActivity && exportStatus && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Processados</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {exportStatus.processed}
                {exportStatus.totalFetched > 0 && (
                  <span className="text-xs font-normal text-slate-500">
                    {" "}/ {exportStatus.totalFetched}
                  </span>
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Criados</p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {exportStatus.created}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Atualizados</p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {exportStatus.updated}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Falhas</p>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {exportStatus.failed}
              </p>
            </div>
          </div>

          {exportStatus.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Erros ({exportStatus.errors.length}):
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {visibleErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <span className="font-medium">{err.clientName || err.clientId}:</span>{" "}
                    {err.error}
                  </div>
                ))}
              </div>
              {exportStatus.errors.length > 5 && (
                <button
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                  onClick={() => setShowAllErrors((prev) => !prev)}
                >
                  {showAllErrors
                    ? "Mostrar menos"
                    : `Ver todos (${exportStatus.errors.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getImportStatusBadge(status: ImportProgress["status"]) {
  switch (status) {
    case "running":
      return { label: "Importando...", className: "bg-blue-100 text-blue-700 border-blue-200" };
    case "completed":
      return { label: "Concluída", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "cancelled":
      return { label: "Cancelada", className: "bg-slate-100 text-slate-700 border-slate-200" };
    case "failed":
      return { label: "Falhou", className: "bg-red-100 text-red-700 border-red-200" };
    default:
      return null;
  }
}

function OrderImportSection({ connectionId }: { connectionId: string }) {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [forceUpdate, setForceUpdate] = useState(true);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const { toast } = useToast();

  const { data: importStatus } = useImportStatus(connectionId);
  const startImportMutation = useStartImport();
  const cancelImportMutation = useCancelImport();

  const isRunning = importStatus?.status === "running";
  const hasActivity = importStatus && importStatus.status !== "idle";
  const isDateRangeValid = startDate && endDate && startDate <= endDate;

  const handleStart = async () => {
    try {
      await startImportMutation.mutateAsync({
        connectionId,
        startDate,
        endDate,
        forceUpdate,
      });
    } catch (error) {
      toast({
        title: "Erro ao iniciar importação",
        description: error instanceof Error ? error.message : "Não foi possível iniciar a importação",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelImportMutation.mutateAsync(connectionId);
    } catch (error) {
      toast({
        title: "Erro ao cancelar importação",
        description: error instanceof Error ? error.message : "Não foi possível cancelar",
        variant: "destructive",
      });
    }
  };

  const importBadge = importStatus ? getImportStatusBadge(importStatus.status) : null;
  const visibleErrors = showAllErrors
    ? (importStatus?.errors ?? [])
    : (importStatus?.errors ?? []).slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Importar Pedidos do Bling
        </span>
        {importBadge && (
          <Badge className={`ml-auto text-xs ${importBadge.className}`}>
            {isRunning && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {importBadge.label}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`import-start-${connectionId}`} className="text-xs">
            Data inicial
          </Label>
          <Input
            id={`import-start-${connectionId}`}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isRunning}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`import-end-${connectionId}`} className="text-xs">
            Data final
          </Label>
          <Input
            id={`import-end-${connectionId}`}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isRunning}
            className="text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`force-update-${connectionId}`}
          checked={forceUpdate}
          onCheckedChange={(checked) => setForceUpdate(checked === true)}
          disabled={isRunning}
        />
        <Label
          htmlFor={`force-update-${connectionId}`}
          className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
        >
          Atualizar pedidos já importados
        </Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleStart}
          disabled={isRunning || startImportMutation.isPending || !isDateRangeValid}
        >
          {startImportMutation.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-2 h-3.5 w-3.5" />
          )}
          Iniciar importação
        </Button>

        {isRunning && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={cancelImportMutation.isPending}
          >
            Cancelar
          </Button>
        )}
      </div>

      {hasActivity && importStatus && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900 sm:grid-cols-6">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Buscados</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {importStatus.totalFetched}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Processados</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {importStatus.processed}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Criados</p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {importStatus.created}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Atualizados</p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {importStatus.updated}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ignorados</p>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {importStatus.skipped}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Falhas</p>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {importStatus.failed}
              </p>
            </div>
          </div>

          {importStatus.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Erros ({importStatus.errors.length}):
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {visibleErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <span className="font-medium">Pedido {err.orderId}:</span>{" "}
                    {err.error}
                  </div>
                ))}
              </div>
              {importStatus.errors.length > 5 && (
                <button
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                  onClick={() => setShowAllErrors((prev) => !prev)}
                >
                  {showAllErrors
                    ? "Mostrar menos"
                    : `Ver todos (${importStatus.errors.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusBadge(status: BlingAccountConnection["status"]) {
  switch (status) {
    case "connected":
      return { label: "Conectada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "reauth_required":
      return { label: "Reconectar", className: "bg-amber-100 text-amber-700 border-amber-200" };
    case "expired":
      return { label: "Expirada", className: "bg-orange-100 text-orange-700 border-orange-200" };
    case "revoked":
      return { label: "Revogada", className: "bg-slate-100 text-slate-700 border-slate-200" };
    case "error":
      return { label: "Erro", className: "bg-red-100 text-red-700 border-red-200" };
    default:
      return { label: "Pendente", className: "bg-blue-100 text-blue-700 border-blue-200" };
  }
}

function formatRelativeDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return formatDistanceToNow(new Date(value), {
    addSuffix: true,
    locale: ptBR,
  });
}

type DuplicateRow = {
  id: string;
  bling_order_id: string;
  order_number: string;
  contact_name: string | null;
  sale_date: string;
  total_value: string;
  connection_id: string | null;
  situation_value: string | null;
  created_at: string;
};

type DuplicateGroup = {
  keep: DuplicateRow;
  remove: DuplicateRow[];
};

function useDuplicatesPreview(enabled: boolean) {
  return useQuery<DuplicateGroup[]>({
    queryKey: ["/api/bling-accounts/duplicates-preview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/bling-accounts/duplicates-preview");
      const body = await res.json();
      return body.data;
    },
    enabled,
    staleTime: 0,
  });
}

function useCleanupDuplicates() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bling-accounts/cleanup-duplicates");
      return res.json() as Promise<{ success: boolean; data: { deleted: number } }>;
    },
  });
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value),
  );
}

function DuplicatesPreviewDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const { data: groups = [], isLoading } = useDuplicatesPreview(open);

  const totalToRemove = groups.reduce((acc, g) => acc + g.remove.length, 0);

  function renderRow(row: DuplicateRow, action: "keep" | "remove") {
    const isKeep = action === "keep";
    return (
      <div
        key={row.id}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
          isKeep
            ? "bg-emerald-50 dark:bg-emerald-950/30"
            : "bg-red-50 dark:bg-red-950/30"
        }`}
      >
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide text-[10px] ${
            isKeep
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300"
          }`}
        >
          {isKeep ? "manter" : "remover"}
        </span>
        <span className="font-medium text-slate-800 dark:text-slate-200 shrink-0">
          #{row.order_number}
        </span>
        <span className="text-slate-500 dark:text-slate-400 truncate flex-1">
          {row.contact_name ?? "—"}
        </span>
        <span className="text-slate-600 dark:text-slate-300 shrink-0">
          {row.sale_date}
        </span>
        <span className="font-medium text-slate-800 dark:text-slate-200 shrink-0">
          {formatCurrency(row.total_value)}
        </span>
        <span className="text-slate-400 dark:text-slate-500 shrink-0 text-[10px]">
          {row.connection_id ? `conn: ${row.connection_id.slice(0, 8)}…` : "sem conexão"}
        </span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pedidos duplicados</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Carregando..."
              : groups.length === 0
                ? "Nenhum pedido duplicado encontrado."
                : `${groups.length} grupo(s) com duplicatas — ${totalToRemove} pedido(s) serão removidos.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">Nenhuma duplicata encontrada</p>
          </div>
        )}

        {!isLoading && groups.length > 0 && (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4">
              {groups.map((group) => (
                <div
                  key={group.keep.bling_order_id}
                  className="space-y-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Bling ID: {group.keep.bling_order_id}
                  </p>
                  {renderRow(group.keep, "keep")}
                  {group.remove.map((row) => renderRow(row, "remove"))}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting || isLoading || groups.length === 0}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remover {totalToRemove > 0 ? `${totalToRemove} duplicata(s)` : "duplicatas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BlingAccountsManagement() {
  const [connectionName, setConnectionName] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; oauthClientId: string; oauthClientSecret: string }>
  >({});
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const { toast } = useToast();
  const cleanupMutation = useCleanupDuplicates();

  const handleConfirmCleanup = async () => {
    try {
      const result = await cleanupMutation.mutateAsync();
      const count = result.data.deleted;
      setDuplicatesOpen(false);
      toast({
        title: count > 0 ? "Duplicatas removidas" : "Nenhuma duplicata encontrada",
        description:
          count > 0
            ? `${count} pedido(s) duplicado(s) foram removidos.`
            : "Não há pedidos duplicados no banco de dados.",
      });
    } catch (error) {
      toast({
        title: "Erro ao limpar duplicatas",
        description: error instanceof Error ? error.message : "Não foi possível limpar os duplicados",
        variant: "destructive",
      });
    }
  };
  const { data: connections = [], isLoading } = useBlingAccounts();
  const createConnectionMutation = useCreateBlingConnection();
  const reconnectMutation = useReconnectBlingConnection();
  const refreshMutation = useRefreshBlingConnection();
  const disconnectMutation = useDisconnectBlingConnection();
  const updateConnectionMutation = useUpdateBlingConnection();

  useEffect(() => {
    setDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const connection of connections) {
        if (!nextDrafts[connection.id]) {
          nextDrafts[connection.id] = {
            name: connection.name,
            oauthClientId: connection.oauthClientId,
            oauthClientSecret: "",
          };
        }
      }

      return nextDrafts;
    });
  }, [connections]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("bling");
    const message = url.searchParams.get("message");
    const tab = url.searchParams.get("tab");

    if (tab !== "integrations" || !status || !message) {
      return;
    }

    toast({
      title: status === "success" ? "Conta Bling conectada" : "Falha na conexao com Bling",
      description: message,
      variant: status === "success" ? "default" : "destructive",
    });

    queryClient.invalidateQueries({ queryKey: ["/api/bling-accounts"] });

    url.searchParams.delete("bling");
    url.searchParams.delete("message");
    window.history.replaceState({}, "", url.toString());
  }, [toast]);

  const connectedCount = useMemo(
    () => connections.filter((connection) => connection.status === "connected").length,
    [connections],
  );

  const handleStartAuthorization = async (payloadInput: {
    name: string;
    oauthClientId: string;
    oauthClientSecret: string;
  }) => {
    const payload = await createConnectionMutation.mutateAsync(payloadInput);
    window.location.href = payload.data.authorizationUrl;
  };

  const handleReconnect = async (connectionId: string) => {
    const payload = await reconnectMutation.mutateAsync(connectionId);
    window.location.href = payload.data.authorizationUrl;
  };

  const handleCreateConnection = async () => {
    try {
      await handleStartAuthorization({
        name: connectionName.trim(),
        oauthClientId: clientId.trim(),
        oauthClientSecret: clientSecret.trim(),
      });
    } catch (error) {
      toast({
        title: "Erro ao iniciar conexao",
        description: error instanceof Error ? error.message : "Nao foi possivel iniciar a autenticacao com o Bling",
        variant: "destructive",
      });
    }
  };

  const handleDraftChange = (
    connectionId: string,
    field: "name" | "oauthClientId" | "oauthClientSecret",
    value: string,
  ) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [connectionId]: {
        ...currentDrafts[connectionId],
        [field]: value,
      },
    }));
  };

  const handleSaveSettings = async (connectionId: string) => {
    const draft = drafts[connectionId];

    if (!draft) {
      return;
    }

    try {
      await updateConnectionMutation.mutateAsync({
        connectionId,
        name: draft.name.trim(),
        oauthClientId: draft.oauthClientId.trim(),
        oauthClientSecret:
          draft.oauthClientSecret.trim().length > 0
            ? draft.oauthClientSecret.trim()
            : undefined,
      });

      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [connectionId]: {
          ...currentDrafts[connectionId],
          oauthClientSecret: "",
        },
      }));

      toast({
        title: "Credenciais atualizadas",
        description: "As configuracoes da conta Bling foram salvas.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar credenciais",
        description:
          error instanceof Error ? error.message : "Nao foi possivel atualizar a conta Bling",
        variant: "destructive",
      });
    }
  };

  const handleRefreshConnection = async (connectionId: string) => {
    try {
      await refreshMutation.mutateAsync(connectionId);
      toast({
        title: "Conexao renovada",
        description: "Os tokens da conta Bling foram atualizados com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao renovar conexao",
        description: error instanceof Error ? error.message : "Nao foi possivel renovar a conexao",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectConnection = async (connectionId: string) => {
    try {
      await disconnectMutation.mutateAsync(connectionId);
      toast({
        title: "Conta desconectada",
        description: "A conta Bling foi revogada no app",
      });
    } catch (error) {
      toast({
        title: "Erro ao desconectar conta",
        description: error instanceof Error ? error.message : "Nao foi possivel desconectar a conta",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 dark:border-slate-700">
        <div className="relative border-b border-slate-200 bg-gradient-to-r from-[#5ac782]/10 via-white to-[#5ac782]/5 px-6 py-5 dark:border-slate-800 dark:from-[#5ac782]/10 dark:via-slate-900 dark:to-[#5ac782]/5">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-lg"
            style={{ backgroundColor: "#5ac782" }}
          />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <img
                  src="/bling.svg"
                  alt="Bling"
                  className="h-7 w-auto"
                  style={{ filter: "drop-shadow(0 1px 2px rgba(90,199,130,0.25))" }}
                />
                <div
                  className="h-5 w-px rounded-full"
                  style={{ backgroundColor: "#5ac782", opacity: 0.4 }}
                />
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Contas Bling
                </h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Conecte e mantenha as contas Bling autenticadas para uso no CRM.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-[#5ac782]/40 bg-[#5ac782]/10 text-[#3a9960] dark:border-[#5ac782]/30 dark:bg-[#5ac782]/10 dark:text-[#5ac782]"
              >
                {connectedCount} conectada(s)
              </Badge>
              <Badge variant="outline" className="text-slate-600 dark:text-slate-400">
                {connections.length} cadastrada(s)
              </Badge>
            </div>
          </div>
        </div>
        <CardHeader className="sr-only">
          <CardTitle>Contas Bling</CardTitle>
          <CardDescription>Gerenciamento de contas Bling</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-3 lg:items-end">
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="bling-connection-name">Nome da conta no CRM</Label>
              <Input
                id="bling-connection-name"
                value={connectionName}
                onChange={(event) => setConnectionName(event.target.value)}
                placeholder="Ex: Bling Matriz"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bling-client-id">Client ID</Label>
              <Input
                id="bling-client-id"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="Client ID do app Bling"
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bling-client-secret">Client Secret</Label>
              <Input
                id="bling-client-secret"
                type="password"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder="Client Secret do app Bling"
                maxLength={500}
              />
            </div>

            <Button
              onClick={handleCreateConnection}
              disabled={
                createConnectionMutation.isPending ||
                connectionName.trim().length === 0 ||
                clientId.trim().length === 0 ||
                clientSecret.trim().length === 0
              }
              className="min-w-[220px] lg:col-span-3 text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#5ac782", borderColor: "#5ac782" }}
            >
              {createConnectionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="mr-2 h-4 w-4" />
              )}
              Conectar nova conta
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Limpar pedidos duplicados
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Remove duplicatas geradas por reimportações. Operação reversível (soft-delete).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40 shrink-0"
              onClick={() => setDuplicatesOpen(true)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Ver duplicatas
            </Button>
          </div>

          <DuplicatesPreviewDialog
            open={duplicatesOpen}
            onOpenChange={setDuplicatesOpen}
            onConfirm={handleConfirmCleanup}
            isDeleting={cleanupMutation.isPending}
          />

          {connections.filter((c) => c.status === "connected").length >= 2 ? (
            <BlingProductReplicateSection />
          ) : connections.length > 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conecte pelo menos duas contas para replicar produtos entre elas.
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {isLoading && (
              <Card className="border-dashed xl:col-span-2">
                <CardContent className="flex items-center justify-center p-10 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando contas Bling...
                </CardContent>
              </Card>
            )}

            {!isLoading && connections.length === 0 && (
              <Card className="border-dashed xl:col-span-2">
                <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <Link2 className="h-8 w-8 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      Nenhuma conta Bling conectada
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Crie uma conexao acima para iniciar o fluxo OAuth com o Bling.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {connections.map((connection) => {
              const badge = getStatusBadge(connection.status);
              const draft = drafts[connection.id] ?? {
                name: connection.name,
                oauthClientId: connection.oauthClientId,
                oauthClientSecret: "",
              };

              return (
                <Card key={connection.id} className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg text-slate-900 dark:text-slate-100">
                          {connection.name}
                        </CardTitle>
                        <CardDescription>
                          {connection.blingAccountName || connection.blingLogin || "Conta aguardando identificacao do Bling"}
                        </CardDescription>
                      </div>

                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`name-${connection.id}`}>Nome interno</Label>
                        <Input
                          id={`name-${connection.id}`}
                          value={draft.name}
                          onChange={(event) =>
                            handleDraftChange(connection.id, "name", event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`client-id-${connection.id}`}>Client ID</Label>
                        <Input
                          id={`client-id-${connection.id}`}
                          value={draft.oauthClientId}
                          onChange={(event) =>
                            handleDraftChange(
                              connection.id,
                              "oauthClientId",
                              event.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`client-secret-${connection.id}`}>
                          Novo Client Secret
                        </Label>
                        <Input
                          id={`client-secret-${connection.id}`}
                          type="password"
                          value={draft.oauthClientSecret}
                          onChange={(event) =>
                            handleDraftChange(
                              connection.id,
                              "oauthClientSecret",
                              event.target.value,
                            )
                          }
                          placeholder={
                            connection.hasOauthClientSecret
                              ? "Deixe em branco para manter o atual"
                              : "Informe o client secret"
                          }
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => handleSaveSettings(connection.id)}
                          disabled={updateConnectionMutation.isPending}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Salvar credenciais
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">Login Bling</p>
                        <p>{connection.blingLogin || "-"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">Conta Bling</p>
                        <p>{connection.blingAccountId || "-"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">Credenciais</p>
                        <p className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          {connection.hasOauthClientSecret ? "Client Secret salvo" : "Sem Client Secret"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">Token expira</p>
                        <p>{formatRelativeDate(connection.accessTokenExpiresAt)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">Ultima renovacao</p>
                        <p>{formatRelativeDate(connection.lastRefreshAt)}</p>
                      </div>
                    </div>

                    {connection.lastError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{connection.lastError}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRefreshConnection(connection.id)}
                        disabled={refreshMutation.isPending || connection.status === "revoked"}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Renovar token
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleReconnect(connection.id)}
                        disabled={reconnectMutation.isPending}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Reconectar
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() => handleDisconnectConnection(connection.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        <Unplug className="mr-2 h-4 w-4" />
                        Desconectar
                      </Button>
                    </div>

                    {connection.status === "connected" && (
                      <>
                        <OrderImportSection connectionId={connection.id} />
                        <ClientExportSection connectionId={connection.id} />
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
