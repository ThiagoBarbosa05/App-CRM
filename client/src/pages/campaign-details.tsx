import { useLocation, useRoute } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Send,
  Calendar,
  Bot,
  MessageSquare,
  Phone,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCampaignDetails } from "@/hooks/use-campaign-details";
import { cn } from "@/lib/utils";

const statusConfig = {
  created:     { label: "Criada",       color: "bg-blue-500",  icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-yellow-500", icon: Send },
  completed:   { label: "Concluída",    color: "bg-green-500", icon: CheckCircle2 },
  failed:      { label: "Falhou",       color: "bg-red-500",   icon: XCircle },
  cancelled:   { label: "Cancelada",    color: "bg-gray-500",  icon: XCircle },
};

const messageStatusConfig = {
  scheduled: { label: "Agendada",  color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300",   icon: Clock },
  sent:      { label: "Enviada",   color: "text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-300", icon: CheckCircle2 },
  failed:    { label: "Falhou",    color: "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300",        icon: XCircle },
  cancelled: { label: "Cancelada", color: "text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400",       icon: XCircle },
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

// Mobile card for each message
function MessageMobileCard({ message }: { message: any }) {
  const statusInfo = messageStatusConfig[message.status as keyof typeof messageStatusConfig];
  const StatusIcon = statusInfo?.icon ?? Clock;
  return (
    <div className="p-4 border-b border-border last:border-0 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{message.contactName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Phone className="h-3 w-3 shrink-0" />
            {message.phoneNumber}
          </p>
        </div>
        {statusInfo && (
          <Badge variant="outline" className={cn("shrink-0", statusInfo.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          {formatDate(message.scheduledAt)}
        </span>
        {message.sentAt && (
          <span className="flex items-center gap-1">
            <Send className="h-3 w-3 shrink-0" />
            {formatDate(message.sentAt)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CampaignDetailsPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/umbler/campaigns/:id");

  const { data: campaign, isLoading } = useCampaignDetails(params?.id);

  if (isLoading) {
    return (
      <div className="px-3 sm:px-4 lg:container lg:mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-12 text-center px-4">
        <h2 className="text-2xl font-bold mb-4">Campanha não encontrada</h2>
        <Button onClick={() => setLocation("/umbler/campaigns")}>
          Voltar para Campanhas
        </Button>
      </div>
    );
  }

  const progress =
    campaign.totalContacts > 0
      ? ((campaign.sentMessages + campaign.failedMessages) / campaign.totalContacts) * 100
      : 0;

  const statusInfo = statusConfig[campaign.status as keyof typeof statusConfig];

  return (
    <div className="px-3 sm:px-4 lg:container lg:mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mt-0.5"
          onClick={() => setLocation("/umbler/campaigns")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-3xl font-bold truncate">{campaign.title}</h1>
            {statusInfo && (
              <Badge variant="outline" className="gap-1 shrink-0">
                <div className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
                {statusInfo.label}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Criada em {format(new Date(campaign.createdAt), "PPp", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Total de Contatos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{campaign.totalContacts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Enviadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{campaign.sentMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{campaign.failedMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Progresso</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{Math.round(progress)}%</div>
            <Progress value={progress} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Campaign Info */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Informações da Campanha</CardTitle>
          <CardDescription>Detalhes e configurações</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Início
              </p>
              <p className="font-medium text-sm">
                {format(new Date(campaign.startDate), "PPp", { locale: ptBR })}
              </p>
            </div>

            {campaign.endDate && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Término
                </p>
                <p className="font-medium text-sm">
                  {format(new Date(campaign.endDate), "PPp", { locale: ptBR })}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Bot
              </p>
              <p className="font-medium text-sm">{campaign.botTriggerName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone
              </p>
              <p className="font-medium text-sm">{campaign.fromPhone}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo
              </p>
              <p className="font-medium text-sm">{campaign.intervalSeconds} segundos</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Filtro Exclusivo
              </p>
              <p className="font-medium text-sm">{campaign.exclusiveTagFilter ? "Sim" : "Não"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="overflow-hidden">
        <CardHeader className="px-4 sm:px-6 pb-3">
          <CardTitle>Mensagens ({campaign.messages.length})</CardTitle>
          <CardDescription>Status de cada mensagem enviada</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {campaign.messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden">
                {campaign.messages.map((message: any) => (
                  <MessageMobileCard key={message.id} message={message} />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border-t border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agendado Para</TableHead>
                      <TableHead>Enviado Em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.messages.map((message: any) => {
                      const statusInfo = messageStatusConfig[message.status as keyof typeof messageStatusConfig];
                      const StatusIcon = statusInfo?.icon ?? Clock;
                      return (
                        <TableRow key={message.id}>
                          <TableCell className="font-medium pl-6">{message.contactName}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{message.phoneNumber}</TableCell>
                          <TableCell>
                            {statusInfo && (
                              <Badge variant="outline" className={statusInfo.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(message.scheduledAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(message.sentAt)}
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
  );
}
