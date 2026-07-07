import { useLocation } from "wouter";
import { Plus, ExternalLink, MessageCircle, AlertCircle, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useWhatsappCampaigns, useWhatsappStatus, type WhatsappCampaign } from "@/hooks/use-whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<WhatsappCampaign["status"], string> = {
  created: "Agendada",
  in_progress: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const STATUS_CLASS: Record<WhatsappCampaign["status"], string> = {
  created: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function MarketingWhatsappTab() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useWhatsappCampaigns({ limit: 5 });
  const { data: status } = useWhatsappStatus();

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Campanhas de disparo em massa via WhatsApp (bots e templates).
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/whatsapp/campanhas")} className="gap-2">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir hub completo
          </Button>
          <Button size="sm" onClick={() => navigate("/whatsapp/campanhas/criar")} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Nova campanha
          </Button>
        </div>
      </div>

      {status && !status.configured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">WhatsApp não configurado</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Configure as credenciais da API antes de disparar campanhas.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
            onClick={() => navigate("/whatsapp/configuracoes")}
          >
            Configurar
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && campaigns.length === 0 && (
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha de WhatsApp ainda</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/whatsapp/campanhas/criar")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar campanha
            </Button>
          </CardContent>
        )}

        {!isLoading &&
          campaigns.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => navigate(`/whatsapp/campanhas/${campaign.id}`)}
              className="w-full text-left p-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold truncate">{campaign.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn(STATUS_CLASS[campaign.status], "border-0 text-xs")}>
                    {STATUS_LABEL[campaign.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Send className="h-3 w-3" /> {campaign.sentMessages}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(campaign.startDate), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
      </Card>
    </div>
  );
}
