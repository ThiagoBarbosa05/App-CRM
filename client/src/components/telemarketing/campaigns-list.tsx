import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Plus,
  Edit,
  Trash2,
  Zap,
  Monitor,
  Bot,
  Radio,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Pause,
  Link2,
  SlidersHorizontal,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Settings2,
  Webhook,
  Check,
  ChevronsUpDown,
  RefreshCw,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CampaignClientsDialog } from "./campaign-clients-dialog";
import { CampaignDispatchDialog } from "./campaign-dispatch-dialog";
import { CampaignMonitorDialog } from "./campaign-monitor-dialog";
import { AgentConfigModal } from "./agent-config-modal";
import { AgentToolsModal } from "./agent-tools-modal";
import { useUmblerChannels } from "@/hooks/use-umbler-channels";
import { useUmblerBots } from "@/hooks/use-umbler-bots";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: "rascunho" | "ativa" | "pausada" | "encerrada";
  type: "humano" | "ia";
  elevenLabsAgentId: string | null;
  elevenLabsVoiceId: string | null;
  umblerEnabled: boolean;
  umblerChannelId: string | null;
  umblerBotId: string | null;
  umblerBotTriggerName: string | null;
  umblerMessageText: string | null;
  umblerTriggerDecision: string | null;
  createdAt: string;
};

type CampaignStats = {
  total: number;
  contacted: number;
  sim: number;
  nao: number;
  failed: number;
};

const campaignSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  type: z.enum(["humano", "ia"]),
  elevenLabsAgentId: z.string().optional(),
  elevenLabsVoiceId: z.string().optional(),
  status: z.enum(["rascunho", "ativa", "pausada", "encerrada"]).optional(),
  umblerEnabled: z.boolean().optional(),
  umblerChannelId: z.string().optional(),
  umblerBotId: z.string().optional(),
  umblerBotTriggerName: z.string().optional(),
  umblerMessageText: z.string().optional(),
  umblerTriggerDecision: z.string().optional(),
});
type CampaignForm = z.infer<typeof campaignSchema>;

const STATUS_LABELS: Record<Campaign["status"], string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

const STATUS_COLORS: Record<Campaign["status"], string> = {
  rascunho: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  ativa:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  pausada:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  encerrada:
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
};

const STATUS_ACCENT: Record<Campaign["status"], string> = {
  ativa: "border-t-[3px] border-t-emerald-500",
  pausada: "border-t-[3px] border-t-yellow-400",
  rascunho: "border-t-[3px] border-t-slate-300 dark:border-t-slate-600",
  encerrada: "border-t-[3px] border-t-slate-200 dark:border-t-slate-700",
};

