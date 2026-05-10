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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Mic,
  ChevronsUpDown,
  Check,
  RefreshCw,
  Pencil,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { AgentConfigModal } from "@/components/telemarketing/agent-config-modal";
import { AgentToolsModal } from "@/components/telemarketing/agent-tools-modal";
import { VoiceSelector } from "@/components/voice-selector";
import { VoiceCloneDialog } from "@/components/voice-clone-dialog";

// ─── Dialog de criação de Voice Intelligence Service ─────────────────────────

const INTELLIGENCE_LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "es-MX", label: "Español (México)" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "it-IT", label: "Italiano" },
];

const createIntelligenceSchema = z.object({
  uniqueName: z
    .string()
    .min(1, "Nome único é obrigatório")
    .regex(/^[a-z0-9_-]+$/, "Apenas letras minúsculas, números, _ e -"),
  friendlyName: z.string().optional().default(""),
  languageCode: z.string().min(1),
  autoTranscribe: z.boolean().default(true),
  autoRedaction: z.boolean().default(false),
  webhookUrl: z.string().optional().default(""),
});
type CreateIntelligenceForm = z.infer<typeof createIntelligenceSchema>;

// ─── Painel de Language Operators ────────────────────────────────────────────

type OperatorInfo = {
  sid: string;
  friendlyName: string;
  description: string;
  operatorType: string;
  availability: string;
  author: string;
  attached: boolean;
};

