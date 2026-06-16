import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Send, CheckCircle, CheckCheck, Eye, XCircle, Clock, RotateCcw, MessageCircle, Users, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

export default function WhatsAppCampaignDetails() {
  const [, params] = useRoute("/whatsapp/campanhas/:id");
  const [, navigate] = useLocation();
  const id = params?.id;

  const { data: campaign, isLoading } = useWhatsappCampaignDetails(id);
  const { data: statsData } = useWhatsappCampaignStats(id);
  const executeMutation = useExecuteCampaign();
  const retryMutation = useRetryFailedCampaign();
  const pauseMutation = usePauseCampaign();
  const resumeMutation = useResumeCampaign();
  const cancelMutation = useCancelCampaign();

  const stats = statsData?.stats;

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
  const processed = sentCount + failedCount;

  const pct =
    campaign.totalContacts > 0
      ? Math.round((processed / campaign.totalContacts) * 100)
      : 0;

  const pendingMessages =
    stats?.pending ??
    (campaign.messages?.filter((m) => m.status === "scheduled").length ?? 0);

  return (
    <div className="overflow-y-auto h-full p-5 lg:p-6">
    <div className="space-y-6 pb-10">
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
              className="gap-2"
              disabled={executeMutation.isPending}
              onClick={() => id && executeMutation.mutate(id)}
            >
              <RotateCcw className={`h-4 w-4 ${executeMutation.isPending ? "animate-spin" : ""}`} />
              Processar agora ({pendingMessages})
            </Button>
          )}
          {failedCount > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={retryMutation.isPending}
              onClick={() => id && retryMutation.mutate(id)}
            >
              <RotateCcw className={`h-4 w-4 ${retryMutation.isPending ? "animate-spin" : ""}`} />
              Reprocessar falhas ({failedCount})
            </Button>
          )}
          {(campaign.status === "in_progress" || campaign.status === "created") && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={pauseMutation.isPending}
              onClick={() => id && pauseMutation.mutate(id)}
            >
              <Pause className="h-4 w-4" />
              Pausar
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={resumeMutation.isPending}
              onClick={() => id && resumeMutation.mutate(id)}
            >
              <Play className="h-4 w-4" />
              Retomar
            </Button>
          )}
          {["in_progress", "created", "paused"].includes(campaign.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                  <Ban className="h-4 w-4" />
                  Cancelar
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

      {/* Stats cards — funil de entrega */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total de contatos",
            value: campaign.totalContacts,
            icon: Users,
            color: "text-blue-600",
          },
          {
            label: "Enviadas",
            value: sentCount,
            icon: Send,
            color: "text-green-600",
          },
          {
            label: "Entregues",
            value: deliveredCount,
            icon: CheckCheck,
            color: "text-teal-600",
          },
          {
            label: "Lidas",
            value: readCount,
            icon: Eye,
            color: "text-emerald-600",
          },
          {
            label: "Falhas",
            value: failedCount,
            icon: XCircle,
            color: "text-red-500",
          },
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

      {/* Messages table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mensagens</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Agendado em</TableHead>
                <TableHead className="hidden md:table-cell">Enviado em</TableHead>
                <TableHead className="hidden lg:table-cell">Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(campaign.messages ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma mensagem registrada
                  </TableCell>
                </TableRow>
              )}
              {(campaign.messages ?? []).map((msg) => {
                const cfg = MSG_STATUS_CONFIG[msg.status];
                const StatusIcon = cfg.icon;
                return (
                  <TableRow key={msg.id}>
                    <TableCell className="font-medium">{msg.contactName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{msg.phoneNumber}</TableCell>
                    <TableCell>
                      <Badge className={`${cfg.className} border-0 gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {formatDate(msg.scheduledAt)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {formatDate(msg.sentAt)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-red-500 text-sm max-w-xs truncate">
                      {msg.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