// Sub-component: busca stats da campanha e renderiza progresso no card
function CampaignProgress({
  campaign,
  onMonitor,
}: {
  campaign: Campaign;
  onMonitor: () => void;
}) {
  const { data: stats } = useQuery<CampaignStats>({
    queryKey: ["/api/campaigns/stats", campaign.id],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}/stats`, {
        credentials: "include",
      });
      if (!res.ok) return { total: 0, contacted: 0, sim: 0, nao: 0, failed: 0 };
      return res.json();
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const total = stats?.total ?? 0;
  const contacted = stats?.contacted ?? 0;
  const sim = stats?.sim ?? 0;
  const nao = stats?.nao ?? 0;
  const pct = total > 0 ? Math.round((contacted / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progresso */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Progresso</span>
            {sim > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-500 font-semibold">
                <CheckCircle2 className="size-3" />
                {sim}
              </span>
            )}
            {nao > 0 && (
              <span className="flex items-center gap-0.5 text-red-400 font-semibold">
                <XCircle className="size-3" />
                {nao}
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {pct}%
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 pt-0.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Total Clientes
          </p>
          <p className="mt-0.5 text-xl font-bold leading-none text-slate-800 dark:text-slate-100">
            {total}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Contactados
          </p>
          <p className="mt-0.5 text-xl font-bold leading-none text-emerald-500">
            {contacted}
          </p>
        </div>
      </div>

      {/* Link de andamento */}
      {contacted > 0 && (
        <button
          onClick={onMonitor}
          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Monitor className="size-3" />
          Ver andamento por cliente
        </button>
      )}
    </div>
  );
}

export function CampaignsList() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [clientsDialog, setClientsDialog] = useState<Campaign | null>(null);
  const [dispatchDialog, setDispatchDialog] = useState<Campaign | null>(null);
  const [monitorCampaign, setMonitorCampaign] = useState<Campaign | null>(null);
  const [agentConfigCampaign, setAgentConfigCampaign] = useState<Campaign | null>(null);
  const [agentToolsCampaign, setAgentToolsCampaign] = useState<Campaign | null>(null);

  const {
    data: campaigns = [],
    isLoading,
    isFetching,
  } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar campanhas");
      return res.json();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { type: "ia" },
  });

  const [umblerOpen, setUmblerOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setUmblerOpen(false);
    reset({
      type: "ia",
      name: "",
      description: "",
      elevenLabsAgentId: "",
      elevenLabsVoiceId: "",
      umblerEnabled: false,
      umblerChannelId: "",
      umblerBotId: "",
      umblerBotTriggerName: "",
      umblerMessageText: "",
      umblerTriggerDecision: "qualquer",
    });
    setFormOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setUmblerOpen(c.umblerEnabled);
    reset({
      name: c.name,
      description: c.description ?? "",
      type: c.type,
      elevenLabsAgentId: c.elevenLabsAgentId ?? "",
      elevenLabsVoiceId: c.elevenLabsVoiceId ?? "",
      status: c.status,
      umblerEnabled: c.umblerEnabled,
      umblerChannelId: c.umblerChannelId ?? "",
      umblerBotId: c.umblerBotId ?? "",
      umblerBotTriggerName: c.umblerBotTriggerName ?? "",
      umblerMessageText: c.umblerMessageText ?? "",
      umblerTriggerDecision: c.umblerTriggerDecision ?? "qualquer",
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CampaignForm) => {
      const url = editing ? `/api/campaigns/${editing.id}` : "/api/campaigns";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editing ? "Campanha atualizada" : "Campanha criada" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setFormOpen(false);
    },
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => {
      toast({ title: "Campanha excluída" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: () =>
      toast({ title: "Erro ao excluir campanha", variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Campaign["status"];
    }) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      // Atualiza otimisticamente o cache sem disparar refetch
      const prev = queryClient.getQueryData<Campaign[]>(["/api/campaigns"]);
      queryClient.setQueryData<Campaign[]>(
        ["/api/campaigns"],
        (old) => old?.map((c) => (c.id === id ? { ...c, status } : c)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Reverte em caso de falha
      if (ctx?.prev) {
        queryClient.setQueryData(["/api/campaigns"], ctx.prev);
      }
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const type = watch("type");
  const umblerEnabled = watch("umblerEnabled");

  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);

  const {
    data: agentsList,
    isLoading: agentsLoading,
    refetch: refetchAgents,
  } = useQuery<{ agents: Array<{ agentId: string; name: string }> }>({
    queryKey: ["/api/elevenlabs/agents"],
    queryFn: async () => {
      const res = await fetch("/api/elevenlabs/agents", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao listar agentes");
      return res.json();
    },
    enabled: type === "ia",
    staleTime: 30_000,
  });

  const { data: channels = [] } = useUmblerChannels();
  const { data: botsData } = useUmblerBots({ take: 50 });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Campanhas
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Gerencie suas filas de discagem
          </p>
        </div>
        <Button className="shrink-0 gap-2 rounded-2xl" onClick={openCreate}>
          <Plus className="size-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Lista */}
      <div className="relative min-h-[220px]">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/80 backdrop-blur-sm dark:bg-slate-950/80">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <Loader2 className="size-5 animate-spin text-blue-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Carregando campanhas…
              </span>
            </div>
          </div>
        )}

        {!isLoading && campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Radio className="size-7 opacity-40" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhuma campanha criada ainda
            </p>
            <p className="mt-1 mb-4 text-xs">
              Configure campanhas de discagem manual ou com IA
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-2xl"
              onClick={openCreate}
            >
              <Plus className="size-3.5" />
              Criar primeira campanha
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <Card
                key={campaign.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
                  STATUS_ACCENT[campaign.status],
                )}
              >
                <CardHeader className="pb-3">
                  {/* Ícone + nome + badges */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                        campaign.type === "ia"
                          ? "bg-violet-100 dark:bg-violet-900/30"
                          : "bg-teal-100 dark:bg-teal-900/30",
                      )}
                    >
                      {campaign.type === "ia" ? (
                        <Bot className="size-5 text-violet-600 dark:text-violet-400" />
                      ) : (
                        <Radio className="size-5 text-teal-600 dark:text-teal-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <CardTitle className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                          {campaign.name}
                        </CardTitle>
                        <button
                          type="button"
                          className="-mr-1 -mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          onClick={() => openEdit(campaign)}
                          title="Editar campanha"
                        >
                          <Edit className="size-3" />
                        </button>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_COLORS[campaign.status],
                          )}
                        >
                          {STATUS_LABELS[campaign.status]}
                        </span>
                        {campaign.type === "ia" && (
                          <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            <Bot className="size-2.5" />
                            IA
                          </span>
                        )}
                        {campaign.umblerEnabled && (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            <MessageSquare className="size-2.5" />
                            Umbler
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  {campaign.description && (
                    <CardDescription className="mt-2 line-clamp-2 text-xs">
                      {campaign.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col pt-0">
                  {/* Agent ID (IA) */}
                  {campaign.type === "ia" && campaign.elevenLabsAgentId && (
                    <div className="mb-3 flex items-center gap-1.5 truncate text-xs text-slate-400 dark:text-slate-500">
                      <Link2 className="size-3 shrink-0 text-violet-400" />
                      <span className="truncate font-mono">
                        {campaign.elevenLabsAgentId}
                      </span>
                    </div>
                  )}

                  {/* Progresso + stats */}
                  <CampaignProgress
                    campaign={campaign}
                    onMonitor={() => setMonitorCampaign(campaign)}
                  />

                  {/* Ações */}
                  <div className="mt-auto pt-4">
                    <div className="mb-3 h-px bg-slate-100 dark:bg-slate-800" />
                    <div className="flex items-center gap-2">
                      {/* Botão principal: Pausar / Ativar */}
                      <Button
                        size="sm"
                        className={cn(
                          "h-9 flex-1 gap-1.5 rounded-xl text-xs font-semibold",
                          campaign.status === "ativa"
                            ? "border border-slate-200 bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            : "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600",
                        )}
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: campaign.id,
                            status:
                              campaign.status === "ativa" ? "pausada" : "ativa",
                          })
                        }
                        disabled={toggleStatusMutation.isPending}
                      >
                        {campaign.status === "ativa" ? (
                          <>
                            <Pause className="size-3.5" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5" />
                            Ativar
                          </>
                        )}
                      </Button>

                      {/* Disparar */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 shrink-0 rounded-xl p-0"
                        title="Disparar campanha"
                        onClick={() => setDispatchDialog(campaign)}
                      >
                        <Zap className="size-3.5" />
                      </Button>

                      {/* Clientes */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 shrink-0 rounded-xl p-0"
                        title="Gerenciar clientes"
                        onClick={() => setClientsDialog(campaign)}
                      >
                        <SlidersHorizontal className="size-3.5" />
                      </Button>

                      {/* Configurar Agente IA */}
                      {campaign.type === "ia" && campaign.elevenLabsAgentId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 shrink-0 rounded-xl p-0 text-violet-600 border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-900/20"
                          title="Configurar agente IA"
                          onClick={() => setAgentConfigCampaign(campaign)}
                        >
                          <Settings2 className="size-3.5" />
                        </Button>
                      )}

                      {/* Ferramentas do Agente IA */}
                      {campaign.type === "ia" && campaign.elevenLabsAgentId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 shrink-0 rounded-xl p-0 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                          title="Gerenciar ferramentas do agente"
                          onClick={() => setAgentToolsCampaign(campaign)}
                        >
                          <Webhook className="size-3.5" />
                        </Button>
                      )}

                      {/* Excluir */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 shrink-0 rounded-xl p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Excluir campanha"
                        onClick={() => deleteMutation.mutate(campaign.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form Sheet */}
      <Sheet open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              {editing ? "Editar campanha" : "Nova campanha"}
            </SheetTitle>
          </SheetHeader>
          <form
            onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
            className="space-y-4 mt-6"
          >
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input {...register("name")} placeholder="Nome da campanha" />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Descrição</Label>
              <Textarea
                {...register("description")}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Tipo *</Label>
              <Select
                value={type}
                onValueChange={(v) => setValue("type", v as "humano" | "ia")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ia">IA (ElevenLabs)</SelectItem>
                  <SelectItem value="humano">Humano (WebRTC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "ia" && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Agente ElevenLabs *</Label>
                    <button
                      type="button"
                      onClick={() => void refetchAgents()}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title="Recarregar lista de agentes"
                    >
                      <RefreshCw
                        className={`size-3.5 ${agentsLoading ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>

                  {(agentsList?.agents?.length ?? 0) > 0 ? (
                    <Popover
                      open={agentSelectorOpen}
                      onOpenChange={setAgentSelectorOpen}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground font-mono"
                        >
                          <span
                            className={
                              watch("elevenLabsAgentId")
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {watch("elevenLabsAgentId")
                              ? (agentsList?.agents.find(
                                  (a) =>
                                    a.agentId === watch("elevenLabsAgentId"),
                                )?.name ?? watch("elevenLabsAgentId"))
                              : "Selecionar agente..."}
                          </span>
                          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput placeholder="Buscar agente..." />
                          <CommandList>
                            <CommandEmpty>
                              {agentsLoading
                                ? "Carregando..."
                                : "Nenhum agente encontrado."}
                            </CommandEmpty>
                            <CommandGroup>
                              {(agentsList?.agents ?? []).map((agent) => (
                                <CommandItem
                                  key={agent.agentId}
                                  value={`${agent.name} ${agent.agentId}`}
                                  onSelect={() => {
                                    setValue(
                                      "elevenLabsAgentId",
                                      agent.agentId,
                                    );
                                    setAgentSelectorOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 size-4 ${watch("elevenLabsAgentId") === agent.agentId ? "opacity-100" : "opacity-0"}`}
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">
                                      {agent.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono truncate">
                                      {agent.agentId}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input
                      {...register("elevenLabsAgentId")}
                      placeholder={
                        agentsLoading
                          ? "Carregando agentes..."
                          : "agent_xxxxxxxxxxxxxxxx"
                      }
                      className="font-mono"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Voice ID (opcional)</Label>
                  <Input
                    {...register("elevenLabsVoiceId")}
                    placeholder="Sobrescreve o voice_id global"
                  />
                </div>
              </>
            )}

            {editing && (
              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select
                  value={watch("status") ?? editing.status}
                  onValueChange={(v) =>
                    setValue("status", v as Campaign["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="pausada">Pausada</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ─── Seção Umbler ─── */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300"
                onClick={() => setUmblerOpen((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-green-500" />
                  Envio automático via Umbler
                </span>
                {umblerOpen ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>

              {umblerOpen && (
                <div className="space-y-4 border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Habilitar</Label>
                    <Controller
                      control={control}
                      name="umblerEnabled"
                      render={({ field }) => (
                        <Switch
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  {umblerEnabled && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Disparar quando decisão for</Label>
                        <Controller
                          control={control}
                          name="umblerTriggerDecision"
                          render={({ field }) => (
                            <Select
                              value={field.value ?? "qualquer"}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="qualquer">Qualquer resposta</SelectItem>
                                <SelectItem value="sim">Sim (interessado)</SelectItem>
                                <SelectItem value="nao">Não (sem interesse)</SelectItem>
                                <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm">Canal Umbler</Label>
                        <Controller
                          control={control}
                          name="umblerChannelId"
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o canal" />
                              </SelectTrigger>
                              <SelectContent>
                                {(channels as Array<{ id: string; name: string; state: string }>)
                                  .filter((ch) => ch.state === "Live")
                                  .map((ch) => (
                                    <SelectItem key={ch.id} value={ch.id}>
                                      {ch.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm">Bot a disparar (opcional)</Label>
                        <Controller
                          control={control}
                          name="umblerBotId"
                          render={({ field }) => (
                            <Select
                              value={field.value || "none"}
                              onValueChange={(v) => {
                                const val = v === "none" ? "" : v;
                                field.onChange(val);
                                const bot = botsData?.result?.find(
                                  (b: { botId: string; triggerName: string }) => b.botId === v,
                                );
                                setValue("umblerBotTriggerName", bot ? bot.triggerName : "");
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Nenhum bot" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {botsData?.result?.map(
                                  (b: { botId: string; botTitle: string }) => (
                                    <SelectItem key={b.botId} value={b.botId}>
                                      {b.botTitle}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm">Mensagem pré-definida (opcional)</Label>
                        <Textarea
                          {...register("umblerMessageText")}
                          placeholder="Texto a enviar via WhatsApp após a ligação"
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <SheetFooter className="pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || saveMutation.isPending}
              >
                {editing ? "Salvar" : "Criar"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Dialogs externos */}
      {clientsDialog && (
        <CampaignClientsDialog
          open={!!clientsDialog}
          onClose={() => setClientsDialog(null)}
          campaignId={clientsDialog.id}
          campaignName={clientsDialog.name}
        />
      )}

      {dispatchDialog && (
        <CampaignDispatchDialog
          open={!!dispatchDialog}
          onClose={() => setDispatchDialog(null)}
          campaign={dispatchDialog}
          onDispatched={(result) => {
            setDispatchDialog(null);
            // Abre o monitor logo após disparar se houve chamadas
            if (result.calls.length > 0) {
              setMonitorCampaign(dispatchDialog);
            }
          }}
        />
      )}

      {monitorCampaign && (
        <CampaignMonitorDialog
          open={!!monitorCampaign}
          onClose={() => setMonitorCampaign(null)}
          campaignId={monitorCampaign.id}
          campaignName={monitorCampaign.name}
        />
      )}

      {agentConfigCampaign?.elevenLabsAgentId && (
        <AgentConfigModal
          open={!!agentConfigCampaign}
          onClose={() => setAgentConfigCampaign(null)}
          agentId={agentConfigCampaign.elevenLabsAgentId}
          campaignName={agentConfigCampaign.name}
        />
      )}

      {agentToolsCampaign?.elevenLabsAgentId && (
        <AgentToolsModal
          open={!!agentToolsCampaign}
          onClose={() => setAgentToolsCampaign(null)}
          agentId={agentToolsCampaign.elevenLabsAgentId}
          campaignName={agentToolsCampaign.name}
        />
      )}
    </div>
  );
}
