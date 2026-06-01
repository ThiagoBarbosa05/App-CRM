import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Send, Clock, CheckCircle, XCircle, AlertCircle, BarChart2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useWhatsappCampaigns, useWhatsappStatus, type WhatsappCampaign } from "@/hooks/use-whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG: Record<
  WhatsappCampaign["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  created: { label: "Criada", icon: Clock, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  in_progress: { label: "Em andamento", icon: Send, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  completed: { label: "Concluída", icon: CheckCircle, className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  failed: { label: "Falhou", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  cancelled: { label: "Cancelada", icon: AlertCircle, className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campanhas WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus disparos em massa</p>
          </div>
        </div>
        <Button onClick={() => navigate("/whatsapp/campanhas/criar")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Not configured alert */}
      {status && !status.configured && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              WhatsApp não configurado
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Configure as credenciais da API antes de disparar campanhas.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => navigate("/whatsapp/configuracoes")}
          >
            Configurar
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: BarChart2, color: "text-blue-600" },
          { label: "Em andamento", value: stats.inProgress, icon: Send, color: "text-yellow-600" },
          { label: "Concluídas", value: stats.completed, icon: CheckCircle, color: "text-green-600" },
          { label: "Mensagens enviadas", value: stats.sent, icon: MessageCircle, color: "text-purple-600" },
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

      {/* Filter + Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Campanhas</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="created">Criadas</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Contatos</TableHead>
                <TableHead className="hidden md:table-cell">Enviadas / Falhas</TableHead>
                <TableHead className="hidden lg:table-cell">Progresso</TableHead>
                <TableHead className="hidden lg:table-cell">Data</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {!isLoading && campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <MessageCircle className="h-7 w-7 text-slate-400" />
                      </div>
                      <p className="text-muted-foreground">Nenhuma campanha encontrada</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/whatsapp/campanhas/criar")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar primeira campanha
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
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/whatsapp/campanhas/${campaign.id}`)}
                  >
                    <TableCell className="font-medium">{campaign.title}</TableCell>
                    <TableCell>
                      <Badge className={`${cfg.className} border-0 gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {campaign.totalContacts}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-green-600 font-medium">{campaign.sentMessages}</span>
                      {" / "}
                      <span className="text-red-500">{campaign.failedMessages}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell w-40">
                      <ProgressBar sent={campaign.sentMessages} total={campaign.totalContacts} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {formatDate(campaign.startDate)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/whatsapp/campanhas/${campaign.id}`);
                        }}
                      >
                        Ver detalhes
                      </Button>
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
