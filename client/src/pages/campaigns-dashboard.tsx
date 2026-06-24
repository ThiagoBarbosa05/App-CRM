import { useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  MessageSquare,
  Eye,
  Plus,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCampaigns } from "@/hooks/use-campaigns";
import { cn } from "@/lib/utils";

const statusConfig = {
  created:     { label: "Criada",       color: "bg-blue-500",  icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-yellow-500", icon: Send },
  completed:   { label: "Concluída",    color: "bg-green-500", icon: CheckCircle2 },
  failed:      { label: "Falhou",       color: "bg-red-500",   icon: XCircle },
  cancelled:   { label: "Cancelada",    color: "bg-gray-500",  icon: XCircle },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status as keyof typeof statusConfig];
  if (!config) return null;
  return (
    <Badge variant="outline" className="gap-1 whitespace-nowrap">
      <div className={`w-2 h-2 rounded-full shrink-0 ${config.color}`} />
      {config.label}
    </Badge>
  );
}

function getProgress(campaign: any) {
  if (campaign.totalContacts === 0) return 0;
  const sent = campaign.sentMessages + campaign.failedMessages;
  return (sent / campaign.totalContacts) * 100;
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

// Mobile card for each campaign
function CampaignMobileCard({
  campaign,
  onView,
}: {
  campaign: any;
  onView: () => void;
}) {
  const pct = Math.round(getProgress(campaign));
  return (
    <button
      type="button"
      onClick={onView}
      className="w-full text-left p-4 border-b border-border last:border-0 hover:bg-muted/40 active:bg-muted/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-semibold truncate">{campaign.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge(campaign.status)}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {campaign.totalContacts}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{campaign.sentMessages} enviadas</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
            {campaign.failedMessages > 0 && (
              <p className="text-xs text-red-500">{campaign.failedMessages} falha(s)</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(campaign.startDate)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-12 px-4">
      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">Nenhuma campanha encontrada</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Comece criando sua primeira campanha de marketing
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-2" />
        Criar Campanha
      </Button>
    </div>
  );
}

export default function CampaignsDashboardPage() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data, isLoading } = useCampaigns({ status: statusFilter });
  const campaigns = data?.campaigns || [];

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "in_progress").length;
  const completedCampaigns = campaigns.filter((c) => c.status === "completed").length;
  const totalMessagesSent = campaigns.reduce((sum, c) => sum + c.sentMessages, 0);

  return (
    <div className="px-3 sm:px-4 lg:container lg:mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard de Campanhas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Monitore e gerencie suas campanhas de marketing
          </p>
        </div>
        <Button
          onClick={() => setLocation("/umbler/campaigns/create")}
          className="gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Total de Campanhas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalCampaigns}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Todas as campanhas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Em Andamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Campanhas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{completedCampaigns}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Campanhas finalizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Msgs Enviadas</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalMessagesSent}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Total de mensagens</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table / Cards */}
      <Card className="overflow-hidden">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>Lista de todas as campanhas criadas</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          <Tabs
            defaultValue="all"
            onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}
          >
            <div className="px-4 sm:px-0 pb-3 sm:pb-4 overflow-x-auto">
              <TabsList className="w-max sm:w-auto">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
                <TabsTrigger value="completed">Concluídas</TabsTrigger>
                <TabsTrigger value="failed">Falhas</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={statusFilter || "all"} className="mt-0">
              {isLoading ? (
                <div className="space-y-3 px-4 sm:px-0">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 sm:h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <EmptyState onCreateClick={() => setLocation("/umbler/campaigns/create")} />
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y divide-border border-t border-border">
                    {campaigns.map((campaign) => (
                      <CampaignMobileCard
                        key={campaign.id}
                        campaign={campaign}
                        onView={() => setLocation(`/umbler/campaigns/${campaign.id}`)}
                      />
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Contatos</TableHead>
                          <TableHead className="hidden lg:table-cell">Progresso</TableHead>
                          <TableHead className="hidden lg:table-cell">Data de Início</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.title}</TableCell>
                            <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {campaign.totalContacts}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="space-y-1 w-40">
                                <div className="flex items-center justify-between text-xs">
                                  <span>{campaign.sentMessages} enviadas</span>
                                  <span>{Math.round(getProgress(campaign))}%</span>
                                </div>
                                <Progress value={getProgress(campaign)} className="h-2" />
                                {campaign.failedMessages > 0 && (
                                  <p className="text-xs text-red-500">{campaign.failedMessages} falhas</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {formatDate(campaign.startDate)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocation(`/umbler/campaigns/${campaign.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
