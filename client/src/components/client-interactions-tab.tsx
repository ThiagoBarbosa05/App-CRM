import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Client, type ClientInteractionWithUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Users,
  MapPin,
  StickyNote,
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import InteractionFormModal from "./interaction-form-modal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type InteractionDraft = {
  type:
    | "telemarketing"
    | "email"
    | "meeting"
    | "whatsapp"
    | "visit"
    | "note"
    | "other";
  subject: string;
  description: string;
  status: "completed" | "scheduled" | "cancelled";
};

interface ClientInteractionsTabProps {
  client: Client;
}

const interactionTypeConfig = {
  telemarketing: {
    label: "Ligação",
    icon: Phone,
    badgeClass:
      "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800/60 dark:bg-cyan-500/10 dark:text-cyan-300",
    iconWrap: "bg-cyan-100 dark:bg-cyan-900/30",
    iconClass: "text-cyan-700 dark:text-cyan-300",
    lineClass: "bg-cyan-500",
  },
  email: {
    label: "E-mail",
    icon: Mail,
    badgeClass:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-800/60 dark:bg-green-500/10 dark:text-green-300",
    iconWrap: "bg-green-100 dark:bg-green-900/30",
    iconClass: "text-green-700 dark:text-green-300",
    lineClass: "bg-green-500",
  },
  meeting: {
    label: "Reunião",
    icon: Users,
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-500/10 dark:text-violet-300",
    iconWrap: "bg-violet-100 dark:bg-violet-900/30",
    iconClass: "text-violet-700 dark:text-violet-300",
    lineClass: "bg-violet-500",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageSquare,
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-500/10 dark:text-emerald-300",
    iconWrap: "bg-emerald-100 dark:bg-emerald-900/30",
    iconClass: "text-emerald-700 dark:text-emerald-300",
    lineClass: "bg-emerald-500",
  },
  visit: {
    label: "Visita",
    icon: MapPin,
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-500/10 dark:text-orange-300",
    iconWrap: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-700 dark:text-orange-300",
    lineClass: "bg-orange-500",
  },
  note: {
    label: "Anotação",
    icon: StickyNote,
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    iconWrap: "bg-slate-100 dark:bg-slate-800",
    iconClass: "text-slate-700 dark:text-slate-300",
    lineClass: "bg-slate-400",
  },
  other: {
    label: "Outro",
    icon: Clock,
    badgeClass:
      "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-500/10 dark:text-indigo-300",
    iconWrap: "bg-indigo-100 dark:bg-indigo-900/30",
    iconClass: "text-indigo-700 dark:text-indigo-300",
    lineClass: "bg-indigo-500",
  },
} as const;

