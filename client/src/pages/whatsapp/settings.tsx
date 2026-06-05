import { useState, useEffect } from "react";
import { Settings2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWhatsappSettings, useWhatsappStatus, useUpdateWhatsappSettings } from "@/hooks/use-whatsapp";

const MASKED = "••••••••";
const SENSITIVE_KEYS = ["wa_phone_number_id", "wa_access_token", "wa_waba_id", "wa_webhook_verify_token"] as const;

type SettingsForm = {
  wa_phone_number_id: string;
  wa_access_token: string;
  wa_waba_id: string;
  wa_webhook_verify_token: string;
  wa_api_version: string;
  wa_enabled: boolean;
  wa_message_delay_ms: string;
};

type EditingFields = Record<(typeof SENSITIVE_KEYS)[number], boolean>;

export default function WhatsAppSettings() {
  const { data: settings, isLoading } = useWhatsappSettings();
  const { data: status } = useWhatsappStatus();
  const updateMutation = useUpdateWhatsappSettings();

  const [form, setForm] = useState<SettingsForm>({
    wa_phone_number_id: "",
    wa_access_token: "",
    wa_waba_id: "",
    wa_webhook_verify_token: "",
    wa_api_version: "v20.0",
    wa_enabled: false,
    wa_message_delay_ms: "1000",
  });

  const [editing, setEditing] = useState<EditingFields>({
    wa_phone_number_id: false,
    wa_access_token: false,
    wa_waba_id: false,
    wa_webhook_verify_token: false,
  });

  const [showValues, setShowValues] = useState<EditingFields>({
    wa_phone_number_id: false,
    wa_access_token: false,
    wa_waba_id: false,
    wa_webhook_verify_token: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        wa_phone_number_id: settings.wa_phone_number_id ?? "",
        wa_access_token: settings.wa_access_token ?? "",
        wa_waba_id: settings.wa_waba_id ?? "",
        wa_webhook_verify_token: settings.wa_webhook_verify_token ?? "",
        wa_api_version: settings.wa_api_version ?? "v20.0",
        wa_enabled: settings.wa_enabled === "true",
        wa_message_delay_ms: settings.wa_message_delay_ms ?? "1000",
      });
    }
  }, [settings]);

  const handleSave = () => {
    const payload: Record<string, string> = {
      wa_api_version: form.wa_api_version,
      wa_enabled: String(form.wa_enabled),
      wa_message_delay_ms: form.wa_message_delay_ms,
    };
    SENSITIVE_KEYS.forEach((key) => {
      if (editing[key] && form[key] !== MASKED) {
        payload[key] = form[key];
      }
    });
    updateMutation.mutate(payload);
  };

  const toggleEdit = (key: (typeof SENSITIVE_KEYS)[number]) => {
    setEditing((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!editing[key]) {
      setForm((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const SENSITIVE_FIELDS: { key: (typeof SENSITIVE_KEYS)[number]; label: string; placeholder: string }[] = [
    { key: "wa_phone_number_id", label: "Phone Number ID", placeholder: "1234567890" },
    { key: "wa_access_token", label: "Access Token", placeholder: "EAAxxxxx..." },
    { key: "wa_waba_id", label: "WABA ID (Conta de Negócios)", placeholder: "987654321" },
    { key: "wa_webhook_verify_token", label: "Webhook Verify Token", placeholder: "meu-token-secreto" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-5 lg:p-6">
    <div className="space-y-6 pb-10 max-w-2xl">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Settings2}
            color="text-slate-600 dark:text-slate-400"
            bgColor="bg-slate-100 dark:bg-slate-800"
          />
          <PageHeader.Text>
            <PageHeader.Title>Configurações WhatsApp</PageHeader.Title>
            <PageHeader.Description>Credenciais da WhatsApp Business API</PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        {status && (
          <PageHeader.Actions>
            {status.configured ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 gap-1.5 px-3 py-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                {status.enabled ? "Conectado" : "Configurado (desabilitado)"}
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 gap-1.5 px-3 py-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Não configurado
              </Badge>
            )}
          </PageHeader.Actions>
        )}
      </PageHeader>

      {/* Credentials card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais da API</CardTitle>
          <CardDescription>
            Dados sensíveis são exibidos mascarados. Clique em "Editar" para alterar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SENSITIVE_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={editing[key] && showValues[key] ? "text" : editing[key] ? "password" : "text"}
                    value={editing[key] ? form[key] : form[key] || MASKED}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    disabled={!editing[key]}
                    placeholder={placeholder}
                    className={!editing[key] ? "text-muted-foreground" : ""}
                  />
                  {editing[key] && (
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setShowValues((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                    >
                      {showValues[key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleEdit(key)}
                >
                  {editing[key] ? "Cancelar" : "Editar"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* General settings card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Versão da API</Label>
            <Input
              value={form.wa_api_version}
              onChange={(e) => setForm((prev) => ({ ...prev, wa_api_version: e.target.value }))}
              placeholder="v20.0"
              className="max-w-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Delay entre mensagens (ms)</Label>
            <Input
              type="number"
              value={form.wa_message_delay_ms}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, wa_message_delay_ms: e.target.value }))
              }
              min={0}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Intervalo entre cada mensagem enviada em uma campanha. Recomendado: 1000ms.
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">WhatsApp habilitado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ativa ou desativa o envio de mensagens via WhatsApp
              </p>
            </div>
            <Switch
              checked={form.wa_enabled}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, wa_enabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="min-w-28"
        >
          {updateMutation.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
    </div>
  );
}
