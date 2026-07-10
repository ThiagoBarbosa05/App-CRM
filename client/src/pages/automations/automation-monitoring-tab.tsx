import { useState } from "react";
import { AlertTriangle, ChevronRight, Mail, MessageSquare, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAutomationOverview,
  useAutomationRuleClients,
  useAutomationHistory,
  type AutomationRuleOverview,
} from "@/hooks/use-automations";

const TRIGGER_LABELS: Record<string, string> = {
  cashback_earned: "Cashback recebido na compra",
  cashback_expiring: "Cashback prestes a vencer",
  inactivity_reengagement: "Reengajamento por inatividade",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function ruleStepLabel(rule: AutomationRuleOverview): string | null {
  const params = rule.triggerParams;
  if (!params) return null;
  if (rule.trigger === "inactivity_reengagement" && params.attemptNumber) {
    return `Tentativa ${params.attemptNumber} — ${params.inactivityDays} dia(s) sem comprar`;
  }
  if (rule.trigger === "cashback_expiring" && params.daysBeforeExpiry !== undefined) {
    return `${params.daysBeforeExpiry} dia(s) antes do vencimento`;
  }
  return null;
}

function RuleDrillDown({
  rule,
  onClose,
}: {
  rule: AutomationRuleOverview;
  onClose: () => void;
}) {
  const { data: clients = [], isLoading } = useAutomationRuleClients(rule.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Clientes em: {rule.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Carregando clientes...
          </div>
        ) : clients.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum cliente dentro deste fluxo ainda.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  {rule.trigger === "inactivity_reengagement" && (
                    <TableHead>Etapa atual</TableHead>
                  )}
                  <TableHead>Último disparo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Envios (ok/falha)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.clientId}>
                    <TableCell className="font-medium">{c.clientName}</TableCell>
                    {rule.trigger === "inactivity_reengagement" && (
                      <TableCell>
                        {c.attemptsSent != null ? `Tentativa ${c.attemptsSent}` : "—"}
                      </TableCell>
                    )}
                    <TableCell>{formatDateTime(c.lastDispatchAt)}</TableCell>
                    <TableCell>
                      {c.lastStatus === "success" ? (
                        <Badge variant="secondary">Enviado</Badge>
                      ) : (
                        <Badge variant="destructive">Falhou</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.successCount}/{c.failedCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OverviewCards() {
  const { data: rules = [], isLoading } = useAutomationOverview();
  const [selectedRule, setSelectedRule] = useState<AutomationRuleOverview | null>(
    null,
  );

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-6">
        Carregando visão geral...
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6">
        Nenhuma regra de automação cadastrada ainda.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => {
          const stepLabel = ruleStepLabel(rule);
          const hasFailures = rule.failedRecent > 0;
          return (
            <Card
              key={rule.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => setSelectedRule(rule)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                    </p>
                    {stepLabel && (
                      <p className="text-xs text-muted-foreground">{stepLabel}</p>
                    )}
                  </div>
                  <Badge variant={rule.isActive ? "default" : "outline"}>
                    {rule.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{rule.activeClients} no fluxo</span>
                  </div>
                  <div className="text-muted-foreground">
                    {rule.sentRecent} disparo(s) em 30 dias
                  </div>
                </div>

                {hasFailures ? (
                  <div className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {rule.failedRecent} falha(s) recente(s) — última em{" "}
                      {formatDateTime(rule.lastFailureAt)}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Sem falhas recentes
                  </div>
                )}

                <div className="flex items-center justify-end text-xs text-primary">
                  Ver clientes <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedRule && (
        <RuleDrillDown rule={selectedRule} onClose={() => setSelectedRule(null)} />
      )}
    </>
  );
}

function HistoryTable() {
  const { data: rules = [] } = useAutomationOverview();
  const [ruleId, setRuleId] = useState<string>("all");
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useAutomationHistory({
    ruleId: ruleId === "all" ? undefined : ruleId,
    channel: channel === "all" ? undefined : (channel as "sms" | "email"),
    status: status === "all" ? undefined : (status as "success" | "failed"),
    page,
    pageSize,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select
            value={ruleId}
            onValueChange={(v) => {
              setRuleId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todas as regras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regras</SelectItem>
              {rules.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={channel}
            onValueChange={(v) => {
              setChannel(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="success">Enviado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Carregando histórico...
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum envio encontrado com esses filtros.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>{row.clientName ?? "—"}</TableCell>
                    <TableCell>{row.ruleName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {row.channel === "sms" ? (
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {row.channel === "sms" ? "SMS" : "E-mail"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.status === "success" ? (
                        <Badge variant="secondary">Enviado</Badge>
                      ) : (
                        <Badge variant="destructive">Falhou</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-destructive">
                      {row.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Página {data.page} de {totalPages} ({data.total} registro(s))
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AutomationMonitoringTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">Visão geral por regra</h3>
        <OverviewCards />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Histórico de envios</h3>
        <HistoryTable />
      </div>
    </div>
  );
}
