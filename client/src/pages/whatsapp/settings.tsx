import { useState, useEffect } from "react";
import {
  Settings2, CheckCircle, AlertCircle, Eye, EyeOff,
  Phone, ShieldCheck, Wifi,
  AlertTriangle, KeyRound, Loader2, Bot, ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useWhatsappSettings,
  useWhatsappStatus,
  useUpdateWhatsappSettings,
  useWhatsappBots,
} from "@/hooks/use-whatsapp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import WhatsappSectorsManagement from "@/components/whatsapp-sectors-management";
import { cn } from "@/lib/utils";
import {
  BOT_SHORTCUT_ICONS,
  DEFAULT_BOT_SHORTCUT_ICON,
  parseBotShortcuts,
  type BotShortcut,
  type BotShortcutIconKey,
} from "@/lib/bot-shortcut-icons";
import type { LucideIcon } from "lucide-react";

const MASKED = "••••••••";
const SENSITIVE_KEYS = ["wa_phone_number_id", "wa_access_token", "wa_waba_id", "wa_webhook_verify_token"] as const;

type SettingsForm = {
  wa_phone_number_id: string;
  wa_access_token: string;
  wa_waba_id: string;
  wa_app_id: string;
  wa_webhook_verify_token: string;
  wa_api_version: string;
  wa_enabled: boolean;
  wa_message_delay_ms: string;
};

type EditingFields = Record<(typeof SENSITIVE_KEYS)[number], boolean>;

// ── Card: atalhos de bots no chat ─────────────────────────────────────────────

const MAX_BOT_SHORTCUTS = 6;

