import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Trash2,
  Webhook,
  Wrench,
  Edit,
  AlertCircle,
  Library,
  Search,
  Check,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type SystemTool = {
  type: "system";
  name: string;
  description: string;
};

type WebhookTool = {
  type: "webhook";
  name: string;
  description: string;
  api_schema?: {
    url?: string;
    method?: string;
    content_type?: string;
    request_body_schema?: unknown;
    request_headers?: Record<string, string>;
  };
  expects_response?: boolean;
  response_timeout_secs?: number;
};

type AgentTool = SystemTool | WebhookTool;

type AgentConfig = {
  tools: AgentTool[];
};

function isWebhookTool(t: AgentTool): t is WebhookTool {
  return t.type === "webhook";
}

// ─── Definição de todas as ferramentas de sistema disponíveis ─────────────────

const ALL_SYSTEM_TOOLS: { name: string; label: string; description: string; alpha?: boolean }[] = [
  { name: "end_call", label: "Encerrar conversa", description: "Permite que o agente encerre a chamada" },
  { name: "language_detection", label: "Detectar idioma", description: "Detecta e adapta o idioma automaticamente" },
  { name: "skip_turn", label: "Pular vez", description: "Permite que o agente pule seu turno de fala" },
  { name: "update_state", label: "Atualizar estado", description: "Atualiza o estado da conversa", alpha: true },
  { name: "transfer_to_agent", label: "Transferir para agente", description: "Transfere a conversa para outro agente" },
  { name: "transfer_to_number", label: "Transferir para número", description: "Transfere a chamada para um número de telefone" },
  { name: "play_keypad_touch_tone", label: "Reproduzir tom de toque do teclado", description: "Reproduz tons DTMF durante a chamada" },
  { name: "voicemail_detection", label: "Detecção de correio de voz", description: "Detecta quando a chamada cai em caixa postal" },
];

// ─── Tipo de ferramenta da workspace ElevenLabs ───────────────────────────────

type WorkspaceTool = {
  tool_id: string;
  name: string;
  description?: string;
  type?: string;
  api_schema?: {
    url?: string;
    method?: string;
    request_body_schema?: unknown;
  };
};

// ─── Schema do formulário de webhook ─────────────────────────────────────────

const toolSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().optional(),
    url: z.string().optional(),
    method: z.enum(["POST", "GET"]).optional(),
    requestBody: z.string().optional(),
    expectsResponse: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!/^[a-z][a-z0-9_]*$/.test(v.name)) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Use apenas letras minúsculas, números e _" });
    }
    if (!v.description?.trim()) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Descrição é obrigatória" });
    }
    if (!v.url?.trim()) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "URL é obrigatória" });
    } else {
      try { new URL(v.url); } catch {
        ctx.addIssue({ code: "custom", path: ["url"], message: "URL inválida" });
      }
    }
  });
type ToolForm = z.infer<typeof toolSchema>;

// ─── Formulário de nova/editar webhook ───────────────────────────────────────

function WebhookForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: WebhookTool;
  onSave: (tool: WebhookTool) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ToolForm>({
    resolver: zodResolver(toolSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          description: initial.description,
          url: initial.api_schema?.url ?? "",
          method: (initial.api_schema?.method as "POST" | "GET") ?? "POST",
          requestBody: initial.api_schema?.request_body_schema
            ? JSON.stringify(initial.api_schema.request_body_schema, null, 2)
            : "",
          expectsResponse: initial.expects_response ?? false,
        }
      : { method: "POST", expectsResponse: false },
  });

  const onSubmit = (data: ToolForm) => {
    let parsedSchema: unknown = undefined;
    if (data.requestBody?.trim()) {
      try { parsedSchema = JSON.parse(data.requestBody.trim()); } catch { /* ignora JSON inválido */ }
    }
    onSave({
      type: "webhook",
      name: data.name,
      description: data.description ?? "",
      api_schema: {
        url: data.url ?? "",
        method: data.method ?? "POST",
        content_type: "application/json",
        ...(parsedSchema ? { request_body_schema: parsedSchema } : {}),
      },
      expects_response: data.expectsResponse ?? false,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Nome *</Label>
        <Input
          {...register("name")}
          placeholder="confirmar_interesse"
          disabled={!!initial}
        />
        <p className="text-xs text-slate-400">
          Letras minúsculas, números e _ (sem espaços)
        </p>
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Descrição *</Label>
        <Textarea
          {...register("description")}
          placeholder="Quando o agente deve chamar esta ferramenta..."
          rows={2}
        />
        {errors.description && (
          <p className="text-xs text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-sm">URL *</Label>
          <Input {...register("url")} placeholder="https://seuapp.com/api/…" />
          {errors.url && <p className="text-xs text-red-500">{errors.url.message as string}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Método</Label>
          <Select
            value={watch("method") ?? "POST"}
            onValueChange={(v) => setValue("method", v as "POST" | "GET")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Corpo da requisição (JSON, opcional)</Label>
        <Textarea
          {...register("requestBody")}
          placeholder={'{"callSid": "{{callSid}}", "decision": "sim"}'}
          rows={4}
          className="font-mono text-xs"
        />
        <p className="text-xs text-slate-400">
          Use <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{{variavel}}"}</code> para variáveis dinâmicas do agente
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="expectsResponse"
          {...register("expectsResponse")}
          className="h-4 w-4 rounded border-slate-300"
        />
        <Label htmlFor="expectsResponse" className="cursor-pointer text-sm font-normal">
          Aguardar resposta da URL (expects_response)
        </Label>
      </div>

      <DialogFooter className="pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar ferramenta</Button>
      </DialogFooter>
    </form>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface AgentToolsModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  campaignName: string;
}

export function AgentToolsModal({
  open,
  onClose,
  agentId,
  campaignName,
}: AgentToolsModalProps) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"library" | "new">("library");
  const [librarySearch, setLibrarySearch] = useState("");
  const [addingLibraryTool, setAddingLibraryTool] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<WebhookTool | null>(null);
  const [pendingSystemTool, setPendingSystemTool] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/elevenlabs/agents", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar agente");
      return res.json();
    },
    enabled: open && !!agentId,
  });

  const { data: workspaceData, isLoading: workspaceLoading } = useQuery<{ tools: WorkspaceTool[] }>({
    queryKey: ["/api/elevenlabs/tools"],
    queryFn: async () => {
      const res = await fetch("/api/elevenlabs/tools", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar ferramentas");
      return res.json();
    },
    enabled: open,
  });

  const tools: AgentTool[] = (config?.tools as AgentTool[] | undefined) ?? [];
  const systemTools = tools.filter((t) => t.type === "system") as SystemTool[];
  const webhookTools = tools.filter(isWebhookTool);

  const activeSystemNames = new Set(systemTools.map((t) => t.name));

  const saveMutation = useMutation({
    mutationFn: async (newTools: AgentTool[]) => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tools: newTools }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao salvar");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/agents", agentId] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const toggleSystemTool = (name: string, enabled: boolean) => {
    setPendingSystemTool(name);
    let newSystemTools: SystemTool[];
    if (enabled) {
      const def = ALL_SYSTEM_TOOLS.find((t) => t.name === name)!;
      newSystemTools = [...systemTools, { type: "system", name, description: def.description }];
    } else {
      newSystemTools = systemTools.filter((t) => t.name !== name);
    }
    saveMutation.mutate([...newSystemTools, ...webhookTools], {
      onSuccess: () =>
        toast({ title: enabled ? "Ferramenta ativada" : "Ferramenta desativada" }),
      onSettled: () => setPendingSystemTool(null),
    });
  };

  const openAddDialog = () => {
    setAddTab("library");
    setLibrarySearch("");
    setAddOpen(true);
  };

  const handleAddWebhook = (tool: WebhookTool) => {
    saveMutation.mutate([...systemTools, ...webhookTools, tool], {
      onSuccess: () => {
        toast({ title: "Ferramenta adicionada" });
        setAddOpen(false);
      },
    });
  };

  const handleAddFromLibrary = (wt: WorkspaceTool) => {
    setAddingLibraryTool(wt.tool_id);
    const tool: WebhookTool = {
      type: "webhook",
      name: wt.name,
      description: wt.description ?? "",
      api_schema: wt.api_schema
        ? {
            url: wt.api_schema.url ?? "",
            method: wt.api_schema.method ?? "POST",
            content_type: "application/json",
            ...(wt.api_schema.request_body_schema
              ? { request_body_schema: wt.api_schema.request_body_schema }
              : {}),
          }
        : undefined,
    };
    saveMutation.mutate([...systemTools, ...webhookTools, tool], {
      onSuccess: () => {
        toast({ title: "Ferramenta adicionada da biblioteca" });
        setAddingLibraryTool(null);
        setAddOpen(false);
      },
      onError: () => setAddingLibraryTool(null),
    });
  };

  const handleEditWebhook = (tool: WebhookTool) => {
    const updated = webhookTools.map((t) => (t.name === tool.name ? tool : t));
    saveMutation.mutate([...systemTools, ...updated], {
      onSuccess: () => {
        toast({ title: "Ferramenta atualizada" });
        setEditingTool(null);
      },
    });
  };

  const handleDeleteWebhook = (name: string) => {
    const updated = webhookTools.filter((t) => t.name !== name);
    saveMutation.mutate([...systemTools, ...updated], {
      onSuccess: () => toast({ title: "Ferramenta removida" }),
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg md:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              Ferramentas do Agente — {campaignName}
            </SheetTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
              {agentId}
            </p>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="mt-6 space-y-6">

              {/* ── Ferramentas do Sistema ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="size-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Ferramentas do sistema
                  </h3>
                  <Badge variant="outline" className="rounded-full text-xs">
                    {activeSystemNames.size} ativas
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Permite que o agente execute ações integradas.
                </p>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                  {ALL_SYSTEM_TOOLS.map((tool) => {
                    const isActive = activeSystemNames.has(tool.name);
                    return (
                      <div
                        key={tool.name}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {tool.label}
                            </span>
                            {tool.alpha && (
                              <Badge
                                variant="outline"
                                className="rounded-full text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400"
                              >
                                Alpha
                              </Badge>
                            )}
                          </div>
                        </div>
                        {pendingSystemTool === tool.name ? (
                          <Loader2 className="size-4 animate-spin text-slate-400 shrink-0" />
                        ) : (
                          <Switch
                            checked={isActive}
                            disabled={saveMutation.isPending}
                            onCheckedChange={(v) => toggleSystemTool(tool.name, v)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Ferramentas Webhook ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Webhook className="size-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Webhooks
                  </h3>
                  <Badge
                    variant="outline"
                    className="rounded-full text-xs border-violet-200 text-violet-600 dark:border-violet-700 dark:text-violet-400"
                  >
                    {webhookTools.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Chamadas a URLs externas que o agente pode fazer durante a conversa.
                </p>

                {webhookTools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                    <AlertCircle className="mb-2 size-6 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhum webhook configurado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {webhookTools.map((tool) => (
                      <div
                        key={tool.name}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-4",
                          "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {tool.name}
                          </span>
                          {tool.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {tool.description}
                            </p>
                          )}
                          {(tool.api_schema?.url || tool.api_schema?.method) && (
                            <p className="mt-1 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {tool.api_schema?.method} {tool.api_schema?.url}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-xl p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            onClick={() => setEditingTool(tool)}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-xl p-0 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            onClick={() => handleDeleteWebhook(tool.name)}
                            disabled={saveMutation.isPending}
                          >
                            {saveMutation.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full gap-2 rounded-2xl"
                  variant="outline"
                  onClick={openAddDialog}
                >
                  <Plus className="size-4" />
                  Adicionar webhook
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog: adicionar ferramenta */}
      <Dialog open={addOpen} onOpenChange={(v) => !v && setAddOpen(false)}>
        <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <DialogTitle className="text-base">Adicionar ferramenta</DialogTitle>
          </DialogHeader>

          {/* Abas */}
          <div className="px-6 pt-4 shrink-0">
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 gap-1 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setAddTab("library")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                  addTab === "library"
                    ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                )}
              >
                <Library className="size-3.5" />
                Biblioteca
              </button>
              <button
                type="button"
                onClick={() => setAddTab("new")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                  addTab === "new"
                    ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                )}
              >
                <Plus className="size-3.5" />
                Nova ferramenta
              </button>
            </div>
          </div>

          {/* Conteúdo com scroll próprio */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {addTab === "library" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Pesquisar ferramentas..."
                    className="pl-9"
                  />
                </div>

                {workspaceLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-slate-400" />
                  </div>
                ) : (workspaceData?.tools ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Library className="mb-3 size-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-500">Nenhuma ferramenta na biblioteca</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Crie ferramentas no ElevenLabs ou use a aba "Nova ferramenta"
                    </p>
                  </div>
                ) : (() => {
                  const alreadyAdded = new Set(webhookTools.map((t) => t.name));
                  const search = librarySearch.toLowerCase();
                  const filtered = (workspaceData?.tools ?? []).filter(
                    (t) =>
                      t.name.toLowerCase().includes(search) ||
                      (t.description ?? "").toLowerCase().includes(search),
                  );
                  return filtered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">Nenhum resultado para "{librarySearch}"</p>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((wt) => {
                        const added = alreadyAdded.has(wt.name);
                        const isPending = addingLibraryTool === wt.tool_id;
                        return (
                          <div
                            key={wt.tool_id}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                              added
                                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-900/10"
                                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {wt.name}
                                </p>
                                {wt.type && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-[10px] px-1.5 py-0 shrink-0"
                                  >
                                    {wt.type === "api_integration_webhook" ? "integração" : wt.type}
                                  </Badge>
                                )}
                              </div>
                              {wt.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                  {wt.description}
                                </p>
                              )}
                              {wt.api_schema?.url && (
                                <p className="font-mono text-[10px] text-slate-400 truncate mt-1">
                                  {wt.api_schema.method ?? "GET"} {wt.api_schema.url}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={added ? "outline" : "default"}
                              className={cn(
                                "shrink-0 rounded-xl gap-1.5 min-w-[90px]",
                                added && "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
                              )}
                              disabled={added || isPending || saveMutation.isPending}
                              onClick={() => !added && handleAddFromLibrary(wt)}
                            >
                              {isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : added ? (
                                <><Check className="size-3.5" />Adicionada</>
                              ) : (
                                <><Plus className="size-3.5" />Adicionar</>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <WebhookForm
                onSave={handleAddWebhook}
                onCancel={() => setAddOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar webhook */}
      <Dialog open={!!editingTool} onOpenChange={(v) => !v && setEditingTool(null)}>
        <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <DialogTitle className="text-base">Editar webhook</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {editingTool && (
              <WebhookForm
                key={editingTool.name}
                initial={editingTool}
                onSave={handleEditWebhook}
                onCancel={() => setEditingTool(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