function OperatorsPanel({ serviceSid }: { serviceSid: string }) {
  const {
    data: operators,
    isLoading,
    refetch,
  } = useQuery<OperatorInfo[]>({
    queryKey: ["/api/twilio/intelligence-services", serviceSid, "operators"],
    queryFn: async () => {
      const res = await fetch(
        `/api/twilio/intelligence-services/${serviceSid}/operators`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Erro ao listar operadores");
      return res.json();
    },
    staleTime: 30_000,
  });

  const attachMutation = useMutation({
    mutationFn: async (operatorSid: string) => {
      const res = await fetch(
        `/api/twilio/intelligence-services/${serviceSid}/operators/${operatorSid}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao adicionar operador");
      }
    },
    onSuccess: () => void refetch(),
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const detachMutation = useMutation({
    mutationFn: async (operatorSid: string) => {
      const res = await fetch(
        `/api/twilio/intelligence-services/${serviceSid}/operators/${operatorSid}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao remover operador");
      }
    },
    onSuccess: () => void refetch(),
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const isPending = attachMutation.isPending || detachMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
        <Loader2 className="size-4 animate-spin" /> Carregando operadores...
      </div>
    );
  }

  if (!operators?.length) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
        Nenhum operador pré-criado disponível na conta.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {operators.map((op) => (
        <div
          key={op.sid}
          className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
            op.attached
              ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {op.friendlyName}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal"
              >
                {op.operatorType === "conversation-intelligence"
                  ? "Classificação"
                  : op.operatorType}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal text-slate-400"
              >
                {op.author}
              </Badge>
            </div>
            {op.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {op.description}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant={op.attached ? "destructive" : "outline"}
            className="shrink-0 rounded-lg text-xs h-7 px-2.5 gap-1"
            disabled={isPending}
            onClick={() =>
              op.attached
                ? detachMutation.mutate(op.sid)
                : attachMutation.mutate(op.sid)
            }
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : op.attached ? (
              <Trash2 className="size-3" />
            ) : (
              <Plus className="size-3" />
            )}
            {op.attached ? "Remover" : "Adicionar"}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Dialog de criação de Voice Intelligence Service ─────────────────────────

function CreateIntelligenceDialog({
  open,
  onClose,
  onCreated,
  defaultWebhookUrl,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultWebhookUrl: string;
}) {
  const [createdSid, setCreatedSid] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateIntelligenceForm>({
    resolver: zodResolver(createIntelligenceSchema),
    defaultValues: {
      uniqueName: "",
      friendlyName: "",
      languageCode: "pt-BR",
      autoTranscribe: true,
      autoRedaction: false,
      webhookUrl: defaultWebhookUrl,
    },
  });

  useEffect(() => {
    if (open) {
      setCreatedSid(null);
      reset({
        uniqueName: "",
        friendlyName: "",
        languageCode: "pt-BR",
        autoTranscribe: true,
        autoRedaction: false,
        webhookUrl: defaultWebhookUrl,
      });
    }
  }, [open, defaultWebhookUrl, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateIntelligenceForm) => {
      const res = await fetch("/api/twilio/intelligence-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao criar serviço");
      }
      return res.json() as Promise<{ sid: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Serviço criado com sucesso" });
      onCreated();
      setCreatedSid(data.sid);
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao criar serviço",
        description: err.message,
        variant: "destructive",
      }),
  });

  function handleFinish() {
    setCreatedSid(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && (createdSid ? handleFinish() : onClose())}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="size-4 text-emerald-500" />
            {createdSid
              ? "Adicionar operadores"
              : "Criar serviço de Voice Intelligence"}
          </DialogTitle>
        </DialogHeader>

        {createdSid ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Serviço criado. Adicione Language Operators para análise
              automática das transcrições, ou clique em Concluir para pular esta
              etapa.
            </p>
            <OperatorsPanel serviceSid={createdSid} />
            <DialogFooter>
              <Button onClick={handleFinish} className="gap-2">
                <Check className="size-4" />
                Concluir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome único *</Label>
              <Input
                {...register("uniqueName")}
                placeholder="crm-transcricao-ptbr"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apenas letras minúsculas, números, _ e -. Não pode ser alterado
                depois.
              </p>
              {errors.uniqueName && (
                <p className="text-xs text-red-500">
                  {errors.uniqueName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome de exibição</Label>
              <Input
                {...register("friendlyName")}
                placeholder="CRM Transcrição PT-BR"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Idioma *</Label>
              <Select
                value={watch("languageCode")}
                onValueChange={(v) => setValue("languageCode", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTELLIGENCE_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Idioma das transcrições. Não pode ser alterado após a criação.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">URL do Webhook</Label>
              <Input {...register("webhookUrl")} placeholder="https://..." />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pré-preenchido com a URL de transcrição do sistema.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Opções
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Transcrição automática
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Transcreve todas as gravações automaticamente
                  </p>
                </div>
                <Switch
                  checked={watch("autoTranscribe")}
                  onCheckedChange={(v) => setValue("autoTranscribe", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Redação de dados pessoais (PII)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Oculta CPF, cartões e telefones nas transcrições
                  </p>
                </div>
                <Switch
                  checked={watch("autoRedaction")}
                  onCheckedChange={(v) => setValue("autoRedaction", v)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Criar serviço
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog de edição de Voice Intelligence Service ──────────────────────────

type IntelligenceService = {
  sid: string;
  uniqueName: string;
  friendlyName: string;
  languageCode: string;
  autoTranscribe: boolean;
  autoRedaction: boolean;
  webhookUrl: string;
  dateUpdated: string;
};

const editIntelligenceSchema = z.object({
  friendlyName: z.string().optional().default(""),
  autoTranscribe: z.boolean().default(true),
  autoRedaction: z.boolean().default(false),
  webhookUrl: z.string().optional().default(""),
});
type EditIntelligenceForm = z.infer<typeof editIntelligenceSchema>;

function EditIntelligenceDialog({
  open,
  onClose,
  onUpdated,
  service,
}: {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  service: IntelligenceService | null;
}) {
  const { register, handleSubmit, watch, setValue, reset } =
    useForm<EditIntelligenceForm>({
      resolver: zodResolver(editIntelligenceSchema),
      defaultValues: {
        friendlyName: "",
        autoTranscribe: true,
        autoRedaction: false,
        webhookUrl: "",
      },
    });

  useEffect(() => {
    if (open && service) {
      reset({
        friendlyName: service.friendlyName ?? "",
        autoTranscribe: service.autoTranscribe,
        autoRedaction: service.autoRedaction,
        webhookUrl: service.webhookUrl ?? "",
      });
    }
  }, [open, service, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditIntelligenceForm) => {
      const res = await fetch(
        `/api/twilio/intelligence-services/${service!.sid}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao atualizar serviço");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Serviço atualizado com sucesso" });
      onUpdated();
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao atualizar serviço",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-blue-500" />
            Editar serviço de Voice Intelligence
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
          className="space-y-4 mt-2"
        >
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nome único (imutável)
            </p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200">
              {service?.uniqueName}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Idioma (imutável)
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {INTELLIGENCE_LANGUAGES.find(
                (l) => l.value === service?.languageCode,
              )?.label ?? service?.languageCode}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nome de exibição</Label>
            <Input
              {...register("friendlyName")}
              placeholder="CRM Transcrição PT-BR"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">URL do Webhook</Label>
            <Input {...register("webhookUrl")} placeholder="https://..." />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Opções
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Transcrição automática
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transcreve todas as gravações automaticamente
                </p>
              </div>
              <Switch
                checked={watch("autoTranscribe")}
                onCheckedChange={(v) => setValue("autoTranscribe", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Redação de dados pessoais (PII)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Oculta CPF, cartões e telefones nas transcrições
                </p>
              </div>
              <Switch
                checked={watch("autoRedaction")}
                onCheckedChange={(v) => setValue("autoRedaction", v)}
              />
            </div>
          </div>

          {service && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Language Operators
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Operadores analisam as transcrições e extraem informações
                estruturadas. As alterações são aplicadas imediatamente.
              </p>
              <OperatorsPanel serviceSid={service.sid} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog de criação de TwiML App ──────────────────────────────────────────

const createTwimlAppSchema = z.object({
  friendlyName: z.string().min(1, "Nome é obrigatório"),
  voiceUrl: z.string().optional().default(""),
  voiceMethod: z.enum(["POST", "GET"]).default("POST"),
  voiceFallbackUrl: z.string().optional().default(""),
  voiceFallbackMethod: z.enum(["POST", "GET"]).default("POST"),
  statusCallback: z.string().optional().default(""),
  statusCallbackMethod: z.enum(["POST", "GET"]).default("POST"),
  voiceCallerIdLookup: z.boolean().default(false),
  publicApplicationConnectEnabled: z.boolean().default(false),
});
type CreateTwimlAppForm = z.infer<typeof createTwimlAppSchema>;

function CreateTwimlAppDialog({
  open,
  onClose,
  onCreated,
  defaultVoiceUrl,
  defaultStatusCallback,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (app: {
    sid: string;
    friendlyName: string;
    voiceUrl: string;
  }) => void;
  defaultVoiceUrl: string;
  defaultStatusCallback: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTwimlAppForm>({
    resolver: zodResolver(createTwimlAppSchema),
    defaultValues: {
      friendlyName: "CRM Voice App",
      voiceUrl: defaultVoiceUrl,
      voiceMethod: "POST",
      voiceFallbackUrl: "",
      voiceFallbackMethod: "POST",
      statusCallback: defaultStatusCallback,
      statusCallbackMethod: "POST",
      voiceCallerIdLookup: false,
      publicApplicationConnectEnabled: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        friendlyName: "CRM Voice App",
        voiceUrl: defaultVoiceUrl,
        voiceMethod: "POST",
        voiceFallbackUrl: "",
        voiceFallbackMethod: "POST",
        statusCallback: defaultStatusCallback,
        statusCallbackMethod: "POST",
        voiceCallerIdLookup: false,
        publicApplicationConnectEnabled: false,
      });
    }
  }, [open, defaultVoiceUrl, defaultStatusCallback, reset]);

  const [showOptional, setShowOptional] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: CreateTwimlAppForm) => {
      const res = await fetch("/api/twilio/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao criar app");
      }
      return res.json() as Promise<{
        sid: string;
        friendlyName: string;
        voiceUrl: string;
      }>;
    },
    onSuccess: (data) => {
      toast({ title: "TwiML App criado", description: `SID: ${data.sid}` });
      onCreated(data);
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao criar app",
        description: err.message,
        variant: "destructive",
      }),
  });

  const voiceCallerIdLookup = watch("voiceCallerIdLookup");
  const publicApplicationConnectEnabled = watch(
    "publicApplicationConnectEnabled",
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="size-4 text-blue-500" />
            Criar novo TwiML App
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((d) => createMutation.mutate(d))}
          className="space-y-5 mt-2"
        >
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nome *</Label>
            <Input {...register("friendlyName")} placeholder="CRM Voice App" />
            {errors.friendlyName && (
              <p className="text-xs text-red-500">
                {errors.friendlyName.message}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Configuração de Voz
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-sm">URL da Requisição</Label>
                <Input {...register("voiceUrl")} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Método</Label>
                <Select
                  value={watch("voiceMethod")}
                  onValueChange={(v) =>
                    setValue("voiceMethod", v as "POST" | "GET")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">HTTP POST</SelectItem>
                    <SelectItem value="GET">HTTP GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              onClick={() => setShowOptional((v) => !v)}
            >
              <ChevronsUpDown className="size-3.5" />
              {showOptional ? "Ocultar" : "Mostrar"} configurações opcionais
            </button>

            {showOptional && (
              <div className="space-y-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-sm">URL de Fallback</Label>
                    <Input
                      {...register("voiceFallbackUrl")}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Method</Label>
                    <Select
                      value={watch("voiceFallbackMethod")}
                      onValueChange={(v) =>
                        setValue("voiceFallbackMethod", v as "POST" | "GET")
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">HTTP POST</SelectItem>
                        <SelectItem value="GET">HTTP GET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-sm">URL de Status Callback</Label>
                    <Input
                      {...register("statusCallback")}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Method</Label>
                    <Select
                      value={watch("statusCallbackMethod")}
                      onValueChange={(v) =>
                        setValue("statusCallbackMethod", v as "POST" | "GET")
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">HTTP POST</SelectItem>
                        <SelectItem value="GET">HTTP GET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">
                      Consulta de Nome do Caller
                    </Label>
                    <Switch
                      checked={voiceCallerIdLookup}
                      onCheckedChange={(v) =>
                        setValue("voiceCallerIdLookup", v)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">
                        Permitir discagem de outras contas Twilio
                      </Label>
                    </div>
                    <Switch
                      checked={publicApplicationConnectEnabled}
                      onCheckedChange={(v) =>
                        setValue("publicApplicationConnectEnabled", v)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Criar app
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schema e form de criação de agente ──────────────────────────────────────

const createAgentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().optional(),
  firstMessage: z.string().optional(),
  language: z.string().min(1),
  voiceId: z.string().optional(),
  llm: z.string().min(1),
  interruptible: z.boolean().optional().default(true),
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
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (multilíngue, recomendado)",
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite (multilíngue, rápido)",
  },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4 (multilíngue)" },
  {
    value: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 (multilíngue, rápido)",
  },
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
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao criar agente");
      }
      return res.json() as Promise<{ agentId: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Agente criado com sucesso",
        description: `ID: ${data.agentId}`,
      });
      reset();
      onCreated(data.agentId);
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao criar agente",
        description: err.message,
        variant: "destructive",
      }),
  });

  const language = watch("language");
  const llm = watch("llm");
  const interruptible = watch("interruptible");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            Criar novo agente ElevenLabs
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((d) => createMutation.mutate(d))}
          className="space-y-4 mt-2"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Nome do agente *</Label>
              <Input {...register("name")} placeholder="Ex: Agente de Vendas" />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Primeira mensagem</Label>
              <Input
                {...register("firstMessage")}
                placeholder="Olá, posso te ajudar?"
              />
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Interrompível
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Permite que o usuário interrompa a fala do agente
                  </p>
                </div>
                <Switch
                  checked={interruptible ?? true}
                  onCheckedChange={(v) => setValue("interruptible", v)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Idioma</Label>
              <Select
                value={language}
                onValueChange={(v) => setValue("language", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Voz (opcional)</Label>
              <VoiceSelector
                value={watch("voiceId")}
                onChange={(id) => setValue("voiceId", id)}
                placeholder="Voz padrão do ElevenLabs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Modelo LLM</Label>
              <Select value={llm} onValueChange={(v) => setValue("llm", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Para Português e outros idiomas não-ingleses use{" "}
                <strong>Gemini</strong> ou <strong>Claude</strong>. GPT-4o só
                suporta inglês.
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
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
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
  hintVariant = "default",
  children,
}: {
  label: string;
  hint?: string;
  hintVariant?: "default" | "info" | "warning";
  children: React.ReactNode;
}) {
  const hintStyles = {
    default: "text-slate-500 dark:text-slate-400",
    info: "text-blue-600 dark:text-blue-400",
    warning: "text-amber-600 dark:text-amber-400",
  };
  const hintIcons = {
    default: <Info className="size-3 shrink-0 mt-0.5 text-slate-400" />,
    info: <Info className="size-3 shrink-0 mt-0.5 text-blue-500" />,
    warning: (
      <AlertTriangle className="size-3 shrink-0 mt-0.5 text-amber-500" />
    ),
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Label>
      {children}
      {hint && (
        <div className="flex items-start gap-1.5">
          {hintIcons[hintVariant]}
          <p className={`text-xs leading-relaxed ${hintStyles[hintVariant]}`}>
            {hint}
          </p>
        </div>
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

export function TelephonyAISettings({
  activeTab: activeTabProp,
}: {
  activeTab?: "twilio" | "elevenlabs";
} = {}) {
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
    data: agentsList,
    isLoading: agentsLoading,
    refetch: refetchAgents,
  } = useQuery<{
    agents: Array<{ agentId: string; name: string }>;
  }>({
    queryKey: ["/api/elevenlabs/agents"],
    queryFn: async () => {
      const res = await fetch("/api/elevenlabs/agents", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao listar agentes");
      return res.json();
    },
    enabled: !!status?.elevenlabs,
    staleTime: 30_000,
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
          twilio_status_callback_url: settings.twilio_status_callback_url ?? "",
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
  const [cloneVoiceOpen, setCloneVoiceOpen] = useState(false);
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);

  const [createTwimlAppOpen, setCreateTwimlAppOpen] = useState(false);

  // Caller ID state
  const [callerIdsOpen, setCallerIdsOpen] = useState(false);
  const [newCallerNumber, setNewCallerNumber] = useState("");
  const [newCallerFriendlyName, setNewCallerFriendlyName] = useState("");
  const [pendingValidationCode, setPendingValidationCode] = useState<
    string | null
  >(null);

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

  // ── TwiML Apps queries/mutations ─────────────────────────────────────────────

  const {
    data: twimlApps,
    isLoading: twimlAppsLoading,
    refetch: refetchApps,
  } = useQuery<
    Array<{
      sid: string;
      friendlyName: string;
      voiceUrl: string;
      voiceMethod: string;
      statusCallback: string;
      dateUpdated: string;
    }>
  >({
    queryKey: ["/api/twilio/applications"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/applications", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao listar apps");
      return res.json();
    },
    enabled: !!status?.twilio,
    staleTime: 30_000,
  });

  const selectAppMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(`/api/twilio/applications/${sid}/select`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao selecionar app");
      }
      return res.json() as Promise<{ ok: boolean; sid: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "TwiML App selecionado",
        description: `SID salvo: ${data.sid}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telephony-settings"] });
    },
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const syncAppMutation = useMutation({
    mutationFn: async ({ sid, baseUrl }: { sid: string; baseUrl?: string }) => {
      const res = await fetch(`/api/twilio/applications/${sid}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ baseUrl }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao sincronizar");
      }
      return res.json() as Promise<{ ok: boolean; voiceUrl: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "URLs sincronizadas",
        description: `Voice URL: ${data.voiceUrl}`,
      });
      void refetchApps();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao sincronizar",
        description: err.message,
        variant: "destructive",
      }),
  });

  // ── Caller IDs queries/mutations ──────────────────────────────────────────────

  const {
    data: callerIds,
    isLoading: callerIdsLoading,
    refetch: refetchCallerIds,
  } = useQuery<
    Array<{
      sid: string;
      friendlyName: string;
      phoneNumber: string;
      dateCreated: string;
    }>
  >({
    queryKey: ["/api/twilio/caller-ids"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/caller-ids", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao listar caller IDs");
      return res.json();
    },
    enabled: callerIdsOpen && !!status?.twilio,
    staleTime: 30_000,
  });

  const validateCallerMutation = useMutation({
    mutationFn: async (data: {
      phoneNumber: string;
      friendlyName?: string;
    }) => {
      const res = await fetch("/api/twilio/caller-ids/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao iniciar validação");
      }
      return res.json() as Promise<{
        validationCode: string;
        phoneNumber: string;
        friendlyName: string;
      }>;
    },
    onSuccess: (data) => {
      setPendingValidationCode(data.validationCode);
      setNewCallerNumber("");
      setNewCallerFriendlyName("");
      toast({
        title: "Ligação de verificação iniciada",
        description: `Atenda e informe o código: ${data.validationCode}`,
      });
    },
    onError: (err: Error) =>
      toast({
        title: "Erro na verificação",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteCallerMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(`/api/twilio/caller-ids/${sid}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao remover");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Caller ID removido" });
      void refetchCallerIds();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao remover",
        description: err.message,
        variant: "destructive",
      }),
  });

  // ── Voice Intelligence queries/mutations ──────────────────────────────────────

  const [createIntelligenceOpen, setCreateIntelligenceOpen] = useState(false);
  const [editingService, setEditingService] =
    useState<IntelligenceService | null>(null);

  const {
    data: intelligenceServices,
    isLoading: intelligenceLoading,
    refetch: refetchIntelligence,
  } = useQuery<Array<IntelligenceService>>({
    queryKey: ["/api/twilio/intelligence-services"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/intelligence-services", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao listar serviços");
      return res.json();
    },
    enabled: !!status?.twilio,
    staleTime: 30_000,
  });

  const selectIntelligenceMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(
        `/api/twilio/intelligence-services/${sid}/select`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao selecionar serviço");
      }
      return res.json() as Promise<{ ok: boolean; sid: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Serviço selecionado", description: `SID: ${data.sid}` });
      queryClient.invalidateQueries({ queryKey: ["/api/telephony-settings"] });
    },
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const isLoading = settingsLoading || statusLoading;
  const recordCalls = watch("twilio_record_calls");
  const serverBaseUrl = watch("server_base_url") ?? "";
  const twimlAppSid = watch("twilio_twiml_app_sid") ?? "";
  const intelligenceSid = watch("twilio_intelligence_service_sid") ?? "";
  const transcriptionWebhookUrl = serverBaseUrl
    ? `${serverBaseUrl}/api/calls/twilio-transcription`
    : "";

  const debuggerWebhookUrl = serverBaseUrl
    ? `${serverBaseUrl}/api/twilio/debugger-webhook`
    : "";

  function handleServerBaseUrlBlur(url: string) {
    if (!url.trim() || !twimlAppSid.trim() || !status?.twilio) return;
    syncAppMutation.mutate({ sid: twimlAppSid, baseUrl: url.trim() });
  }

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
      {/* ── Status Overview Banner ─────────────────────────────────── */}
      <div className={`mb-6 grid grid-cols-1 gap-3 ${activeTabProp === "elevenlabs" ? "sm:grid-cols-1 max-w-xs" : activeTabProp === "twilio" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {[
          {
            key: "twilio",
            label: "Twilio",
            description: "Telefonia & Voice SDK",
            active: status?.twilio ?? false,
            logo: (
              <img src="/twilio-login-logo.svg" alt="Twilio" className="h-4 w-auto" />
            ),
            activeBorder: "border-[#F22F46]/30 bg-[#F22F46]/5 dark:border-[#F22F46]/20 dark:bg-[#F22F46]/5",
            activeIcon: "bg-[#F22F46]/10 dark:bg-[#F22F46]/10",
          },
          {
            key: "elevenlabs",
            label: "ElevenLabs",
            description: "IA Conversacional",
            active: status?.elevenlabs ?? false,
            logo: (
              <img src="/elevenlabs-logo-black.svg" alt="ElevenLabs" className="h-3.5 w-auto dark:invert" />
            ),
            activeBorder: "border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/40",
            activeIcon: "bg-slate-100 dark:bg-slate-700/60",
          },
          {
            key: "voiceSdk",
            label: "Voice SDK",
            description: "Browser WebRTC",
            active: status?.voiceSdk ?? false,
            logo: <Radio className="size-4 text-emerald-600 dark:text-emerald-400" />,
            activeBorder: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-900/10",
            activeIcon: "bg-emerald-100 dark:bg-emerald-900/40",
          },
        ]
          .filter((item) => {
            if (!activeTabProp) return true;
            if (activeTabProp === "twilio") return item.key === "twilio" || item.key === "voiceSdk";
            if (activeTabProp === "elevenlabs") return item.key === "elevenlabs";
            return true;
          })
          .map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
              item.active
                ? item.activeBorder
                : "border-slate-200 bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/30"
            }`}
          >
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
                item.active ? item.activeIcon : "bg-slate-100 dark:bg-slate-800"
              }`}
            >
              {item.logo}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {item.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            </div>
            <div
              className={`shrink-0 w-2 h-2 rounded-full ${item.active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
            />
          </div>
        ))}
      </div>

      <Tabs
        value={activeTabProp ?? undefined}
        defaultValue={activeTabProp ? undefined : "twilio"}
        className="space-y-6"
      >
        {/* ── Tab Selector (oculto quando controlado externamente) ───── */}
        {!activeTabProp && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <TabsList className="contents">
              <TabsTrigger
                value="twilio"
                className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl transition-all duration-200
                  data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
                  data-[state=active]:shadow-md data-[state=active]:shadow-red-500/10
                  data-[state=active]:border data-[state=active]:border-red-200/60 dark:data-[state=active]:border-red-800/40
                  text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200
                  group h-auto"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#F22F46]/10 group-data-[state=active]:bg-[#F22F46]/15 transition-colors shrink-0">
                  <img src="/twilio-login-logo.svg" alt="Twilio" className="h-3.5 w-auto" />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                    Twilio
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
                    Telefonia & Voice SDK
                  </p>
                </div>
                <span className="sm:hidden text-sm font-semibold text-slate-800 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                  Twilio
                </span>
                <div
                  className={`ml-auto shrink-0 w-2 h-2 rounded-full transition-colors ${(status?.twilio ?? false) ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                />
              </TabsTrigger>

              <TabsTrigger
                value="elevenlabs"
                className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl transition-all duration-200
                  data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900
                  data-[state=active]:shadow-md data-[state=active]:shadow-slate-500/10
                  data-[state=active]:border data-[state=active]:border-slate-200/60 dark:data-[state=active]:border-slate-700/40
                  text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200
                  group h-auto"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-data-[state=active]:bg-slate-200/80 dark:bg-slate-800 dark:group-data-[state=active]:bg-slate-700 transition-colors shrink-0">
                  <img src="/elevenlabs-logo-black.svg" alt="ElevenLabs" className="h-3 w-auto dark:invert" />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                    ElevenLabs
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
                    IA Conversacional
                  </p>
                </div>
                <span className="sm:hidden text-sm font-semibold text-slate-800 dark:text-slate-200 group-data-[state=inactive]:text-slate-500">
                  ElevenLabs
                </span>
                <div
                  className={`ml-auto shrink-0 w-2 h-2 rounded-full transition-colors ${(status?.elevenlabs ?? false) ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                />
              </TabsTrigger>
            </TabsList>
          </div>
        )}

        {/* ── ABA TWILIO ─────────────────────────────────────────────── */}
        <TabsContent value="twilio" className="space-y-6 mt-0">
          {/* Servidor */}
          <Card className="border border-slate-200/70 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600" />
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Server className="size-3.5 text-slate-600 dark:text-slate-400" />
                </div>
                Servidor
              </CardTitle>
              <CardDescription>
                URL pública do servidor que o Twilio e o ElevenLabs usam para
                enviar eventos ao sistema. Deve ser acessível pela internet —
                não use{" "}
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  localhost
                </code>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <FieldGroup
                label="Server Base URL"
                hint="Ex: https://meucrm.com.br — informe sem barra final. Ao sair do campo, as URLs do TwiML App ativo são atualizadas automaticamente com este endereço base."
                hintVariant="info"
              >
                <div className="relative">
                  <Input
                    {...register("server_base_url")}
                    placeholder="https://meucrm.com.br"
                    onBlur={(e) => handleServerBaseUrlBlur(e.target.value)}
                  />
                  {syncAppMutation.isPending && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-slate-400" />
                  )}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Twilio Core */}
          <Card className="border border-blue-200/60 dark:border-blue-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <Phone className="size-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Twilio
                </CardTitle>
                <StatusBadge
                  active={status?.twilio ?? false}
                  label={status?.twilio ? "Configurado" : "Não configurado"}
                />
              </div>
              <CardDescription>
                Credenciais principais da sua conta Twilio. Encontradas no
                painel em{" "}
                <a
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 font-medium text-blue-600 dark:text-blue-400"
                >
                  console.twilio.com
                </a>{" "}
                → Dashboard (canto superior direito).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <FieldGroup
                label="Account SID"
                hint="Identificador único da sua conta Twilio. Sempre começa com AC (ex: ACxxxxxxxxxxxxxxxx). Visível no painel principal do Twilio Console."
              >
                <Input
                  {...register("twilio_account_sid")}
                  placeholder="ACxxxxxxxxxxxxxxxx"
                />
              </FieldGroup>

              <FieldGroup
                label="Auth Token"
                hint="Token secreto para autenticar requisições à API REST do Twilio. Nunca compartilhe publicamente. Fique ao lado do Account SID no Console — clique no ícone de olho para revelar."
                hintVariant="warning"
              >
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
                hint="Número de telefone principal adquirido no Twilio para realizar ligações. Deve estar no formato E.164 (ex: +5511999999999). Adquira em Console → Phone Numbers → Manage → Buy a Number."
              >
                <Input
                  {...register("twilio_from_number")}
                  placeholder="+5511999999999"
                />
              </FieldGroup>

              <FieldGroup
                label="Status Callback URL"
                hint="Endpoint que recebe atualizações em tempo real sobre o status de cada chamada (iniciada, em andamento, encerrada, falhou etc.). Preenchida automaticamente quando a Server Base URL estiver configurada."
              >
                <Input
                  {...register("twilio_status_callback_url")}
                  placeholder="https://meucrm.com.br/api/calls/twilio-status"
                />
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Voice SDK + TwiML App */}
          <Card className="border border-blue-200/60 dark:border-blue-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-blue-300 via-indigo-500 to-blue-300" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                    <Radio className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Voice SDK (Áudio no Navegador)
                </CardTitle>
                <StatusBadge
                  active={status?.voiceSdk ?? false}
                  label={status?.voiceSdk ? "Configurado" : "Não configurado"}
                />
              </div>
              <CardDescription>
                Credenciais necessárias para o Twilio Voice SDK funcionar no
                navegador do operador (ligações via WebRTC). Criadas
                separadamente do Auth Token em{" "}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Console → Account → API Keys &amp; Tokens
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldGroup
                  label="API Key SID"
                  hint="Identificador da API Key usada para gerar tokens de acesso ao Voice SDK no navegador. Começa com SK (ex: SKxxxxxxxxxxxxxxxx). Crie em Console → Account → API Keys & Tokens → Create API Key."
                >
                  <Input
                    {...register("twilio_api_key")}
                    placeholder="SKxxxxxxxxxxxxxxxx"
                  />
                </FieldGroup>

                <FieldGroup
                  label="API Secret"
                  hint="Secret correspondente à API Key acima. Exibido apenas uma vez no momento da criação — guarde imediatamente em local seguro. Se perdido, crie uma nova API Key."
                  hintVariant="warning"
                >
                  <div className="relative">
                    <Input
                      {...register("twilio_api_secret")}
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <ShieldAlert className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  </div>
                </FieldGroup>
              </div>

              {/* TwiML App inline */}
              <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      TwiML App
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Aplicação configurada no Twilio que define como as
                      chamadas de voz são roteadas. O app ativo recebe o Voice
                      SDK do navegador e encaminha as chamadas ao backend.
                    </p>
                  </div>
                  {twimlAppSid && (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0"
                    >
                      <CheckCircle2 className="size-3.5" />
                      App ativo
                    </Badge>
                  )}
                </div>

                {!status?.twilio && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2">
                    <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Configure e salve as credenciais Twilio acima para
                      gerenciar apps.
                    </p>
                  </div>
                )}

                {status?.twilio && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl w-full"
                      onClick={() => setCreateTwimlAppOpen(true)}
                    >
                      <Plus className="size-4" />
                      Criar novo TwiML App
                    </Button>

                    {twimlAppsLoading && (
                      <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                        <Loader2 className="size-4 animate-spin" /> Carregando
                        apps...
                      </div>
                    )}

                    {(twimlApps ?? []).map((app) => {
                      const isActive = twimlAppSid === app.sid;
                      return (
                        <div
                          key={app.sid}
                          className={`rounded-xl border px-4 py-3 space-y-2 transition-colors ${
                            isActive
                              ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {app.friendlyName}
                                </p>
                                {isActive && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  >
                                    ativo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                                {app.sid}
                              </p>
                              {app.voiceUrl && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                  {app.voiceUrl}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!isActive && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-1.5 rounded-lg text-xs"
                                disabled={selectAppMutation.isPending}
                                onClick={() =>
                                  selectAppMutation.mutate(app.sid)
                                }
                              >
                                <Check className="size-3.5" />
                                Usar este app
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={isActive ? "outline" : "ghost"}
                              className="flex-1 gap-1.5 rounded-lg text-xs"
                              disabled={syncAppMutation.isPending}
                              onClick={() =>
                                syncAppMutation.mutate({
                                  sid: app.sid,
                                  baseUrl: serverBaseUrl || undefined,
                                })
                              }
                            >
                              <RefreshCw className="size-3.5" />
                              Sincronizar URLs
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {!twimlAppsLoading && (twimlApps ?? []).length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-1">
                        Nenhum TwiML App encontrado na conta. Crie um acima.
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Voice Intelligence */}
          <Card className="border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <Radio className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Voice Intelligence (Transcrição Nativa)
                </CardTitle>
                {intelligenceSid && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Configurado
                  </Badge>
                )}
              </div>
              <CardDescription>
                Serviço nativo do Twilio que transcreve chamadas de voz
                automaticamente em texto. Permite análise de sentimento, redação
                de dados sensíveis (PII) e extração de informações estruturadas
                via Language Operators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {transcriptionWebhookUrl && (
                <ReadOnlyWithCopy
                  label="URL do Webhook de Transcrição"
                  value={transcriptionWebhookUrl}
                />
              )}

              {!status?.twilio && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2">
                  <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Configure e salve as credenciais Twilio antes de gerenciar
                    serviços de inteligência.
                  </p>
                </div>
              )}

              {status?.twilio && (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl w-full"
                    onClick={() => setCreateIntelligenceOpen(true)}
                  >
                    <Plus className="size-4" />
                    Criar novo serviço de inteligência
                  </Button>

                  {intelligenceLoading && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                      <Loader2 className="size-4 animate-spin" /> Carregando
                      serviços...
                    </div>
                  )}

                  {(intelligenceServices ?? []).map((svc) => {
                    const isActive = intelligenceSid === svc.sid;
                    return (
                      <div
                        key={svc.sid}
                        className={`rounded-xl border px-4 py-3 space-y-2 transition-colors ${
                          isActive
                            ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {svc.friendlyName || svc.uniqueName}
                            </p>
                            {isActive && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              >
                                ativo
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-mono"
                            >
                              {svc.languageCode}
                            </Badge>
                          </div>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {svc.sid}
                          </p>
                          <div className="flex gap-3 mt-1">
                            {svc.autoTranscribe && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <CheckCircle2 className="size-3 text-emerald-500" />{" "}
                                Transcrição automática
                              </span>
                            )}
                            {svc.autoRedaction && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <CheckCircle2 className="size-3 text-emerald-500" />{" "}
                                Redação de PII
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!isActive && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1.5 rounded-lg text-xs"
                              disabled={selectIntelligenceMutation.isPending}
                              onClick={() =>
                                selectIntelligenceMutation.mutate(svc.sid)
                              }
                            >
                              <Check className="size-3.5" />
                              Usar este serviço
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 rounded-lg text-xs"
                            onClick={() => setEditingService(svc)}
                          >
                            <Pencil className="size-3.5" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {!intelligenceLoading &&
                    (intelligenceServices ?? []).length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-1">
                        Nenhum serviço de inteligência encontrado na conta. Crie
                        um acima.
                      </p>
                    )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gravação de Chamadas */}
          <Card className="border border-amber-200/60 dark:border-amber-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Phone className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
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
                Quando habilitada, o Twilio grava todas as chamadas e
                disponibiliza os áudios para reprodução no histórico do cliente.
                As gravações ficam armazenadas no Twilio e podem ser acessadas
                via API.
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
                    Quando ativado, todas as chamadas feitas via Twilio serão
                    gravadas.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Aviso legal
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A gravação de chamadas pode estar sujeita a regulamentações
                  locais. Em muitas jurisdições brasileiras, é necessário
                  informar ao interlocutor que a ligação está sendo gravada.
                  Certifique-se de estar em conformidade com a LGPD e demais
                  legislações aplicáveis.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Canais de Saída */}
          <Card className="border border-slate-200/70 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-slate-300 via-blue-300 to-slate-300 dark:from-slate-600 dark:via-blue-700 dark:to-slate-600" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Phone className="size-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
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
                Lista de números de saída que o operador pode selecionar ao
                realizar uma ligação. Cada canal tem um rótulo (ex: "Vendas") e
                o número correspondente no formato E.164.
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

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
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

          {/* Verified Caller IDs */}
          <Card className="border border-slate-200/70 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Phone className="size-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                  Verified Caller IDs
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-slate-500"
                  onClick={() => {
                    setCallerIdsOpen((v) => !v);
                    if (!callerIdsOpen) void refetchCallerIds();
                  }}
                  disabled={!status?.twilio}
                >
                  {callerIdsOpen ? "Fechar" : "Gerenciar"}
                </Button>
              </div>
              <CardDescription>
                Números de telefone externos (não comprados no Twilio) que podem
                ser usados como Caller ID em chamadas de saída. O Twilio liga
                para verificar a posse do número antes de liberá-lo — você
                deverá informar um código de validação ao atender.
              </CardDescription>
            </CardHeader>

            {callerIdsOpen && (
              <CardContent className="space-y-3 pt-0">
                {!status?.twilio && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2">
                    <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Configure e salve as credenciais Twilio antes de gerenciar
                      caller IDs.
                    </p>
                  </div>
                )}

                {pendingValidationCode && (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-1">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Aguardando verificação — atenda a ligação do Twilio e
                      informe o código:
                    </p>
                    <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300 tracking-widest">
                      {pendingValidationCode}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs text-blue-500 p-0 h-auto hover:bg-transparent"
                      onClick={() => {
                        setPendingValidationCode(null);
                        void refetchCallerIds();
                      }}
                    >
                      Já verifiquei — atualizar lista
                    </Button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Nome (ex: Vendas)"
                    value={newCallerFriendlyName}
                    onChange={(e) => setNewCallerFriendlyName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="+5511999999999"
                    value={newCallerNumber}
                    onChange={(e) => setNewCallerNumber(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 rounded-xl"
                    disabled={
                      !newCallerNumber.trim() ||
                      validateCallerMutation.isPending ||
                      !status?.twilio
                    }
                    onClick={() =>
                      validateCallerMutation.mutate({
                        phoneNumber: newCallerNumber.trim(),
                        friendlyName: newCallerFriendlyName.trim() || undefined,
                      })
                    }
                  >
                    {validateCallerMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Phone className="size-4" />
                    )}
                    Verificar
                  </Button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O Twilio ligará para o número e você deverá informar o código
                  exibido.
                </p>

                {callerIdsLoading && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                    <Loader2 className="size-4 animate-spin" /> Carregando...
                  </div>
                )}

                {(callerIds ?? []).map((id) => (
                  <div
                    key={id.sid}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {id.friendlyName || id.phoneNumber}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {id.phoneNumber}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-500"
                      disabled={deleteCallerMutation.isPending}
                      onClick={() => deleteCallerMutation.mutate(id.sid)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                {!callerIdsLoading &&
                  (callerIds ?? []).length === 0 &&
                  status?.twilio &&
                  !pendingValidationCode && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">
                      Nenhum número verificado ainda.
                    </p>
                  )}
              </CardContent>
            )}
          </Card>

          {/* Webhook de Erros e Avisos */}
          <Card className="border border-amber-200/60 dark:border-amber-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Webhook className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  Webhook de Erros e Avisos
                </CardTitle>
              </div>
              <CardDescription>
                Configure esta URL no painel do Twilio para receber erros e
                avisos em tempo real no Monitor da aba Telemarketing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info banner */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                <div className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">Como configurar</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-600 dark:text-amber-400">
                    <li>Copie a URL abaixo</li>
                    <li>
                      Acesse{" "}
                      <a
                        href="https://console.twilio.com/us1/monitor/logs/debugger/webhook"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2"
                      >
                        Twilio Console → Monitor → Logs → Errors → Webhook
                        <ExternalLink className="size-3" />
                      </a>
                    </li>
                    <li>Cole a URL no campo "Webhook URL" e salve</li>
                  </ol>
                </div>
              </div>

              {/* URL do webhook */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  URL do Webhook
                </Label>
                {debuggerWebhookUrl ? (
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={debuggerWebhookUrl}
                      className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-mono text-xs truncate"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(debuggerWebhookUrl);
                        toast({ title: "URL copiada!" });
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      asChild
                    >
                      <a
                        href="https://console.twilio.com/us1/monitor/logs/debugger/webhook"
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir painel do Twilio"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                    <Info className="size-4 shrink-0 text-slate-400" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure a <strong>Server Base URL</strong> acima para
                      gerar o endereço do webhook.
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O sistema receberá erros (Error) e avisos (Warning) do Twilio
                  neste endpoint e os exibirá na aba Monitor.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center sm:text-left">
              As configurações se aplicam globalmente ao sistema de telefonia.
            </p>
            <Button
              type="submit"
              disabled={saveMutation.isPending || isSubmitting}
              className="gap-2 rounded-2xl px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 w-full sm:w-auto"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>

        {/* ── ABA ELEVENLABS ─────────────────────────────────────────── */}
        <TabsContent value="elevenlabs" className="space-y-6 mt-0">
          {/* ElevenLabs credentials */}
          <Card className="border border-violet-200/60 dark:border-violet-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-violet-400 via-purple-500 to-violet-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Bot className="size-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  ElevenLabs
                </CardTitle>
                <StatusBadge
                  active={status?.elevenlabs ?? false}
                  label={status?.elevenlabs ? "Configurado" : "Não configurado"}
                />
              </div>
              <CardDescription>
                Credenciais para integrar com a plataforma ElevenLabs,
                responsável pela síntese de voz e pelos agentes de IA
                conversacional usados nas campanhas de discagem automática.
                Obtenha sua chave em{" "}
                <a
                  href="https://elevenlabs.io/app/account"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 font-medium text-violet-600 dark:text-violet-400"
                >
                  elevenlabs.io → Profile → API Keys
                </a>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <FieldGroup
                label="API Key"
                hint="Chave secreta de acesso à API do ElevenLabs. Necessária para criar agentes, sintetizar voz e listar vozes disponíveis. Gerada em elevenlabs.io → Profile → API Keys → Create API Key."
                hintVariant="warning"
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
                label="Voice ID (Voz Padrão Global)"
                hint="ID de uma voz criada ou clonada no ElevenLabs Voice Lab. Será usada como padrão em todos os agentes e campanhas que não tiverem uma voz específica configurada. Encontre o ID em elevenlabs.io → Voices → selecione a voz → copie o ID."
              >
                <Input
                  {...register("elevenlabs_voice_id")}
                  placeholder="Ex: 21m00Tcm4TlvDq8ikWAM"
                />
              </FieldGroup>

              <div className="flex items-end sm:col-span-2">
                <div className="w-full rounded-2xl border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Clonar minha voz
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Grave ou envie amostras de áudio (mín. 1 min) para criar
                      uma voz personalizada clonada no ElevenLabs. O ID da voz
                      criada pode ser usado como padrão global acima.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!status?.elevenlabs}
                    onClick={() => setCloneVoiceOpen(true)}
                    className="gap-2 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Mic className="size-3.5" />
                    Clonar voz
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gerenciamento de Agente */}
          <Card className="border border-violet-200/60 dark:border-violet-800/40 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400" />
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                  <Bot className="size-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                Configurar Agente ElevenLabs
              </CardTitle>
              <CardDescription>
                Crie e configure agentes de IA conversacional do ElevenLabs
                diretamente neste painel. Cada agente possui prompt (instruções
                de comportamento), voz, primeira mensagem de abertura e
                ferramentas (funções que o agente pode executar durante a
                conversa, como buscar dados de clientes).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Novo agente
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Crie e configure um agente de IA conversacional diretamente
                    neste painel, sem precisar acessar o ElevenLabs
                  </p>
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Ou gerencie um agente existente
                  </Label>
                  {status?.elevenlabs && (
                    <button
                      type="button"
                      onClick={() => refetchAgents()}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title="Recarregar lista de agentes"
                    >
                      <RefreshCw
                        className={`size-3.5 ${agentsLoading ? "animate-spin" : ""}`}
                      />
                    </button>
                  )}
                </div>

                {status?.elevenlabs ? (
                  <Popover
                    open={agentSelectorOpen}
                    onOpenChange={setAgentSelectorOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                      >
                        <span
                          className={
                            agentIdInput
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {agentIdInput
                            ? (agentsList?.agents.find(
                                (a) => a.agentId === agentIdInput,
                              )?.name ?? agentIdInput)
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
                                  setAgentIdInput(agent.agentId);
                                  setAgentSelectorOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 size-4 ${agentIdInput === agent.agentId ? "opacity-100" : "opacity-0"}`}
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
                    value={agentIdInput}
                    onChange={(e) => setAgentIdInput(e.target.value.trim())}
                    placeholder="agent_xxxxxxxxxxxxxxxx"
                    className="font-mono"
                    disabled
                  />
                )}

                <div className="flex items-start gap-1.5">
                  <Info className="size-3 shrink-0 mt-0.5 text-slate-400" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Selecione um agente da lista para editar suas configurações
                    ou gerenciar as ferramentas disponíveis. O agente
                    selecionado aqui não afeta as campanhas — cada campanha
                    mantém seu próprio agente configurado.
                  </p>
                </div>
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
                    Configure e salve a API Key do ElevenLabs acima para
                    habilitar o gerenciamento de agentes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center sm:text-left">
              As configurações se aplicam globalmente ao sistema de IA
              conversacional.
            </p>
            <Button
              type="submit"
              disabled={saveMutation.isPending || isSubmitting}
              className="gap-2 rounded-2xl px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 w-full sm:w-auto"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>
      </Tabs>

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

      <CreateIntelligenceDialog
        open={createIntelligenceOpen}
        onClose={() => setCreateIntelligenceOpen(false)}
        onCreated={() => void refetchIntelligence()}
        defaultWebhookUrl={transcriptionWebhookUrl}
      />

      <EditIntelligenceDialog
        open={!!editingService}
        onClose={() => setEditingService(null)}
        onUpdated={() => void refetchIntelligence()}
        service={editingService}
      />

      <CreateTwimlAppDialog
        open={createTwimlAppOpen}
        onClose={() => setCreateTwimlAppOpen(false)}
        onCreated={() => void refetchApps()}
        defaultVoiceUrl={
          serverBaseUrl ? `${serverBaseUrl}/api/twilio/voice` : ""
        }
        defaultStatusCallback={
          serverBaseUrl ? `${serverBaseUrl}/api/calls/twilio-status` : ""
        }
      />

      <CreateAgentDialog
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={(id) => {
          setAgentIdInput(id);
          void refetchAgents();
        }}
      />

      <VoiceCloneDialog
        open={cloneVoiceOpen}
        onClose={() => setCloneVoiceOpen(false)}
        onCreated={(_voiceId, _voiceName) => {
          setCloneVoiceOpen(false);
        }}
      />
    </form>
  );
}