const statusConfig = {
  completed: {
    label: "Concluído",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  scheduled: {
    label: "Agendado",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-300",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-500/10 dark:text-rose-300",
  },
} as const;

export default function ClientInteractionsTab({
  client,
}: ClientInteractionsTabProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInteraction, setEditingInteraction] =
    useState<ClientInteractionWithUser | null>(null);
  const [pendingInteractionDraft, setPendingInteractionDraft] =
    useState<InteractionDraft | null>(null);

  const interactionDraft = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("interactionSource") !== "purchase-insights") {
      return null;
    }

    return {
      type:
        (params.get("interactionType") as InteractionDraft["type"] | null) ??
        "note",
      subject: params.get("interactionSubject") ?? "",
      description: params.get("interactionDescription") ?? "",
      status:
        (params.get("interactionStatus") as
          | InteractionDraft["status"]
          | null) ?? "scheduled",
    };
  }, [location]);

  useEffect(() => {
    if (!interactionDraft || showFormModal || editingInteraction) return;

    setPendingInteractionDraft(interactionDraft);
    setShowFormModal(true);

    const url = new URL(window.location.href);
    url.searchParams.delete("interactionSource");
    url.searchParams.delete("interactionType");
    url.searchParams.delete("interactionSubject");
    url.searchParams.delete("interactionDescription");
    url.searchParams.delete("interactionStatus");
    navigate(`${url.pathname}${url.search}`, { replace: true });
  }, [editingInteraction, interactionDraft, navigate, showFormModal]);

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["/api/clients", client.id, "interactions"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${client.id}/interactions`);
      if (!response.ok) throw new Error("Erro ao buscar interações");
      return response.json();
    },
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      await apiRequest("DELETE", `/api/interactions/${interactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", client.id, "interactions"],
      });
      toast({
        title: "Interação excluída",
        description: "Interação foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a interação.",
        variant: "destructive",
      });
    },
  });

  const formatDateTime = (date: string) => {
    const dateObj = new Date(date);
    return format(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const openNewInteraction = () => {
    setPendingInteractionDraft(null);
    setShowFormModal(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-[124px] rounded-[28px]" />
        <Skeleton className="h-[180px] rounded-[24px]" />
        <Skeleton className="h-[180px] rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_28%),linear-gradient(135deg,#fcfaff_0%,#ffffff_46%,#faf6ff_100%)] px-6 py-6 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.24),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.92)_60%,rgba(45,23,56,0.95)_100%)]">
          <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-fuchsia-200/40 blur-3xl dark:bg-fuchsia-500/20" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/70 bg-white/80 shadow-[0_18px_40px_-26px_rgba(168,85,247,0.45)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/75">
                <MessageSquare className="h-8 w-8 text-fuchsia-600 dark:text-fuchsia-400" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-700 shadow-sm hover:bg-fuchsia-50 dark:border-fuchsia-800/70 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                    Histórico de Contato
                  </Badge>
                  <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {interactions.length} registro
                    {interactions.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Interações e acompanhamento
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  Centralize ligações, visitas, e-mails, anotações e próximos
                  passos deste cliente em uma linha do tempo mais clara.
                </p>
              </div>
            </div>

            <Button
              onClick={openNewInteraction}
              className="h-11 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(168,85,247,0.55)] transition-all hover:translate-y-[-1px] hover:from-fuchsia-700 hover:to-violet-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova interação
            </Button>
          </div>
        </CardHeader>
      </Card>

      {interactions.length === 0 ? (
        <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.32)] dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="px-6 py-12">
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/45">
              <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-800">
                <StickyNote className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Nenhuma interação registrada
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Comece adicionando uma nova interação para documentar contatos,
                alinhamentos e oportunidades com este cliente.
              </p>
              <Button
                onClick={openNewInteraction}
                className="mt-6 h-11 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-500 px-5 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(168,85,247,0.55)] transition-all hover:translate-y-[-1px] hover:from-fuchsia-700 hover:to-violet-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Primeira interação
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interactions.map(
            (interaction: ClientInteractionWithUser, index: number) => {
              const typeConfig =
                interactionTypeConfig[
                  interaction.type as keyof typeof interactionTypeConfig
                ] ?? interactionTypeConfig.other;
              const currentStatus =
                statusConfig[interaction.status as keyof typeof statusConfig] ??
                statusConfig.completed;
              const IconComponent = typeConfig.icon;

              return (
                <div
                  key={interaction.id}
                  className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_-35px_rgba(15,23,42,0.38)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_-35px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="absolute bottom-0 left-[29px] top-0 w-px bg-slate-200 dark:bg-slate-800" />
                  {index === interactions.length - 1 && (
                    <div className="absolute bottom-0 left-[24px] h-10 w-3 bg-white dark:bg-slate-950" />
                  )}

                  <div className="relative flex gap-4">
                    <div className="flex shrink-0 flex-col items-center">
                      <div
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/70 shadow-sm dark:border-slate-700",
                          typeConfig.iconWrap,
                        )}
                      >
                        <IconComponent
                          className={cn("h-5 w-5", typeConfig.iconClass)}
                        />
                      </div>
                      <div
                        className={cn(
                          "mt-3 h-full min-h-[36px] w-1 rounded-full",
                          typeConfig.lineClass,
                        )}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                typeConfig.badgeClass,
                              )}
                            >
                              {typeConfig.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                currentStatus.className,
                              )}
                            >
                              {currentStatus.label}
                            </Badge>
                          </div>

                          <h4 className="text-lg font-black text-slate-900 dark:text-white">
                            {interaction.subject}
                          </h4>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDateTime(interaction.date.toString())}
                            </div>
                            {interaction.callResult &&
                              interaction.type === "telemarketing" && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5" />
                                  {interaction.callResult}
                                </div>
                              )}
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDistanceToNow(
                                new Date(interaction.createdAt.toString()),
                                {
                                  addSuffix: true,
                                  locale: ptBR,
                                },
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 lg:ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingInteraction(interaction)}
                            className="h-10 w-10 rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteInteractionMutation.mutate(interaction.id)
                            }
                            className="h-10 w-10 rounded-xl text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 shadow-inner dark:border-slate-800 dark:bg-slate-900/55">
                        <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">
                          {interaction.description}
                        </p>
                      </div>

                      {interaction.address && interaction.type === "visit" && (
                        <div className="mt-4 rounded-[20px] border border-blue-200/70 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/15">
                          <div className="flex items-center gap-2 text-sm font-bold text-blue-800 dark:text-blue-300">
                            <MapPin className="h-4 w-4" />
                            Local da visita
                          </div>
                          <p className="mt-2 text-sm text-blue-700 dark:text-blue-200">
                            {interaction.address}
                          </p>
                          {interaction.latitude && interaction.longitude && (
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-blue-600 dark:text-blue-300">
                              <span>
                                Coordenadas:{" "}
                                {Number(interaction.latitude).toFixed(6)},{" "}
                                {Number(interaction.longitude).toFixed(6)}
                              </span>
                              <a
                                href={`https://www.google.com/maps?q=${interaction.latitude},${interaction.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold underline underline-offset-2"
                              >
                                Ver no mapa
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                        por {interaction.user.name}
                      </div>
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      <InteractionFormModal
        open={showFormModal}
        onOpenChange={(open) => {
          setShowFormModal(open);
          if (!open) {
            setPendingInteractionDraft(null);
          }
        }}
        target={{
          id: client.id,
          type: "client",
        }}
        draft={pendingInteractionDraft ?? undefined}
      />

      {editingInteraction && (
        <InteractionFormModal
          open={!!editingInteraction}
          onOpenChange={(open) => !open && setEditingInteraction(null)}
          target={{
            id: client.id,
            type: "client",
          }}
          interaction={editingInteraction}
        />
      )}
    </div>
  );
}
