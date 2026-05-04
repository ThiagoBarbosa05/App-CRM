import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Zap,
  Monitor,
  Bot,
  User,
  Radio,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { CampaignClientsDialog } from "./campaign-clients-dialog";
import { CampaignDispatchDialog } from "./campaign-dispatch-dialog";
import { CampaignMonitorDialog } from "./campaign-monitor-dialog";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: "rascunho" | "ativa" | "pausada" | "encerrada";
  type: "humano" | "ia";
  elevenLabsAgentId: string | null;
  elevenLabsVoiceId: string | null;
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

  if (total === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {/* Contadores */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {contacted}
            <span className="font-normal text-slate-400">/{total}</span>
          </span>
          <span>contactados</span>
        </div>
        <div className="flex items-center gap-2">
          {sim > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="size-3" />
              {sim}
            </span>
          )}
          {nao > 0 && (
            <span className="flex items-center gap-1 text-red-500 dark:text-red-400 font-medium">
              <XCircle className="size-3" />
              {nao}
            </span>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      <Progress value={pct} className="h-1.5" />

      {/* Botão andamento */}
      {contacted > 0 && (
        <button
          onClick={onMonitor}
          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
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
    formState: { errors, isSubmitting },
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { type: "ia" },
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      type: "ia",
      name: "",
      description: "",
      elevenLabsAgentId: "",
      elevenLabsVoiceId: "",
    });
    setFormOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    reset({
      name: c.name,
      description: c.description ?? "",
      type: c.type,
      elevenLabsAgentId: c.elevenLabsAgentId ?? "",
      elevenLabsVoiceId: c.elevenLabsVoiceId ?? "",
      status: c.status,
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

  const type = watch("type");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Campanhas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}{" "}
            cadastrada
            {campaigns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-2 rounded-2xl" onClick={openCreate}>
          <Plus className="size-4" />
          Nova campanha
        </Button>
      </div>

      <div className="relative min-h-[220px]">
        {isFetching && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-3xl">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-blue-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Carregando campanhas…
              </span>
            </div>
          </div>
        )}
        {!isLoading && campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Radio className="size-7 opacity-40" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhuma campanha criada ainda
            </p>
            <p className="text-xs mt-1 mb-4">
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
                className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                          campaign.type === "ia"
                            ? "bg-violet-100 dark:bg-violet-900/30"
                            : "bg-blue-100 dark:bg-blue-900/30"
                        }`}
                      >
                        {campaign.type === "ia" ? (
                          <Bot className="size-4 text-violet-600 dark:text-violet-400" />
                        ) : (
                          <User className="size-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate leading-tight">
                          {campaign.name}
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {campaign.type === "ia"
                            ? "IA (ElevenLabs)"
                            : "Discagem humana"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[campaign.status]}`}
                    >
                      {STATUS_LABELS[campaign.status]}
                    </span>
                  </div>

                  {campaign.description && (
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {campaign.description}
                    </CardDescription>
                  )}

                  {/* Progresso + métricas */}
                  <CampaignProgress
                    campaign={campaign}
                    onMonitor={() => setMonitorCampaign(campaign)}
                  />
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="h-px bg-slate-100 dark:bg-slate-800 mb-3" />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 gap-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setDispatchDialog(campaign)}
                    >
                      <Zap className="size-3.5" />
                      Disparar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs rounded-xl"
                      onClick={() => setClientsDialog(campaign)}
                    >
                      <Users className="size-3.5" />
                      Clientes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-xl"
                      title="Andamento"
                      onClick={() => setMonitorCampaign(campaign)}
                    >
                      <Monitor className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-xl"
                      onClick={() => openEdit(campaign)}
                      title="Editar"
                    >
                      <Edit className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => deleteMutation.mutate(campaign.id)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "Editar campanha" : "Nova campanha"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
            className="space-y-4"
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
                  <Label className="text-sm">ElevenLabs Agent ID *</Label>
                  <Input
                    {...register("elevenLabsAgentId")}
                    placeholder="agent_xxxxxxxxxxxxxxxx"
                  />
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

            <DialogFooter className="pt-2">
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
