import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Send, CheckCircle, XCircle, Clock, RotateCcw, MessageCircle, Users, AlertCircle } from "lucide-react";
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
  type WhatsappCampaignMessage,
} from "@/hooks/use-whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MSG_STATUS_CONFIG: Record<
  WhatsappCampaignMessage["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  scheduled: { label: "Agendado", icon: Clock, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  sent: { label: "Enviado", icon: CheckCircle, className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
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

  const stats = statsData?.stats;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 py-20">
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

  const pct =
    campaign.totalContacts > 0
      ? Math.round((campaign.sentMessages / campaign.totalContacts) * 100)
      : 0;

  const pendingMessages = campaign.messages?.filter((m) => m.status === "scheduled").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/whatsapp/campanhas")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{campaign.title}</h1>
          <p className="text-sm text-muted-foreground">
            Iniciada em {formatDate(campaign.startDate)}
          </p>
        </div>
        {pendingMessages > 0 && (
          <Button
            variant="outline"
            className="gap-2"
            disabled={executeMutation.isPending}
            onClick={() => id && executeMutation.mutate(id)}
          >
            <RotateCcw className={`h-4 w-4 ${executeMutation.isPending ? "animate-spin" : ""}`} />
            Re-executar pendentes ({pendingMessages})
          </Button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total de contatos",
            value: campaign.totalContacts,
            icon: Users,
            color: "text-blue-600",
          },
          {
            label: "Enviadas",
            value: stats?.sent ?? campaign.sentMessages,
            icon: Send,
            color: "text-green-600",
          },
          {
            label: "Falhas",
            value: stats?.failed ?? campaign.failedMessages,
            icon: XCircle,
            color: "text-red-500",
          },
          {
            label: "Progresso",
            value: `${pct}%`,
            icon: CheckCircle,
            color: "text-purple-600",
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
  );
}
