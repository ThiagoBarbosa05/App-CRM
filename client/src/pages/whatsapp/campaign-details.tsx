import { useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  CheckCheck,
  Eye,
  XCircle,
  Clock,
  RotateCcw,
  MessageCircle,
  Users,
  AlertCircle,
  Search,
  User,
  PlayCircle,
  Flag,
  Bot,
  FileText,
  Calendar,
  UserCircle2,
  Radio,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  useWhatsappCampaignDetails,
  useWhatsappCampaignStats,
  useWhatsappCampaignBotStats,
  useExecuteCampaign,
  useRetryFailedCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
  type WhatsappCampaign,
  type WhatsappCampaignMessage,
} from "@/hooks/use-whatsapp";
import { Pause, Play, Ban } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CAMPAIGN_STATUS_CONFIG: Record<
  WhatsappCampaign["status"],
  { label: string; className: string }
> = {
  created: { label: "Agendada", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  in_progress: { label: "Em andamento", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  paused: { label: "Pausada", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  completed: { label: "Concluída", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  cancelled: { label: "Cancelada", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

const MSG_STATUS_CONFIG: Record<
  WhatsappCampaignMessage["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  scheduled: { label: "Na fila", icon: Clock, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  sent: { label: "Enviado", icon: CheckCircle, className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  delivered: { label: "Entregue", icon: CheckCheck, className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  read: { label: "Lido", icon: Eye, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  failed: { label: "Falhou", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  cancelled: { label: "Cancelado", icon: AlertCircle, className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

const STATUS_FILTER_OPTIONS: { value: WhatsappCampaignMessage["status"] | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "scheduled", label: "Na fila" },
  { value: "sent", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "read", label: "Lido" },
  { value: "failed", label: "Falhou" },
  { value: "cancelled", label: "Cancelado" },
];

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function getInitials(name: string, phone: string) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("");
  }
  return phone.slice(-2);
}

function ContactAvatar({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white shadow-sm">
      {getInitials(name, phone)}
    </div>
  );
}

// Linha compacta ícone + label + badge de contagem, usada nos blocos
// "Dos agendamentos" / "Dos bots" / "Motivos de finalização".
function StatRow({
  icon: Icon,
  label,
  value,
  badgeClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  badgeClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border border-border rounded-xl bg-muted/20">
      <span className="flex items-center gap-2.5 text-sm text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        {label}
      </span>
      <Badge className={badgeClassName ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-0"}>
        {value}
      </Badge>
    </div>
  );
}

function StatBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

export default function WhatsAppCampaignDetails() {
  const [, params] = useRoute("/whatsapp/campanhas/:id");
  const [, navigate] = useLocation();
  const id = params?.id;

  const { data: campaign, isLoading } = useWhatsappCampaignDetails(id);
  const { data: statsData } = useWhatsappCampaignStats(id);
  const { data: botStatsData } = useWhatsappCampaignBotStats(id);
  const executeMutation = useExecuteCampaign();
  const retryMutation = useRetryFailedCampaign();
  const pauseMutation = usePauseCampaign();
  const resumeMutation = useResumeCampaign();
  const cancelMutation = useCancelCampaign();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WhatsappCampaignMessage["status"] | "all">("all");

  const stats = statsData?.stats;
  const botStats = botStatsData?.stats;

  const filteredMessages = useMemo(() => {
    const messages = campaign?.messages ?? [];
    const term = search.trim().toLowerCase();
    return messages.filter((msg) => {
      if (statusFilter !== "all" && msg.status !== statusFilter) return false;
      if (!term) return true;
      return (
        msg.contactName.toLowerCase().includes(term) ||
        msg.phoneNumber.toLowerCase().includes(term)
      );
    });
  }, [campaign?.messages, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
          <MessageCircle className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-muted-foreground">Campanha não encontrada</p>
        <Button variant="outline" onClick={() => navigate("/whatsapp/campanhas")}>
          Voltar para campanhas
        </Button>
      </div>
    );
  }

  // Funil cumulativo: lido ⊂ entregue ⊂ enviado.
  const readCount = stats?.read ?? 0;
  const deliveredCount = (stats?.delivered ?? 0) + readCount;
  const sentCount = (stats?.sent ?? 0) + deliveredCount;
  const failedCount = stats?.failed ?? campaign.failedMessages;
  const cancelledCount = stats?.cancelled ?? 0;
  const processed = sentCount + failedCount;

  const pct =
    campaign.totalContacts > 0
      ? Math.round((processed / campaign.totalContacts) * 100)
      : 0;

  const pendingMessages =
    stats?.pending ??
    (campaign.messages?.filter((m) => m.status === "scheduled").length ?? 0);

  const totalMessages = stats?.total ?? campaign.messages?.length ?? 0;
  const executedCount = Math.max(totalMessages - pendingMessages - cancelledCount, 0);

  return (
    <div className="overflow-y-auto h-full p-3 sm:p-5 lg:p-6">
    <div className="space-y-4 sm:space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/whatsapp/campanhas")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader.Icon
            icon={MessageCircle}
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>{campaign.title}</PageHeader.Title>
            <PageHeader.Description>
              <span className="inline-flex items-center gap-2">
                <Badge className={`${CAMPAIGN_STATUS_CONFIG[campaign.status].className} border-0`}>
                  {CAMPAIGN_STATUS_CONFIG[campaign.status].label}
                </Badge>
                {campaign.status === "created"
                  ? `Agendada para ${formatDate(campaign.startDate)}`
                  : `Iniciada em ${formatDate(campaign.startDate)}`}
              </span>
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          {pendingMessages > 0 && campaign.status === "in_progress" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={executeMutation.isPending}
              onClick={() => id && executeMutation.mutate(id)}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${executeMutation.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Processar agora</span>
              <span>({pendingMessages})</span>
            </Button>
          )}
          {failedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={retryMutation.isPending}
              onClick={() => id && retryMutation.mutate(id)}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${retryMutation.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Reprocessar</span>
              <span>({failedCount})</span>
            </Button>
          )}
          {(campaign.status === "in_progress" || campaign.status === "created") && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pauseMutation.isPending}
              onClick={() => id && pauseMutation.mutate(id)}
            >
              <Pause className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pausar</span>
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={resumeMutation.isPending}
              onClick={() => id && resumeMutation.mutate(id)}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Retomar</span>
            </Button>
          )}
          {["in_progress", "created", "paused"].includes(campaign.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cancelar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar campanha</AlertDialogTitle>
                  <AlertDialogDescription>
                    As mensagens ainda na fila não serão enviadas. As já enviadas
                    não são afetadas. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => id && cancelMutation.mutate(id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancelar campanha
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </PageHeader.Actions>
      </PageHeader>

      {/* Detalhes do envio */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detalhes do envio</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Título</span>
            <span className="ml-auto font-medium text-right truncate">{campaign.title}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Canal</span>
            <span className="ml-auto font-medium">WhatsApp Business</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Iniciado em</span>
            <span className="ml-auto font-medium">{formatDate(campaign.startDate)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Iniciado por</span>
            <span className="ml-auto font-medium">{campaign.createdByName ?? "—"}</span>
          </div>
          {campaign.botName && (
            <div className="flex items-center gap-2.5 sm:col-span-2 pt-1 border-t border-border mt-1">
              <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">ChatBot enviado</span>
              <span className="ml-auto font-medium">{campaign.botName} → Início</span>
            </div>
          )}
          {!campaign.botName && campaign.templateName && (
            <div className="flex items-center gap-2.5 sm:col-span-2 pt-1 border-t border-border mt-1">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Template enviado</span>
              <span className="ml-auto font-medium font-mono">{campaign.templateName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dos agendamentos / Dos bots / Motivos de finalização */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatBlock title="Dos agendamentos">
          <StatRow
            icon={CheckCircle}
            label="Executado"
            value={executedCount}
            badgeClassName="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0"
          />
          <StatRow
            icon={AlertCircle}
            label="Cancelado"
            value={cancelledCount}
            badgeClassName="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0"
          />
        </StatBlock>

        {botStats && (
          <StatBlock title="Dos bots">
            <StatRow
              icon={PlayCircle}
              label="Em execução"
              value={botStats.active}
              badgeClassName="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0"
            />
            <StatRow
              icon={Flag}
              label="Finalizado"
              value={botStats.finished}
              badgeClassName="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0"
            />
          </StatBlock>
        )}

        {botStats && botStats.reasons.length > 0 && (
          <StatBlock title="Motivos de finalização dos bots">
            {botStats.reasons.map((r) => (
              <StatRow key={r.reason} icon={Flag} label={r.label} value={r.count} />
            ))}
          </StatBlock>
        )}
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Progresso geral</span>
            <span className="text-sm font-semibold text-foreground">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {campaign.completedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Concluída em {formatDate(campaign.completedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Funil de entrega */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "Total de contatos", value: campaign.totalContacts, icon: Users, color: "text-blue-600" },
          { label: "Enviadas", value: sentCount, icon: Send, color: "text-green-600" },
          { label: "Entregues", value: deliveredCount, icon: CheckCheck, color: "text-teal-600" },
          { label: "Lidas", value: readCount, icon: Eye, color: "text-emerald-600" },
          { label: "Falhas", value: failedCount, icon: XCircle, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de envios */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="text-base">
            Lista de envios {(campaign.messages ?? []).length > 0 && `(${campaign.messages.length})`}
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou telefone"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
              <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {(campaign.messages ?? []).length === 0
                  ? "Nenhuma mensagem registrada"
                  : "Nenhum envio corresponde à busca"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden divide-y divide-border border-t border-border">
                {filteredMessages.map((msg) => {
                  const cfg = MSG_STATUS_CONFIG[msg.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={msg.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <ContactAvatar name={msg.contactName} phone={msg.phoneNumber} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{msg.contactName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{msg.phoneNumber}</p>
                          </div>
                        </div>
                        <Badge className={`${cfg.className} border-0 gap-1 shrink-0`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {msg.scheduledAt && <span>Agendado: {formatDate(msg.scheduledAt)}</span>}
                        {msg.sentAt && <span>Enviado: {formatDate(msg.sentAt)}</span>}
                      </div>
                      {msg.errorMessage && (
                        <p className="text-xs text-red-500 break-words whitespace-pre-wrap">{msg.errorMessage}</p>
                      )}
                      <div className="flex items-center gap-1.5 pt-1">
                        {msg.contactId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => navigate(`/clientes/${msg.contactId}`)}
                          >
                            <User className="h-3 w-3" /> Perfil
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => navigate(`/whatsapp/conversas?phone=${encodeURIComponent(msg.phoneNumber)}`)}
                        >
                          <MessageCircle className="h-3 w-3" /> Conversa
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agendado em</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="hidden lg:table-cell">Erro</TableHead>
                      <TableHead className="text-right pr-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.map((msg) => {
                      const cfg = MSG_STATUS_CONFIG[msg.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={msg.id}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2.5">
                              <ContactAvatar name={msg.contactName} phone={msg.phoneNumber} />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{msg.contactName}</p>
                                <p className="text-xs text-muted-foreground">{msg.phoneNumber}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${cfg.className} border-0 gap-1`}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(msg.scheduledAt)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(msg.sentAt)}</TableCell>
                          <TableCell className="hidden lg:table-cell text-red-500 text-sm max-w-xs whitespace-pre-wrap break-words">
                            {msg.errorMessage ?? "—"}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1">
                              {msg.contactId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Ver perfil do cliente"
                                  onClick={() => navigate(`/clientes/${msg.contactId}`)}
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Abrir conversa"
                                onClick={() => navigate(`/whatsapp/conversas?phone=${encodeURIComponent(msg.phoneNumber)}`)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
