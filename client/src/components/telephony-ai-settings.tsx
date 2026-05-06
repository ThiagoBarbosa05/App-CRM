import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Phone,
  Bot,
  Server,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  ShieldAlert,
  Radio,
  Copy,
  Trash2,
  Plus,
  Info,
  Settings2,
  Webhook,
  Sparkles,
} from "lucide-react";
import { AgentConfigModal } from "@/components/telemarketing/agent-config-modal";
import { AgentToolsModal } from "@/components/telemarketing/agent-tools-modal";

// ─── Schema e form de criação de agente ──────────────────────────────────────

const createAgentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().optional(),
  firstMessage: z.string().optional(),
  language: z.string().min(1),
  voiceId: z.string().optional(),
  llm: z.string().min(1),
});
type CreateAgentForm = z.infer<typeof createAgentSchema>;

const LANGUAGES = [
  { value: "pt-br", label: "Português (Brasil)" },
  { value: "pt", label: "Português (Portugal)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

const LLM_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (multilíngue, recomendado)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (multilíngue, rápido)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4 (multilíngue)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (multilíngue, rápido)" },
  { value: "gpt-4.1", label: "GPT-4.1 (inglês)" },
  { value: "gpt-4o", label: "GPT-4o (inglês)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (inglês)" },
];

function CreateAgentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (agentId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { language: "pt-br", llm: "gemini-2.5-flash" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      const res = await fetch("/api/elevenlabs/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao criar agente");
      }
      return res.json() as Promise<{ agentId: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Agente criado com sucesso", description: `ID: ${data.agentId}` });
      reset();
      onCreated(data.agentId);
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao criar agente", description: err.message, variant: "destructive" }),
  });

  const language = watch("language");
  const llm = watch("llm");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            Criar novo agente ElevenLabs
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Nome do agente *</Label>
              <Input {...register("name")} placeholder="Ex: Agente de Vendas" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Primeira mensagem</Label>
              <Input {...register("firstMessage")} placeholder="Olá, posso te ajudar?" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Idioma</Label>
              <Select value={language} onValueChange={(v) => setValue("language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Voice ID (opcional)</Label>
              <Input {...register("voiceId")} placeholder="Voz padrão do ElevenLabs" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Modelo LLM</Label>
              <Select value={llm} onValueChange={(v) => setValue("llm", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LLM_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Para Português e outros idiomas não-ingleses use <strong>Gemini</strong> ou <strong>Claude</strong>. GPT-4o só suporta inglês.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">System Prompt</Label>
              <Textarea
                {...register("prompt")}
                placeholder="Você é um assistente de vendas..."
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <Sparkles className="size-4" />}
              Criar agente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const telephonySchema = z.object({
  twilio_account_sid: z.string().optional().default(""),
  twilio_auth_token: z.string().optional().default(""),
  twilio_from_number: z.string().optional().default(""),
  twilio_api_key: z.string().optional().default(""),
  twilio_api_secret: z.string().optional().default(""),
  twilio_twiml_app_sid: z.string().optional().default(""),
  twilio_status_callback_url: z.string().optional().default(""),
  twilio_record_calls: z.boolean().optional().default(false),
  twilio_from_numbers: z.string().optional().default(""),
  twilio_intelligence_service_sid: z.string().optional().default(""),
  elevenlabs_api_key: z.string().optional().default(""),
  elevenlabs_voice_id: z.string().optional().default(""),
  server_base_url: z.string().optional().default(""),
});

type TelephonyForm = z.infer<typeof telephonySchema>;

type StatusResponse = {
  twilio: boolean;
  elevenlabs: boolean;
  voiceSdk: boolean;
};

type SettingsResponse = Record<string, string>;

type Channel = { label: string; number: string };

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1.5"
          : "border-slate-300/60 bg-slate-100/60 text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-400 gap-1.5"
      }
    >
      {active ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <XCircle className="size-3.5" />
      )}
      {label}
    </Badge>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Label>
      {children}
      {hint && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function ReadOnlyWithCopy({ value, label }: { value: string; label: string }) {
  function copy() {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      toast({ title: "Copiado!", description: value });
    });
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 truncate"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          className="shrink-0"
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function TelephonyAISettings() {
  const { data: status, isLoading: statusLoading } = useQuery<StatusResponse>({
    queryKey: ["/api/telephony-settings/status"],
    queryFn: async () => {
      const res = await fetch("/api/telephony-settings/status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar status");
      return res.json();
    },
  });

  const { data: settings, isLoading: settingsLoading } =
    useQuery<SettingsResponse>({
      queryKey: ["/api/telephony-settings"],
      queryFn: async () => {
        const res = await fetch("/api/telephony-settings", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Erro ao buscar configurações");
        return res.json();
      },
    });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<TelephonyForm>({
    resolver: zodResolver(telephonySchema),
    values: settings
      ? {
          twilio_account_sid: settings.twilio_account_sid ?? "",
          twilio_auth_token: settings.twilio_auth_token ?? "",
          twilio_from_number: settings.twilio_from_number ?? "",
          twilio_api_key: settings.twilio_api_key ?? "",
          twilio_api_secret: settings.twilio_api_secret ?? "",
          twilio_twiml_app_sid: settings.twilio_twiml_app_sid ?? "",
          twilio_status_callback_url:
            settings.twilio_status_callback_url ?? "",
          twilio_record_calls: settings.twilio_record_calls === "true",
          twilio_from_numbers: settings.twilio_from_numbers ?? "",
          twilio_intelligence_service_sid:
            settings.twilio_intelligence_service_sid ?? "",
          elevenlabs_api_key: settings.elevenlabs_api_key ?? "",
          elevenlabs_voice_id: settings.elevenlabs_voice_id ?? "",
          server_base_url: settings.server_base_url ?? "",
        }
      : undefined,
  });

  // Channels state (replaces raw JSON input)
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newChannelLabel, setNewChannelLabel] = useState("");
  const [newChannelNumber, setNewChannelNumber] = useState("");

  // Agent management state
  const [agentIdInput, setAgentIdInput] = useState("");
  const [agentConfigOpen, setAgentConfigOpen] = useState(false);
  const [agentToolsOpen, setAgentToolsOpen] = useState(false);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);

  useEffect(() => {
    if (!settings?.twilio_from_numbers) return;
    try {
      const parsed = JSON.parse(settings.twilio_from_numbers);
      if (Array.isArray(parsed)) setChannels(parsed);
    } catch {
      // ignore malformed JSON
    }
  }, [settings?.twilio_from_numbers]);

  function addChannel() {
    if (!newChannelLabel.trim() || !newChannelNumber.trim()) return;
    const updated = [
      ...channels,
      { label: newChannelLabel.trim(), number: newChannelNumber.trim() },
    ];
    setChannels(updated);
    setNewChannelLabel("");
    setNewChannelNumber("");
  }

  function removeChannel(index: number) {
    setChannels(channels.filter((_, i) => i !== index));
  }

  const saveMutation = useMutation({
    mutationFn: async (data: TelephonyForm) => {
      const body: Record<string, string> = {
        twilio_account_sid: data.twilio_account_sid ?? "",
        twilio_auth_token: data.twilio_auth_token ?? "",
        twilio_from_number: data.twilio_from_number ?? "",
        twilio_api_key: data.twilio_api_key ?? "",
        twilio_api_secret: data.twilio_api_secret ?? "",
        twilio_twiml_app_sid: data.twilio_twiml_app_sid ?? "",
        twilio_status_callback_url: data.twilio_status_callback_url ?? "",
        twilio_record_calls: data.twilio_record_calls ? "true" : "false",
        twilio_from_numbers: JSON.stringify(channels),
        twilio_intelligence_service_sid:
          data.twilio_intelligence_service_sid ?? "",
        elevenlabs_api_key: data.elevenlabs_api_key ?? "",
        elevenlabs_voice_id: data.elevenlabs_voice_id ?? "",
        server_base_url: data.server_base_url ?? "",
      };

      const res = await fetch("/api/telephony-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/telephony-settings"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/telephony-settings/status"],
      });
      toast({
        title: "Configurações salvas",
        description: "As credenciais de telefonia foram atualizadas.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const configureVoiceUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/telephony-settings/configure-voice-url", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao configurar Voice URL");
      }
      return res.json() as Promise<{ success: boolean; voiceUrl: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Voice URL configurada",
        description: `TwiML App atualizado com: ${data.voiceUrl}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao configurar Voice URL",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = settingsLoading || statusLoading;
  const recordCalls = watch("twilio_record_calls");
  const serverBaseUrl = watch("server_base_url") ?? "";
  const voiceUrl = serverBaseUrl ? `${serverBaseUrl}/api/twilio/voice` : "";
  const transcriptionWebhookUrl = serverBaseUrl
    ? `${serverBaseUrl}/api/elevenlabs/webhook`
    : "";

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
      <div className="space-y-6">
        {/* Status das integrações */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="size-4 text-slate-500" />
              Status das Integrações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <StatusBadge
                active={status?.twilio ?? false}
                label="Twilio (core)"
              />
              <StatusBadge
                active={status?.voiceSdk ?? false}
                label="Twilio Voice SDK"
              />
              <StatusBadge
                active={status?.elevenlabs ?? false}
                label="ElevenLabs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Servidor */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="size-4 text-slate-500" />
              Servidor
            </CardTitle>
            <CardDescription>
              URL pública do backend acessível pela internet (sem barra final).
              Usada pelos webhooks do Twilio e ElevenLabs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FieldGroup
              label="Server Base URL"
              hint="Ex: https://meucrm.com.br"
            >
              <Input
                {...register("server_base_url")}
                placeholder="https://meucrm.com.br"
              />
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Voice SDK */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="size-4 text-slate-500" />
                Voice SDK (Áudio no Navegador)
              </CardTitle>
              <StatusBadge
                active={status?.voiceSdk ?? false}
                label={status?.voiceSdk ? "Configurado" : "Não configurado"}
              />
            </div>
            <CardDescription>
              Credenciais para o SDK de voz do Twilio no browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FieldGroup
              label="API Key SID"
              hint="Criada em console.twilio.com > Account > API keys & tokens"
            >
              <Input
                {...register("twilio_api_key")}
                placeholder="SKxxxxxxxxxxxxxxxx"
              />
            </FieldGroup>

            <FieldGroup label="API Secret">
              <div className="relative">
                <Input
                  {...register("twilio_api_secret")}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <ShieldAlert className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exibido apenas uma vez ao criar a API Key
              </p>
            </FieldGroup>

            <FieldGroup
              label="TwiML App SID"
              hint="Criado em console.twilio.com > Voice > TwiML Apps"
            >
              <Input
                {...register("twilio_twiml_app_sid")}
                placeholder="APxxxxxxxxxxxxxxxx"
              />
            </FieldGroup>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                URL Pública do Servidor
              </Label>
              <Input
                readOnly
                value={voiceUrl}
                placeholder="Preencha o Server Base URL acima"
                className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 truncate"
              />
              {voiceUrl && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Voice URL: {voiceUrl}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 rounded-2xl"
                disabled={
                  configureVoiceUrlMutation.isPending || !status?.voiceSdk
                }
                onClick={() => configureVoiceUrlMutation.mutate()}
              >
                {configureVoiceUrlMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Radio className="size-4" />
                )}
                Configurar Voice URL no Twilio
              </Button>
              {!status?.voiceSdk && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 text-center">
                  Salve as credenciais do Voice SDK antes de configurar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Voice Intelligence */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="size-4 text-slate-500" />
              Voice Intelligence (Transcrição Nativa)
            </CardTitle>
            <CardDescription>
              Serviço do Twilio para transcrição de chamadas humanas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FieldGroup
              label="Intelligence Service SID"
              hint="Console Twilio → Voice Intelligence → Services. Começa com GA. Configure o idioma como pt-br."
            >
              <Input
                {...register("twilio_intelligence_service_sid")}
                placeholder="GAxxxxxxxxxxxxxxxx"
              />
            </FieldGroup>

            <ReadOnlyWithCopy
              label="URL do Webhook de Transcrição"
              value={transcriptionWebhookUrl}
            />
            {transcriptionWebhookUrl && (
              <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 -mt-3">
                Cole esta URL no campo webhook URL do seu Intelligence Service no Console Twilio.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ElevenLabs */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bot className="size-4 text-slate-500" />
                ElevenLabs
              </CardTitle>
              <StatusBadge
                active={status?.elevenlabs ?? false}
                label={status?.elevenlabs ? "Configurado" : "Não configurado"}
              />
            </div>
            <CardDescription>
              Agente de IA para discagem automática.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FieldGroup
              label="API Key"
              hint="Gerada em elevenlabs.io/app/account"
            >
              <div className="relative">
                <Input
                  {...register("elevenlabs_api_key")}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <ShieldAlert className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              </div>
            </FieldGroup>

            <FieldGroup
              label="Voice ID (Voz Clonada — Padrão Global)"
              hint="Encontrado em elevenlabs.io/app/voice-lab. Pode ser sobrescrito por campanha."
            >
              <Input
                {...register("elevenlabs_voice_id")}
                placeholder="Ex: 21m00Tcm4TlvDq8ikWAM"
              />
            </FieldGroup>

          </CardContent>
        </Card>

        {/* Gerenciamento de Agente ElevenLabs */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="size-4 text-violet-500" />
              Configurar Agente ElevenLabs
            </CardTitle>
            <CardDescription>
              Gerencie o prompt, voz, primeira mensagem e ferramentas de qualquer agente sem sair do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Criar novo agente */}
            <div className="flex items-center justify-between rounded-2xl border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Novo agente</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Crie um agente diretamente pelo sistema</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                disabled={!status?.elevenlabs}
                onClick={() => setCreateAgentOpen(true)}
              >
                <Plus className="size-3.5" />
                Criar agente
              </Button>
            </div>

            {/* Gerenciar agente existente */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Ou gerencie um agente existente
              </Label>
              <Input
                value={agentIdInput}
                onChange={(e) => setAgentIdInput(e.target.value.trim())}
                placeholder="agent_xxxxxxxxxxxxxxxx"
                className="font-mono"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cole o Agent ID para configurar o prompt, voz e ferramentas.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2 rounded-2xl border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-900/20"
                disabled={!agentIdInput || !status?.elevenlabs}
                onClick={() => setAgentConfigOpen(true)}
              >
                <Settings2 className="size-4" />
                Configurar agente
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2 rounded-2xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                disabled={!agentIdInput || !status?.elevenlabs}
                onClick={() => setAgentToolsOpen(true)}
              >
                <Webhook className="size-4" />
                Ferramentas
              </Button>
            </div>

            {!status?.elevenlabs && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2">
                <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Configure e salve a API Key do ElevenLabs acima para habilitar o gerenciamento de agentes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gravação de Chamadas */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="size-4 text-slate-500" />
                Gravação de Chamadas
              </CardTitle>
              <Badge
                variant="outline"
                className={
                  recordCalls
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5"
                    : "border-slate-300/60 bg-slate-100/60 text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-400 gap-1.5"
                }
              >
                {recordCalls ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                {recordCalls ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <CardDescription>
              Gravar automaticamente as ligações via Twilio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="twilio_record_calls"
                checked={recordCalls ?? false}
                onCheckedChange={(v) => setValue("twilio_record_calls", v)}
              />
              <div>
                <Label
                  htmlFor="twilio_record_calls"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Gravar chamadas automaticamente
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quando ativado, todas as chamadas feitas via Twilio serão gravadas.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Aviso legal
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A gravação de chamadas pode estar sujeita a regulamentações locais. Em muitas
                jurisdições brasileiras, é necessário informar ao interlocutor que a ligação está
                sendo gravada. Certifique-se de estar em conformidade com a LGPD e demais
                legislações aplicáveis.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Canais de Saída */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="size-4 text-slate-500" />
                Canais de Saída
              </CardTitle>
              <Badge
                variant="outline"
                className="border-slate-300/60 bg-slate-100/60 text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300 gap-1"
              >
                {channels.length} canal{channels.length !== 1 ? "is" : ""}
              </Badge>
            </div>
            <CardDescription>
              Números disponíveis para o operador escolher no discador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channels.map((ch, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {ch.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ch.number}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() => removeChannel(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nome (ex: Vendas)"
                value={newChannelLabel}
                onChange={(e) => setNewChannelLabel(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="+5511999999999"
                value={newChannelNumber}
                onChange={(e) => setNewChannelNumber(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={addChannel}
              >
                <Plus className="size-4" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Twilio Core */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="size-4 text-slate-500" />
                Twilio
              </CardTitle>
              <StatusBadge
                active={status?.twilio ?? false}
                label={status?.twilio ? "Configurado" : "Não configurado"}
              />
            </div>
            <CardDescription>
              Credenciais principais de acesso à API do Twilio.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FieldGroup
              label="Account SID"
              hint="Encontrado em console.twilio.com"
            >
              <Input
                {...register("twilio_account_sid")}
                placeholder="ACxxxxxxxxxxxxxxxx"
              />
            </FieldGroup>

            <FieldGroup label="Auth Token">
              <div className="relative">
                <Input
                  {...register("twilio_auth_token")}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <ShieldAlert className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              </div>
            </FieldGroup>

            <FieldGroup
              label="From Number"
              hint="Número comprado no Twilio (E.164)"
            >
              <Input
                {...register("twilio_from_number")}
                placeholder="+5511999999999"
              />
            </FieldGroup>

            <FieldGroup
              label="Status Callback URL"
              hint="Para receber eventos de chamada"
            >
              <Input
                {...register("twilio_status_callback_url")}
                placeholder="https://meucrm.com.br/api/calls/twilio-status"
              />
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saveMutation.isPending || isSubmitting}
            className="gap-2 rounded-2xl px-6"
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar configurações
          </Button>
        </div>
      </div>

      {agentConfigOpen && agentIdInput && (
        <AgentConfigModal
          open={agentConfigOpen}
          onClose={() => setAgentConfigOpen(false)}
          agentId={agentIdInput}
          campaignName="Configurações"
        />
      )}

      {agentToolsOpen && agentIdInput && (
        <AgentToolsModal
          open={agentToolsOpen}
          onClose={() => setAgentToolsOpen(false)}
          agentId={agentIdInput}
          campaignName="Configurações"
        />
      )}

      <CreateAgentDialog
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={(id) => setAgentIdInput(id)}
      />
    </form>
  );
}
