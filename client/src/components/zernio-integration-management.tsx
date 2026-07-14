import { useState } from "react";
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
import { Eye, EyeOff, Loader2, Copy, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useZernioSettings,
  useUpdateZernioSettings,
} from "@/hooks/use-zernio-settings";

const WEBHOOK_URL = `${window.location.origin}/api/zernio-webhook/message`;

export function ZernioIntegrationManagement() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useZernioSettings();
  const updateMutation = useUpdateZernioSettings();

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, string>>({});

  const toggle = (key: string) => setRevealed((p) => ({ ...p, [key]: !p[key] }));

  const currentValue = (key: string) =>
    form[key] !== undefined ? form[key] : (settings?.[key] ?? "");

  const onChange = (key: string, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    const payload: Record<string, string> = { ...settings };
    for (const [k, v] of Object.entries(form)) {
      payload[k] = v;
    }
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setForm({});
        toast({ title: "Configurações salvas", description: "Credenciais do Zernio atualizadas." });
      },
      onError: () =>
        toast({ title: "Erro ao salvar", variant: "destructive" }),
    });
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL).then(() => {
      toast({ title: "URL copiada!" });
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const sensitiveField = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={key}
          type={revealed[key] ? "text" : "password"}
          placeholder={placeholder ?? label}
          value={currentValue(key)}
          onChange={(e) => onChange(key, e.target.value)}
          className="font-mono text-sm"
        />
        <Button variant="outline" size="icon" onClick={() => toggle(key)} type="button">
          {revealed[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Credenciais da API
        </CardTitle>
        <CardDescription>
          Configure a API key e o webhook secret do Zernio (inbox unificado de redes sociais). Os
          campos sensíveis são mascarados e nunca retornam o valor real após serem salvos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sensitiveField("zernio_api_key", "API Key", "sk_live_...")}
          {sensitiveField("zernio_webhook_secret", "Webhook Secret", "whsec_...")}
        </div>

        <div className="space-y-2">
          <Label>URL do Webhook</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={WEBHOOK_URL}
              className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={copyWebhookUrl} type="button">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configurações
          </Button>
        </div>

        <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Como configurar
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 mt-2 space-y-1 list-disc list-inside">
            <li>Cole aqui a API Key gerada no painel do Zernio</li>
            <li>No painel do Zernio, cadastre a "URL do Webhook" acima nas configurações de webhook</li>
            <li>Defina um secret para o webhook lá no Zernio e cole o mesmo valor aqui em "Webhook Secret"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
