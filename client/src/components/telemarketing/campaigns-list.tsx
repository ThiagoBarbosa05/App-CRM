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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

type DispatchResult = {
  dispatched: number;
  total: number;
  calls: Array<{
    clientId: string;
    clientName: string | null;
    callSid: string | null;
    callRecordId: string;
    status: string;
  }>;
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
  ativa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  pausada: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  encerrada: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
};

export function CampaignsList() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [clientsDialog, setClientsDialog] = useState<Campaign | null>(null);
  const [dispatchDialog, setDispatchDialog] = useState<Campaign | null>(null);
  const [monitorDialog, setMonitorDialog] = useState<{ campaign: Campaign; result: DispatchResult } | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
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
    reset({ type: "ia", name: "", description: "", elevenLabsAgentId: "", elevenLabsVoiceId: "" });
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
        const err = await res.json().catch(() => ({})) as { message?: string };
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
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
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
    onError: () => toast({ title: "Erro ao excluir campanha", variant: "destructive" }),
  });

  const type = watch("type");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Campanhas ({campaigns.length})
        </h2>
        <Button size="sm" className="gap-2 rounded-2xl" onClick={openCreate}>
          <Plus className="size-4" />
          Nova campanha
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Radio className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma campanha criada ainda.</p>
          <p className="text-xs mt-1">Clique em "Nova campanha" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {campaign.type === "ia" ? (
                      <Bot className="size-4 text-violet-500 shrink-0" />
                    ) : (
                      <User className="size-4 text-blue-500 shrink-0" />
                    )}
                    <CardTitle className="text-sm font-semibold truncate">
                      {campaign.name}
                    </CardTitle>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[campaign.status]}`}
                  >
                    {STATUS_LABELS[campaign.status]}
                  </span>
                </div>
                {campaign.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {campaign.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
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
                    className="h-8 gap-1.5 text-xs rounded-xl"
                    onClick={() => openEdit(campaign)}
                  >
                    <Edit className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setDispatchDialog(campaign)}
                  >
                    <Zap className="size-3.5" />
                    Disparar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => deleteMutation.mutate(campaign.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "Editar campanha" : "Nova campanha"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input {...register("name")} placeholder="Nome da campanha" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Descrição</Label>
              <Textarea {...register("description")} placeholder="Opcional" rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Tipo *</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as "humano" | "ia")}>
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
                  onValueChange={(v) => setValue("status", v as Campaign["status"])}
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
              <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
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
            if (result.calls.length > 0) {
              setMonitorDialog({ campaign: dispatchDialog, result });
            }
          }}
        />
      )}

      {monitorDialog && (
        <CampaignMonitorDialog
          open={!!monitorDialog}
          onClose={() => setMonitorDialog(null)}
          campaignName={monitorDialog.campaign.name}
          initialCalls={monitorDialog.result.calls}
        />
      )}
    </div>
  );
}
