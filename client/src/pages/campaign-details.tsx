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
import { Separator } from "@/components/ui/separator";
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

const statusConfig = {
  created: { label: "Criada", color: "bg-blue-500", icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-yellow-500", icon: Send },
  completed: { label: "Concluída", color: "bg-green-500", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-red-500", icon: XCircle },
  cancelled: { label: "Cancelada", color: "bg-gray-500", icon: XCircle },
};

const messageStatusConfig = {
  scheduled: {
    label: "Agendada",
    color: "text-blue-600 bg-blue-50",
    icon: Clock,
  },
  sent: {
    label: "Enviada",
    color: "text-green-600 bg-green-50",
    icon: CheckCircle2,
  },
  failed: { label: "Falhou", color: "text-red-600 bg-red-50", icon: XCircle },
  cancelled: {
    label: "Cancelada",
    color: "text-gray-600 bg-gray-50",
    icon: XCircle,
  },
};

export default function CampaignDetailsPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/umbler/campaigns/:id");

  const { data: campaign, isLoading } = useCampaignDetails(params?.id);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Campanha não encontrada</h2>
        <Button onClick={() => setLocation("/umbler/campaigns")}>
          Voltar para Campanhas
        </Button>
      </div>
    );
  }

  const progress =
    campaign.totalContacts > 0
      ? ((campaign.sentMessages + campaign.failedMessages) /
          campaign.totalContacts) *
        100
      : 0;

  const statusInfo = statusConfig[campaign.status];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/umbler/campaigns")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{campaign.title}</h1>
            <Badge variant="outline" className="gap-1">
              <div className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
              {statusInfo.label}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Criada em{" "}
            {format(new Date(campaign.createdAt), "PPp", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Contatos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.totalContacts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mensagens Enviadas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {campaign.sentMessages}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {campaign.failedMessages}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progresso</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(progress)}%</div>
            <Progress value={progress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Campanha</CardTitle>
          <CardDescription>Detalhes e configurações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Início
              </p>
              <p className="font-medium">
                {format(new Date(campaign.startDate), "PPp", { locale: ptBR })}
              </p>
            </div>

            {campaign.endDate && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Término
                </p>
                <p className="font-medium">
                  {format(new Date(campaign.endDate), "PPp", { locale: ptBR })}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Bot
              </p>
              <p className="font-medium">{campaign.botTriggerName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone
              </p>
              <p className="font-medium">{campaign.fromPhone}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo
              </p>
              <p className="font-medium">{campaign.intervalSeconds} segundos</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Filtro Exclusivo
              </p>
              <p className="font-medium">
                {campaign.exclusiveTagFilter ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens ({campaign.messages.length})</CardTitle>
          <CardDescription>Status de cada mensagem enviada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agendado Para</TableHead>
                  <TableHead>Enviado Em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.messages.map((message) => {
                  const statusInfo = messageStatusConfig[message.status];
                  return (
                    <TableRow key={message.id}>
                      <TableCell className="font-medium">
                        {message.contactName}
                      </TableCell>
                      <TableCell>{message.phoneNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(message.scheduledAt),
                          "dd/MM/yyyy HH:mm",
                          {
                            locale: ptBR,
                          }
                        )}
                      </TableCell>
                      <TableCell>
                        {message.sentAt
                          ? format(
                              new Date(message.sentAt),
                              "dd/MM/yyyy HH:mm",
                              {
                                locale: ptBR,
                              }
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
