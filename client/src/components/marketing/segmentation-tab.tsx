import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trophy,
  Sparkles,
  Wine,
  CalendarHeart,
  Globe,
  ArrowRight,
  Users,
  Megaphone,
  Mail,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SegmentWithCount {
  id: string;
  label: string;
  description: string;
  filters: Record<string, string | boolean>;
  count: number;
}

interface SegmentGroupWithCounts {
  id: string;
  title: string;
  description: string;
  segments: SegmentWithCount[];
}

interface SegmentsOverview {
  total: number;
  groups: SegmentGroupWithCounts[];
}

export interface SegmentCampaignPayload {
  segmentLabel: string;
  filters: Record<string, string | boolean>;
  channel: "email" | "sms" | "whatsapp";
}

interface Props {
  onCreateCampaign?: (payload: SegmentCampaignPayload) => void;
}

const GROUP_STYLE: Record<
  string,
  { icon: React.ElementType; iconBg: string; iconColor: string; accent: string }
> = {
  rfm: {
    icon: Trophy,
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400",
  },
  lifecycle: {
    icon: Sparkles,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400",
  },
  product: {
    icon: Wine,
    iconBg: "bg-rose-50 dark:bg-rose-950/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    accent: "text-rose-600 dark:text-rose-400",
  },
  events: {
    icon: CalendarHeart,
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    accent: "text-violet-600 dark:text-violet-400",
  },
  wine_profile: {
    icon: Globe,
    iconBg: "bg-teal-50 dark:bg-teal-950/40",
    iconColor: "text-teal-600 dark:text-teal-400",
    accent: "text-teal-600 dark:text-teal-400",
  },
};


/** Monta a URL de deep-link para a lista de clientes já filtrada. */
function buildClientsUrl(filters: Record<string, string | boolean>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/clientes?${query}` : "/clientes";
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

const CHANNEL_OPTIONS: {
  id: "email" | "sms" | "whatsapp";
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    id: "email",
    label: "Email",
    icon: Mail,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "sms",
    label: "SMS",
    icon: MessageSquare,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/60",
    border: "border-violet-200 dark:border-violet-800",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/60",
    border: "border-green-200 dark:border-green-800",
  },
];

export function MarketingSegmentationTab({ onCreateCampaign }: Props) {
  const { data, isLoading, isError } = useQuery<SegmentsOverview>({
    queryKey: ["/api/segments/overview"],
  });

  const [channelDialogSegment, setChannelDialogSegment] =
    useState<SegmentWithCount | null>(null);

  function handleChannelSelect(channel: "email" | "sms" | "whatsapp") {
    if (!channelDialogSegment || !onCreateCampaign) return;
    onCreateCampaign({
      segmentLabel: channelDialogSegment.label,
      filters: channelDialogSegment.filters,
      channel,
    });
    setChannelDialogSegment(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[0, 1, 2, 3].map((g) => (
          <div key={g} className="space-y-3">
            <div className="h-5 w-52 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((c) => (
                <div
                  key={c}
                  className="h-28 rounded-lg bg-muted animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Não foi possível carregar os segmentos. Tente novamente.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            Base total:{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(data.total)}
            </span>{" "}
            clientes. Clique em um segmento para ver os clientes ou criar uma
            campanha diretamente.
          </span>
        </div>

        {data.groups.map((group) => {
          const style = GROUP_STYLE[group.id] ?? GROUP_STYLE.rfm;
          const Icon = style.icon;
          return (
            <section key={group.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    style.iconBg,
                  )}
                >
                  <Icon className={cn("h-5 w-5", style.iconColor)} />
                </div>
                <div>
                  <h3 className="text-base font-semibold leading-tight">
                    {group.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {group.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.segments.map((segment) => (
                  <Card
                    key={segment.id}
                    className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <CardContent className="flex h-full flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">
                          {segment.label}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {formatNumber(segment.count)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                        {segment.description}
                      </p>

                      <div className="mt-auto flex items-center gap-2 pt-1">
                        <Link href={buildClientsUrl(segment.filters)} className="flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full gap-1.5 text-xs opacity-70 hover:opacity-100",
                              style.accent,
                            )}
                          >
                            Ver clientes
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>

                        {onCreateCampaign && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => setChannelDialogSegment(segment)}
                          >
                            <Megaphone className="h-3 w-3" />
                            Campanha
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Dialog de seleção de canal */}
      <Dialog
        open={!!channelDialogSegment}
        onOpenChange={(v) => { if (!v) setChannelDialogSegment(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar campanha para "{channelDialogSegment?.label}"</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Escolha o canal de envio. O formulário abrirá com a audiência já
            preenchida com esse segmento.
          </p>
          <div className="grid gap-3 pt-1">
            {CHANNEL_OPTIONS.map((ch) => {
              const ChIcon = ch.icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelSelect(ch.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    ch.bg,
                    ch.border,
                  )}
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 dark:bg-black/20", ch.border, "border")}>
                    <ChIcon className={cn("h-4.5 w-4.5", ch.color)} />
                  </div>
                  <div>
                    <p className={cn("font-medium text-sm", ch.color)}>{ch.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch.id === "email" && "Envio por email via SendGrid"}
                      {ch.id === "sms" && "Envio de SMS via Twilio"}
                      {ch.id === "whatsapp" && "Disparo via WhatsApp"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
