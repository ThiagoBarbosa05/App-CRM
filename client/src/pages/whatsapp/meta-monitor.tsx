import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  ShieldAlert,
  Workflow,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useWaMonitorHealth,
  useWaMonitorEvents,
  useWhatsappTemplates,
  useWhatsappFlows,
  type WaAccountEvent,
  type WhatsappTemplate,
  type WhatsappFlow,
} from "@/hooks/use-whatsapp";
import { queryClient } from "@/lib/queryClient";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  try {
    return format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function formatRelative(d: string) {
  try {
    return formatDistanceToNow(new Date(d), { locale: ptBR, addSuffix: true });
  } catch {
    return "—";
  }
}

// ── Severity badge ─────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <Badge variant="secondary">INFO</Badge>;
  const cfg: Record<string, { label: string; className: string }> = {
    CRITICAL: { label: "Crítico",  className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    HIGH:     { label: "Alto",     className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    INFO:     { label: "Info",     className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  };
  const c = cfg[severity] ?? { label: severity, className: "bg-slate-100 text-slate-600" };
  return <Badge className={cn("font-medium text-xs", c.className)}>{c.label}</Badge>;
}

// ── Meta status badge for templates ───────────────────────────────────────────

function MetaStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  const cfg: Record<string, { label: string; className: string }> = {
    APPROVED:         { label: "Aprovado",     className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    REJECTED:         { label: "Rejeitado",    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    PAUSED:           { label: "Pausado",      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    PENDING_DELETION: { label: "Em exclusão",  className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    FLAGGED:          { label: "Sinalizado",   className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    DISABLED:         { label: "Desabilitado", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  };
  const c = cfg[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return <Badge className={cn("font-medium text-xs", c.className)}>{c.label}</Badge>;
}

// ── Quality score badge ────────────────────────────────────────────────────────

function QualityBadge({ score }: { score: string | null | undefined }) {
  if (!score) return <span className="text-muted-foreground text-sm">—</span>;
  const cfg: Record<string, { label: string; className: string }> = {
    GREEN:   { label: "Verde",      className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    YELLOW:  { label: "Amarelo",    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    RED:     { label: "Vermelho",   className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    UNKNOWN: { label: "Desconhecido", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  };
  const c = cfg[score] ?? { label: score, className: "bg-slate-100 text-slate-600" };
  return <Badge className={cn("font-medium text-xs", c.className)}>{c.label}</Badge>;
}

// ── Flow status badge ──────────────────────────────────────────────────────────

function FlowStatusBadge({ status }: { status: WhatsappFlow["status"] }) {
  const cfg: Record<WhatsappFlow["status"], { label: string; className: string }> = {
    PUBLISHED:  { label: "Publicado",   className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    DRAFT:      { label: "Rascunho",    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    DEPRECATED: { label: "Depreciado",  className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    BLOCKED:    { label: "Bloqueado",   className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  };
  const c = cfg[status];
  return <Badge className={cn("font-medium text-xs", c.className)}>{c.label}</Badge>;
}

// ── Throughput tier label ──────────────────────────────────────────────────────

function tierLabel(tier: string | null) {
  if (!tier) return "Não definido";
  const map: Record<string, string> = {
    TIER_50:       "50 conv/dia",
    TIER_250:      "250 conv/dia",
    TIER_2K:       "2.000 conv/dia",
    TIER_10K:      "10.000 conv/dia",
    TIER_100K:     "100.000 conv/dia",
    TIER_UNLIMITED: "Ilimitado",
    TIER_NOT_SET:  "Não definido",
  };
  return map[tier] ?? tier;
}

// ── Summary cards ──────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data: health, isLoading } = useWaMonitorHealth();

  const cards = [
    {
      title: "Throughput",
      icon: Zap,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-900/30",
      value: isLoading ? null : tierLabel(health?.throughputTier ?? null),
      description: "Limite diário de conversas",
      alert: false,
    },
    {
      title: "Templates com problema",
      icon: FileText,
      iconColor: "text-orange-600 dark:text-orange-400",
      iconBg: "bg-orange-50 dark:bg-orange-900/30",
      value: isLoading ? null : String(health?.templatesWithIssues ?? 0),
      description: "Rejeitados, pausados ou desabilitados",
      alert: (health?.templatesWithIssues ?? 0) > 0,
    },
    {
      title: "Flows bloqueados",
      icon: Workflow,
      iconColor: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-50 dark:bg-red-900/30",
      value: isLoading ? null : String(health?.flowsBlocked ?? 0),
      description: "Bloqueados ou depreciados pela Meta",
      alert: (health?.flowsBlocked ?? 0) > 0,
    },
    {
      title: "Último alerta crítico",
      icon: ShieldAlert,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-50 dark:bg-purple-900/30",
      value: isLoading
        ? null
        : health?.lastCriticalEvent
          ? formatRelative(health.lastCriticalEvent.createdAt)
          : "Nenhum",
      description: health?.lastCriticalEvent?.eventType ?? "Sem alertas críticos",
      alert: !!health?.lastCriticalEvent,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            "transition-colors",
            card.alert && "border-orange-200 dark:border-orange-800",
          )}
        >
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-start justify-between gap-3">
              <div className={cn("p-2 rounded-xl", card.iconBg)}>
                <card.icon className={cn("h-5 w-5", card.iconColor)} />
              </div>
              {card.alert && (
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              )}
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-20 mb-1" />
              ) : (
                <p className="text-2xl font-bold text-foreground leading-tight">{card.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{card.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Events tab ─────────────────────────────────────────────────────────────────

function EventsTab() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data, isLoading } = useWaMonitorEvents({
    severity: severityFilter === "all" ? undefined : severityFilter,
    limit,
    offset,
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="CRITICAL">Crítico</SelectItem>
            <SelectItem value="HIGH">Alto</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{total} evento{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Severidade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Campo</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum evento registrado
                </TableCell>
              </TableRow>
            ) : (
              events.map((event: WaAccountEvent) => (
                <>
                  <TableRow
                    key={event.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggle(event.id)}
                  >
                    <TableCell>
                      {expandedId === event.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell><SeverityBadge severity={event.severity} /></TableCell>
                    <TableCell className="font-medium text-sm">{event.eventType}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{event.field}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(event.createdAt)}
                    </TableCell>
                  </TableRow>
                  {expandedId === event.id && (
                    <TableRow key={`${event.id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        <pre className="text-xs font-mono p-4 overflow-x-auto text-foreground/80 whitespace-pre-wrap break-all">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} de {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
          >
            Próximo
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Templates tab ──────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { data: templates = [], isLoading } = useWhatsappTemplates();

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status Meta</TableHead>
            <TableHead>Qualidade</TableHead>
            <TableHead className="hidden md:table-cell">Ativo</TableHead>
            <TableHead className="hidden lg:table-cell">Caso de uso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))
          ) : templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum template cadastrado
              </TableCell>
            </TableRow>
          ) : (
            templates.map((tpl: WhatsappTemplate) => (
              <TableRow key={tpl.id}>
                <TableCell className="font-medium text-sm">{tpl.name}</TableCell>
                <TableCell><MetaStatusBadge status={tpl.metaStatus} /></TableCell>
                <TableCell><QualityBadge score={tpl.qualityScore} /></TableCell>
                <TableCell className="hidden md:table-cell">
                  {tpl.isActive
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : <span className="text-muted-foreground text-sm">Inativo</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm capitalize">
                  {tpl.useCase.replace(/_/g, " ")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Flows tab ──────────────────────────────────────────────────────────────────

function FlowsTab() {
  const { data: flows = [], isLoading } = useWhatsappFlows();

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">ID Meta</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))
          ) : flows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                <Workflow className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum flow sincronizado
              </TableCell>
            </TableRow>
          ) : (
            flows.map((flow: WhatsappFlow) => (
              <TableRow key={flow.id}>
                <TableCell className="font-medium text-sm">{flow.name}</TableCell>
                <TableCell><FlowStatusBadge status={flow.status} /></TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-xs font-mono">{flow.metaFlowId}</TableCell>
                <TableCell className="hidden lg:table-cell text-right text-muted-foreground text-sm whitespace-nowrap">
                  {formatDate(flow.updatedAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MetaMonitorPage() {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "monitor"] });
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "flows"] });
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] });
    setRefreshing(false);
  }

  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6 space-y-5">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Activity}
            color="text-emerald-600 dark:text-emerald-400"
            bgColor="bg-emerald-50 dark:bg-emerald-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Monitor Meta</PageHeader.Title>
            <PageHeader.Description>
              Acompanhe alertas de conta, qualidade de templates e status de flows em tempo real
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Atualizar
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      <SummaryCards />

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs defaultValue="events">
            <TabsList className="mb-4">
              <TabsTrigger value="events">Eventos de Conta</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="flows">Flows</TabsTrigger>
            </TabsList>
            <TabsContent value="events"><EventsTab /></TabsContent>
            <TabsContent value="templates"><TemplatesTab /></TabsContent>
            <TabsContent value="flows"><FlowsTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
