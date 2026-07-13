import { useState } from "react";
import { useLocation } from "wouter";
import {
  Plus, Send, Clock, Pause, CheckCircle, XCircle, AlertCircle,
  BarChart2, MessageCircle, ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWhatsappCampaigns, useWhatsappStatus, type WhatsappCampaign } from "@/hooks/use-whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WhatsappOptOutInfoBanner } from "@/components/whatsapp/opt-out-info-banner";

const STATUS_CONFIG: Record<
  WhatsappCampaign["status"],
  { label: string; icon: React.ElementType; className: string; dotColor: string }
> = {
  created:     { label: "Agendada",      icon: Clock,        className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",   dotColor: "bg-indigo-400" },
  in_progress: { label: "Em andamento",  icon: Send,         className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",   dotColor: "bg-yellow-400" },
  paused:      { label: "Pausada",       icon: Pause,        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",       dotColor: "bg-amber-400" },
  completed:   { label: "Concluída",     icon: CheckCircle,  className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",       dotColor: "bg-green-500" },
  failed:      { label: "Falhou",        icon: XCircle,      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",               dotColor: "bg-red-500" },
  cancelled:   { label: "Cancelada",     icon: AlertCircle,  className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",          dotColor: "bg-slate-400" },
};

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  const color = pct === 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

// Card view for mobile screens (replaces table rows)
function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: WhatsappCampaign;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[campaign.status];
  const StatusIcon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors active:bg-muted/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-semibold truncate">{campaign.title}</p>
          <Badge className={cn(cfg.className, "border-0 gap-1 text-xs")}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
          <div className="pt-1">
            <ProgressBar sent={campaign.sentMessages} total={campaign.totalContacts} />
          </div>
          <p className="text-xs text-muted-foreground">
            {campaign.sentMessages}/{campaign.totalContacts} enviadas
            {campaign.failedMessages > 0 && (
              <span className="text-red-500 ml-2">· {campaign.failedMessages} falha(s)</span>
            )}
            <span className="ml-2">· {formatDate(campaign.startDate)}</span>
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

// Skeleton row for table
function SkeletonRow() {
  return (
    <TableRow>
      {[40, 80, 50, 60, 100, 70, 60].map((w, i) => (
        <TableCell key={i} className={i >= 2 ? (i >= 4 ? "hidden lg:table-cell" : "hidden md:table-cell") : ""}>
          <div className={cn("h-4 bg-muted rounded animate-pulse")} style={{ width: `${w}%` }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// Skeleton card for mobile
function SkeletonCard() {
  return (
    <div className="p-4 border-b border-border space-y-2 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-5 bg-muted rounded w-24" />
      <div className="h-2 bg-muted rounded w-full mt-1" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  );
}

export default function WhatsAppCampaignsList() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useWhatsappCampaigns(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  const { data: status } = useWhatsappStatus();

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? 0;

  const stats = {
    total,
    inProgress: campaigns.filter((c) => c.status === "in_progress").length,
    completed: campaigns.filter((c) => c.status === "completed").length,
    sent: campaigns.reduce((acc, c) => acc + c.sentMessages, 0),
  };

  const STAT_CARDS = [
    {
      label: "Total",
      value: stats.total,
      icon: BarChart2,
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Em andamento",
      value: stats.inProgress,
      icon: Send,
      iconBg: "bg-yellow-50 dark:bg-yellow-950/40",
      iconColor: "text-yellow-600 dark:text-yellow-400",
    },
    {
      label: "Concluídas",
      value: stats.completed,
      icon: CheckCircle,
      iconBg: "bg-green-50 dark:bg-green-950/40",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      label: "Msgs enviadas",
      value: stats.sent.toLocaleString("pt-BR"),
      icon: MessageCircle,
      iconBg: "bg-purple-50 dark:bg-purple-950/40",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
      <div className="space-y-5 pb-10">

        {/* Header */}
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={MessageCircle}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Campanhas WhatsApp</PageHeader.Title>
              <PageHeader.Description>Gerencie seus disparos em massa</PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            <Button onClick={() => navigate("/whatsapp/campanhas/criar")} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova campanha</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </PageHeader.Actions>
        </PageHeader>

        <WhatsappOptOutInfoBanner />

        {/* Not configured alert */}
        {status && !status.configured && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-xl">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                WhatsApp não configurado
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Configure as credenciais da API antes de disparar campanhas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40"
              onClick={() => navigate("/whatsapp/configuracoes")}
            >
              Configurar
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <Card key={label} className="overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
                  <Icon className={cn("h-5 w-5", iconColor)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium leading-none">{label}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{isLoading ? "—" : value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaigns table / list */}
        <Card className="overflow-hidden">
          {/* Card header with filter */}
          <CardHeader className="border-b border-border py-3 px-4 sm:px-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                {statusFilter === "all" ? "Todas as campanhas" : STATUS_CONFIG[statusFilter as WhatsappCampaign["status"]]?.label ?? "Campanhas"}
                {!isLoading && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({campaigns.length})
                  </span>
                )}
              </CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="created">Agendadas</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="paused">Pausadas</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          {/* Mobile: card list — hidden on md+ */}
          <div className="md:hidden">
            {isLoading && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            {!isLoading && campaigns.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-14 text-center px-4">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha encontrada</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {statusFilter !== "all" ? "Tente outro filtro ou" : "Crie sua primeira campanha"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/whatsapp/campanhas/criar")}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar campanha
                </Button>
              </div>
            )}
            {!isLoading && campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => navigate(`/whatsapp/campanhas/${campaign.id}`)}
              />
            ))}
          </div>

          {/* Desktop: table — hidden on mobile */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 sm:pl-6 font-semibold">Campanha</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Contatos</TableHead>
                  <TableHead className="font-semibold">Enviadas / Falhas</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold w-44">Progresso</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold">Data</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}

                {!isLoading && campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                          <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha encontrada</p>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {statusFilter !== "all" ? "Tente outro filtro ou crie uma nova campanha" : "Crie sua primeira campanha para começar"}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate("/whatsapp/campanhas/criar")}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar campanha
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && campaigns.map((campaign) => {
                  const cfg = STATUS_CONFIG[campaign.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow
                      key={campaign.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/whatsapp/campanhas/${campaign.id}`)}
                    >
                      <TableCell className="pl-4 sm:pl-6">
                        <p className="font-semibold text-sm">{campaign.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 lg:hidden">
                          {formatDate(campaign.startDate)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(cfg.className, "border-0 gap-1 text-xs")}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm text-muted-foreground">
                        {campaign.totalContacts}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <span className="text-green-600 dark:text-green-400 font-medium">{campaign.sentMessages}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className={cn("font-medium", campaign.failedMessages > 0 ? "text-red-500" : "text-muted-foreground")}>
                            {campaign.failedMessages}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell w-44">
                        <ProgressBar sent={campaign.sentMessages} total={campaign.totalContacts} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm tabular-nums">
                        {formatDate(campaign.startDate)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Loading indicator when refetching */}
          {isLoading && (
            <div className="hidden md:flex items-center justify-center py-2 border-t border-border gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