function IconPickerPopover({
  value,
  onChange,
}: {
  value: BotShortcutIconKey;
  onChange: (icon: BotShortcutIconKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ValueIcon = BOT_SHORTCUT_ICONS[value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center shrink-0 text-primary hover:bg-muted transition-colors"
          title="Escolher ícone"
        >
          <ValueIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {(Object.entries(BOT_SHORTCUT_ICONS) as [BotShortcutIconKey, LucideIcon][]).map(
            ([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                  key === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BotShortcutsCard() {
  const { data: settings } = useWhatsappSettings();
  const { data: bots = [], isLoading: botsLoading } = useWhatsappBots();
  const updateSettings = useUpdateWhatsappSettings();

  const [selected, setSelected] = useState<BotShortcut[]>([]);

  useEffect(() => {
    setSelected(parseBotShortcuts(settings?.wa_bot_shortcut_ids));
  }, [settings?.wa_bot_shortcut_ids]);

  const activeBots = bots.filter((b) => b.isActive);
  const limitReached = selected.length >= MAX_BOT_SHORTCUTS;

  const toggleBot = (botId: string) => {
    setSelected((prev) =>
      prev.some((s) => s.botId === botId)
        ? prev.filter((s) => s.botId !== botId)
        : [...prev, { botId, icon: DEFAULT_BOT_SHORTCUT_ICON }],
    );
  };

  const setBotIcon = (botId: string, icon: BotShortcutIconKey) => {
    setSelected((prev) => prev.map((s) => (s.botId === botId ? { ...s, icon } : s)));
  };

  const hasChanges =
    JSON.stringify(selected) !== JSON.stringify(parseBotShortcuts(settings?.wa_bot_shortcut_ids));

  const handleSave = () => {
    updateSettings.mutate({ wa_bot_shortcut_ids: JSON.stringify(selected) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <CardTitle className="text-base">Atalhos de bots</CardTitle>
            <CardDescription className="mt-0.5">
              Escolha até {MAX_BOT_SHORTCUTS} bots e um ícone para cada um. Eles aparecem como
              atalhos de um clique no chat de conversas.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {botsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activeBots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum bot ativo encontrado.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border">
              {activeBots.map((bot) => {
                const shortcut = selected.find((s) => s.botId === bot.id);
                const checked = !!shortcut;
                const disabled = !checked && limitReached;
                return (
                  <div
                    key={bot.id}
                    className={cn(
                      "flex items-center gap-3 py-2.5",
                      disabled && "opacity-50",
                    )}
                  >
                    <label className={cn("flex items-center gap-3 flex-1 min-w-0 cursor-pointer", disabled && "cursor-not-allowed")}>
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggleBot(bot.id)}
                      />
                      <span className="text-sm font-medium truncate">{bot.name}</span>
                    </label>
                    {checked && (
                      <IconPickerPopover
                        value={shortcut.icon}
                        onChange={(icon) => setBotIcon(bot.id, icon)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {limitReached && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Limite de {MAX_BOT_SHORTCUTS} atalhos atingido. Remova um para adicionar outro.
              </p>
            )}
            <div className="flex justify-end mt-4">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || updateSettings.isPending}
              >
                {updateSettings.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  : "Salvar atalhos"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Skeleton de carregamento ──────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
      <div className="space-y-6 pb-10 max-w-2xl">
        <div className="h-14 bg-muted rounded-xl animate-pulse" />
        {[120, 200].map((h, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
            <div className="px-6 py-4 border-b border-border bg-muted/30" style={{ height: 60 }} />
            <div className="p-6" style={{ height: h }}>
              <div className="space-y-3">
                {Array.from({ length: Math.ceil(h / 44) }).map((_, j) => (
                  <div key={j} className="h-9 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function WhatsAppSettings() {
  const { data: settings, isLoading } = useWhatsappSettings();
  const { data: status } = useWhatsappStatus();
  const updateMutation = useUpdateWhatsappSettings();

  const [form, setForm] = useState<SettingsForm>({
    wa_phone_number_id: "",
    wa_access_token: "",
    wa_waba_id: "",
    wa_app_id: "",
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
        wa_app_id: settings.wa_app_id ?? "",
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
      wa_app_id: form.wa_app_id,
      wa_enabled: String(form.wa_enabled),
      wa_message_delay_ms: form.wa_message_delay_ms,
    };
    SENSITIVE_KEYS.forEach((key) => {
      if (editing[key] && form[key] !== MASKED && form[key].trim() !== "") {
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

  const SENSITIVE_FIELDS: {
    key: (typeof SENSITIVE_KEYS)[number];
    label: string;
    placeholder: string;
    icon: React.ElementType;
  }[] = [
    { key: "wa_phone_number_id", label: "Phone Number ID", placeholder: "1234567890", icon: Phone },
    { key: "wa_access_token", label: "Access Token", placeholder: "EAAxxxxx...", icon: KeyRound },
    { key: "wa_waba_id", label: "WABA ID", placeholder: "987654321", icon: Settings2 },
    { key: "wa_webhook_verify_token", label: "Webhook Verify Token", placeholder: "meu-token-secreto", icon: ShieldCheck },
  ];

  const hasUnsavedEdits = SENSITIVE_KEYS.some((k) => editing[k] && form[k].trim() !== "");

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
      <div className="space-y-5 pb-10">

        {/* Header */}
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
                  <span className="hidden sm:inline">{status.enabled ? "Conectado" : "Configurado (desabilitado)"}</span>
                  <span className="sm:hidden">{status.enabled ? "OK" : "Desabilitado"}</span>
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 gap-1.5 px-3 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Não configurado</span>
                  <span className="sm:hidden">Pendente</span>
                </Badge>
              )}
            </PageHeader.Actions>
          )}
        </PageHeader>

        {/* Credentials card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-base">Credenciais da API</CardTitle>
                <CardDescription className="mt-0.5">
                  Dados sensíveis mascarados. Clique em "Editar" para alterar um campo.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {SENSITIVE_FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
              <div
                key={key}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  editing[key] ? "border-primary/50 bg-primary/3" : "border-border bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-default">
                    {label}
                  </Label>
                  {!editing[key] && form[key] && form[key] !== "" && (
                    <CheckCircle className="h-3 w-3 text-green-500 ml-auto shrink-0" />
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={editing[key] && showValues[key] ? "text" : editing[key] ? "password" : "text"}
                      value={editing[key] ? form[key] : form[key] || MASKED}
                      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      disabled={!editing[key]}
                      placeholder={placeholder}
                      className={cn(
                        "font-mono text-sm h-9",
                        !editing[key] && "text-muted-foreground bg-transparent border-transparent px-0 focus-visible:ring-0 cursor-default select-none"
                      )}
                    />
                    {editing[key] && (
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowValues((prev) => ({ ...prev, [key]: !prev[key] }))}
                        tabIndex={-1}
                      >
                        {showValues[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  <Button
                    variant={editing[key] ? "secondary" : "outline"}
                    size="sm"
                    className="h-9 shrink-0"
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configurações gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="app-id">App ID</Label>
              <Input
                id="app-id"
                value={form.wa_app_id}
                onChange={(e) => setForm((prev) => ({ ...prev, wa_app_id: e.target.value }))}
                placeholder="1234567890123456"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                ID do aplicativo Meta. Necessário para upload de mídia ao criar templates (cabeçalho com imagem/vídeo/documento).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="api-version">Versão da API</Label>
                <Input
                  id="api-version"
                  value={form.wa_api_version}
                  onChange={(e) => setForm((prev) => ({ ...prev, wa_api_version: e.target.value }))}
                  placeholder="v20.0"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delay">Delay entre mensagens</Label>
                <div className="relative">
                  <Input
                    id="delay"
                    type="number"
                    value={form.wa_message_delay_ms}
                    onChange={(e) => setForm((prev) => ({ ...prev, wa_message_delay_ms: e.target.value }))}
                    min={0}
                    className="pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    ms
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Recomendado: 1000ms entre mensagens.</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3.5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  form.wa_enabled ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                )}>
                  <Wifi className={cn("h-4 w-4 transition-colors", form.wa_enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-sm font-medium">WhatsApp habilitado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.wa_enabled ? "Enviando e recebendo mensagens" : "Envio de mensagens pausado"}
                  </p>
                </div>
              </div>
              <Switch
                checked={form.wa_enabled}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, wa_enabled: v }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border px-4 py-3 bg-card">
          {hasUnsavedEdits && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Há campos em edição não salvos
            </p>
          )}
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="sm:ml-auto w-full sm:w-auto min-w-36"
          >
            {updateMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              : updateMutation.isSuccess
                ? <><CheckCircle className="h-4 w-4 mr-2" /> Salvo</>
                : "Salvar configurações"}
          </Button>
        </div>

        {/* Link para a página de canais (isolada para não acumular várias
            conexões SSE de status Evolution ao vivo nesta mesma tela) */}
        <Link href="/whatsapp/canais">
          <Card className="cursor-pointer hover:border-primary/40 transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">Canais de atendimento</CardTitle>
                <CardDescription className="mt-0.5">
                  Gerencie números, conexões via QR Code e setor padrão de cada canal.
                </CardDescription>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>

        {/* Setores de atendimento card */}
        <WhatsappSectorsManagement />

        {/* Bot shortcuts card */}
        <BotShortcutsCard />
      </div>
    </div>
  );
}
