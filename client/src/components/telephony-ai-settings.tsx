import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

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
    reset,
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
        twilio_from_numbers: data.twilio_from_numbers ?? "",
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

  const isLoading = settingsLoading || statusLoading;
  const recordCalls = watch("twilio_record_calls");

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

        {/* Twilio */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="size-4 text-slate-500" />
              Twilio
            </CardTitle>
            <CardDescription>
              Credenciais de acesso à API e ao Voice SDK do Twilio.
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

            <FieldGroup label="Status Callback URL" hint="Para receber eventos de chamada">
              <Input
                {...register("twilio_status_callback_url")}
                placeholder="https://meucrm.com.br/api/calls/twilio-status"
              />
            </FieldGroup>

            <FieldGroup
              label="API Key SID"
              hint="Console → API Keys → Standard"
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
            </FieldGroup>

            <FieldGroup
              label="TwiML App SID"
              hint="Console → Voice → TwiML Apps"
            >
              <Input
                {...register("twilio_twiml_app_sid")}
                placeholder="APxxxxxxxxxxxxxxxx"
              />
            </FieldGroup>

            <FieldGroup
              label="Intelligence Service SID"
              hint="Opcional — apenas para transcrição de chamadas humanas"
            >
              <Input
                {...register("twilio_intelligence_service_sid")}
                placeholder="GAxxxxxxxxxxxxxxxx"
              />
            </FieldGroup>

            <FieldGroup
              label="From Numbers (JSON)"
              hint='Array de canais: [{"label":"Principal","number":"+5511..."}]'
            >
              <Input
                {...register("twilio_from_numbers")}
                placeholder='[{"label":"Principal","number":"+5511999999999"}]'
              />
            </FieldGroup>

            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="twilio_record_calls"
                checked={recordCalls ?? false}
                onCheckedChange={(v) => setValue("twilio_record_calls", v)}
              />
              <Label
                htmlFor="twilio_record_calls"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Gravar chamadas
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* ElevenLabs */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="size-4 text-slate-500" />
              ElevenLabs
            </CardTitle>
            <CardDescription>
              Credenciais para o agente de IA conversacional. O Voice ID global
              pode ser sobrescrito por campanha.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FieldGroup
              label="API Key"
              hint="elevenlabs.io → Profile → API Keys"
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
              label="Voice ID (global)"
              hint="Opcional — elevenlabs.io → Voices → Voice Lab"
            >
              <Input
                {...register("elevenlabs_voice_id")}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
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
    </form>
  );
}
