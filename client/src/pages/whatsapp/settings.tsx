import { useState, useEffect, useRef } from "react";
import {
  Settings2, CheckCircle, AlertCircle, Eye, EyeOff, Plus, Pencil, Trash2,
  Phone, Download, RefreshCw, ShieldCheck, ShieldAlert, Wifi, WifiOff,
  AlertTriangle, KeyRound, Loader2, UserCheck, MessageSquare, QrCode, Bot,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useWhatsappSettings,
  useWhatsappStatus,
  useUpdateWhatsappSettings,
  useWhatsappChannels,
  useCreateWhatsappChannel,
  useUpdateWhatsappChannel,
  useDeleteWhatsappChannel,
  useWabaPhoneNumbers,
  useChannelStatus,
  useRequestVerificationCode,
  useVerifyPhoneNumber,
  useCreateEvolutionChannel,
  useWhatsappBots,
  type WhatsappChannel,
  type MetaPhoneNumber,
  type CreateWhatsappChannelPayload,
} from "@/hooks/use-whatsapp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EvolutionChannelConnect } from "@/components/evolution-channel-connect";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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

interface User {
  id: string;
  name: string;
  role: string;
}

type ChannelForm = {
  name: string;
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
  displayPhone: string;
  userId: string;
  isActive: boolean;
};

const EMPTY_CHANNEL_FORM: ChannelForm = {
  name: "",
  phoneNumberId: "",
  accessToken: "",
  wabaId: "",
  displayPhone: "",
  userId: "",
  isActive: true,
};

// ── Helpers de status/qualidade Meta ──────────────────────────────────────────

function VerificationBadge({ status }: { status: MetaPhoneNumber["code_verification_status"] }) {
  if (status === "VERIFIED") {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 gap-1 text-xs px-1.5 py-0.5 shrink-0">
        <ShieldCheck className="h-3 w-3" /> Verificado
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 gap-1 text-xs px-1.5 py-0.5 shrink-0">
        <ShieldAlert className="h-3 w-3" /> Pendente
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-xs px-1.5 py-0.5 shrink-0">
      <AlertTriangle className="h-3 w-3" /> Não verificado
    </Badge>
  );
}

function ConnectionBadge({ status }: { status: MetaPhoneNumber["status"] }) {
  if (status === "CONNECTED") {
    return (
      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 gap-1 text-xs px-1.5 py-0.5 shrink-0">
        <Wifi className="h-3 w-3" /> Conectado
      </Badge>
    );
  }
  if (status === "FLAGGED" || status === "RESTRICTED") {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 gap-1 text-xs px-1.5 py-0.5 shrink-0">
        <AlertTriangle className="h-3 w-3" /> {status === "FLAGGED" ? "Sinalizado" : "Restrito"}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-xs px-1.5 py-0.5 shrink-0">
      <WifiOff className="h-3 w-3" /> Desconectado
    </Badge>
  );
}

function QualityDot({ rating }: { rating: MetaPhoneNumber["quality_rating"] }) {
  const colors: Record<string, string> = {
    GREEN: "bg-green-500",
    YELLOW: "bg-yellow-400",
    RED: "bg-red-500",
    UNKNOWN: "bg-slate-400",
  };
  const labels: Record<string, string> = {
    GREEN: "Qualidade alta",
    YELLOW: "Qualidade média",
    RED: "Qualidade baixa",
    UNKNOWN: "Qualidade desconhecida",
  };
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0 cursor-default", colors[rating] ?? "bg-slate-400")} />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{labels[rating] ?? "Qualidade desconhecida"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Dialog: criar/editar canal ────────────────────────────────────────────────

function ChannelDialog({
  open,
  onOpenChange,
  channel,
  users,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel: WhatsappChannel | null;
  users: User[];
  onSave: (data: CreateWhatsappChannelPayload) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ChannelForm>(EMPTY_CHANNEL_FORM);
  const [showToken, setShowToken] = useState(false);
  const isEditing = channel !== null;

  useEffect(() => {
    if (open) {
      setShowToken(false);
      if (channel) {
        setForm({
          name: channel.name,
          phoneNumberId: channel.phoneNumberId ?? "",
          accessToken: "",
          wabaId: channel.wabaId ?? "",
          displayPhone: channel.displayPhone ?? "",
          userId: channel.userId ?? "",
          isActive: channel.isActive,
        });
      } else {
        setForm(EMPTY_CHANNEL_FORM);
      }
    }
  }, [open, channel]);

  const handleSubmit = () => {
    const accessToken = form.accessToken.trim();
    const payload: CreateWhatsappChannelPayload = {
      name: form.name.trim(),
      phoneNumberId: form.phoneNumberId.trim(),
      ...(accessToken ? { accessToken } : {}),
      wabaId: form.wabaId.trim(),
      displayPhone: form.displayPhone.trim() || undefined,
      userId: form.userId || null,
      isActive: form.isActive,
    };
    onSave(payload);
  };

  const canSubmit =
    form.name.trim() &&
    form.phoneNumberId.trim() &&
    form.wabaId.trim() &&
    (!isEditing ? form.accessToken.trim() : true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90dvh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEditing ? "Editar canal" : "Novo canal de atendimento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do canal. Deixe o token em branco para mantê-lo."
              : "Preencha as credenciais do número no Meta para criar um canal."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-4 py-2 pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Nome do canal</Label>
              <Input
                id="ch-name"
                placeholder="Ex: João – Vendas SP"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ch-phone-id">Phone Number ID</Label>
                <Input
                  id="ch-phone-id"
                  placeholder="1234567890"
                  value={form.phoneNumberId}
                  onChange={(e) => setForm((p) => ({ ...p, phoneNumberId: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ch-waba-id">WABA ID</Label>
                <Input
                  id="ch-waba-id"
                  placeholder="987654321"
                  value={form.wabaId}
                  onChange={(e) => setForm((p) => ({ ...p, wabaId: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ch-token">
                Access Token{" "}
                {isEditing && (
                  <span className="text-muted-foreground font-normal text-xs">(deixe em branco para não alterar)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="ch-token"
                  type={showToken ? "text" : "password"}
                  placeholder={isEditing ? "••••••••" : "EAAxxxxx..."}
                  value={form.accessToken}
                  onChange={(e) => setForm((p) => ({ ...p, accessToken: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowToken((v) => !v)}
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ch-display-phone">
                  Número exibido{" "}
                  <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                </Label>
                <Input
                  id="ch-display-phone"
                  placeholder="+55 11 99999-0001"
                  value={form.displayPhone}
                  onChange={(e) => setForm((p) => ({ ...p, displayPhone: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Vendedor{" "}
                  <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                </Label>
                <Select
                  value={form.userId || "none"}
                  onValueChange={(v) => setForm((p) => ({ ...p, userId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Compartilhado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Compartilhado (todos)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Canal ativo</p>
                <p className="text-xs text-muted-foreground mt-0.5">Recebe e envia mensagens</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : isEditing ? "Salvar alterações" : "Criar canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: importar números da WABA ─────────────────────────────────────────

function ImportWabaDialog({
  open,
  onOpenChange,
  users,
  existingPhoneIds,
  onCreate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: User[];
  existingPhoneIds: Set<string>;
  onCreate: (data: CreateWhatsappChannelPayload) => void;
  isPending: boolean;
}) {
  const { data: wabaNumbers = [], isLoading, error, refetch } = useWabaPhoneNumbers(open);
  const [selected, setSelected] = useState<string | null>(null);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  const [channelUsers, setChannelUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) { setSelected(null); setChannelNames({}); setChannelUsers({}); }
  }, [open]);

  const newNumbers = wabaNumbers.filter((n) => !existingPhoneIds.has(n.id));
  const existingNumbers = wabaNumbers.filter((n) => existingPhoneIds.has(n.id));

  const handleImport = () => {
    if (!selected) return;
    const num = wabaNumbers.find((n) => n.id === selected);
    if (!num) return;
    onCreate({
      name: channelNames[selected]?.trim() || num.verified_name || num.display_phone_number,
      phoneNumberId: num.id,
      accessToken: "",
      wabaId: "",
      displayPhone: num.display_phone_number,
      userId: channelUsers[selected] || null,
      isActive: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] sm:w-full max-h-[90dvh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Importar números da WABA</DialogTitle>
          <DialogDescription>
            Selecione um número já cadastrado na sua conta Meta para criar um canal automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-3 py-2 pr-1">
            {isLoading && (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[72px] bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {error && !isLoading && (
              <div className="flex flex-col items-center gap-3 py-8 text-center rounded-xl border border-dashed">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Não foi possível carregar os números</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(error as Error).message}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </div>
            )}

            {!isLoading && !error && wabaNumbers.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-center rounded-xl border border-dashed">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum número encontrado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Adicione números no Meta Business Manager primeiro.</p>
                </div>
              </div>
            )}

            {newNumbers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                  Disponíveis para importar ({newNumbers.length})
                </p>
                <div className="space-y-2">
                  {newNumbers.map((num) => (
                    <div
                      key={num.id}
                      onClick={() => setSelected(selected === num.id ? null : num.id)}
                      className={cn(
                        "rounded-xl border p-3 cursor-pointer transition-all select-none",
                        selected === num.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected === num.id}
                          onCheckedChange={(v) => setSelected(v ? num.id : null)}
                          className="mt-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{num.verified_name || num.display_phone_number}</span>
                            <QualityDot rating={num.quality_rating} />
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">{num.display_phone_number}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <VerificationBadge status={num.code_verification_status} />
                            <ConnectionBadge status={num.status} />
                          </div>
                          <p className="text-[11px] text-muted-foreground/70 font-mono">ID: {num.id}</p>
                        </div>
                      </div>

                      {selected === num.id && (
                        <div
                          className="mt-3 pt-3 border-t border-border space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">Nome do canal</Label>
                              <Input
                                className="h-8 text-sm"
                                value={channelNames[num.id] ?? (num.verified_name || num.display_phone_number)}
                                onChange={(e) => setChannelNames((p) => ({ ...p, [num.id]: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">
                                Vendedor <span className="font-normal text-muted-foreground">(opcional)</span>
                              </Label>
                              <Select
                                value={channelUsers[num.id] || "none"}
                                onValueChange={(v) => setChannelUsers((p) => ({ ...p, [num.id]: v === "none" ? "" : v }))}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Compartilhado" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Compartilhado (todos)</SelectItem>
                                  {users.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              O Access Token precisa ser preenchido editando o canal após a importação.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {existingNumbers.length > 0 && (
              <div className="space-y-1.5 mt-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                  Já configurados ({existingNumbers.length})
                </p>
                <div className="space-y-2">
                  {existingNumbers.map((num) => (
                    <div
                      key={num.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 opacity-55"
                    >
                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{num.verified_name || num.display_phone_number}</p>
                        <p className="text-xs text-muted-foreground font-mono">{num.display_phone_number}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">Importado</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!selected || isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : "Importar canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: verificar número (OTP) ────────────────────────────────────────────

function VerifyDialog({
  channelId,
  open,
  onOpenChange,
}: {
  channelId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState<"method" | "code">("method");
  const [codeMethod, setCodeMethod] = useState<"SMS" | "VOICE">("SMS");
  const [code, setCode] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  const requestCode = useRequestVerificationCode();
  const verifyPhone = useVerifyPhoneNumber();

  useEffect(() => {
    if (!open) { setStep("method"); setCode(""); }
  }, [open]);

  useEffect(() => {
    if (step === "code") {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleRequestCode = async () => {
    if (channelId === null) return;
    await requestCode.mutateAsync({ id: channelId, codeMethod });
    setStep("code");
  };

  const handleVerify = async () => {
    if (channelId === null) return;
    await verifyPhone.mutateAsync({ id: channelId, code });
    onOpenChange(false);
  };

  const methodOptions = [
    {
      value: "SMS" as const,
      label: "SMS",
      description: "Código enviado por mensagem de texto",
      icon: MessageSquare,
    },
    {
      value: "VOICE" as const,
      label: "Chamada de voz",
      description: "Código lido por ligação automática",
      icon: Phone,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle>Verificar número</DialogTitle>
          </div>
          <DialogDescription>
            {step === "method"
              ? "Escolha como quer receber o código de 6 dígitos."
              : "Digite o código que você recebeu para ativar o número."}
          </DialogDescription>
        </DialogHeader>

        {step === "method" ? (
          <div className="space-y-2 py-1">
            {methodOptions.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setCodeMethod(m.value)}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                  codeMethod === m.value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  codeMethod === m.value ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <m.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <div className={cn(
                  "ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  codeMethod === m.value ? "border-primary" : "border-muted-foreground/30"
                )}>
                  {codeMethod === m.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="otp-code" className="text-sm font-medium">Código de verificação</Label>
              <Input
                id="otp-code"
                ref={codeInputRef}
                placeholder="• • • • • •"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              />
              <p className="text-xs text-muted-foreground text-center">
                {codeMethod === "SMS" ? "Enviado por SMS." : "Enviado por chamada de voz."}{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline font-medium"
                  onClick={() => setStep("method")}
                >
                  Reenviar
                </button>
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === "method" ? (
            <Button onClick={handleRequestCode} disabled={requestCode.isPending}>
              {requestCode.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                : "Enviar código"}
            </Button>
          ) : (
            <Button onClick={handleVerify} disabled={code.length < 4 || verifyPhone.isPending}>
              {verifyPhone.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</>
                : "Confirmar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Item de canal com status Meta ─────────────────────────────────────────────

function ChannelItem({
  ch,
  userMap,
  onEdit,
  onDelete,
  onVerify,
  readOnly = false,
}: {
  ch: WhatsappChannel;
  userMap: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
  onVerify: () => void;
  readOnly?: boolean;
}) {
  const [showStatus, setShowStatus] = useState(false);
  const [evoStatus, setEvoStatus] = useState<string>(ch.connectionStatus ?? "disconnected");
  const { data: metaStatus, isFetching, error: statusError } = useChannelStatus(showStatus ? ch.id : null);

  const handleRefresh = () => {
    setShowStatus(true);
  };

  // Cor da barra lateral por status de conexão (canais Evolution) ou por ativo/inativo
  const stripColor = (() => {
    if (!ch.isActive) return "bg-slate-300 dark:bg-slate-600";
    if (ch.provider === "evolution") {
      switch (evoStatus) {
        case "connected": return "bg-green-400 dark:bg-green-500";
        case "connecting": return "bg-amber-400 dark:bg-amber-500";
        case "qr": return "bg-blue-400 dark:bg-blue-500";
        default: return "bg-red-400 dark:bg-red-500"; // disconnected
      }
    }
    return "bg-green-400 dark:bg-green-500";
  })();

  return (
    <div className={cn(
      "py-3 first:pt-0 last:pb-0",
      "group"
    )}>
      <div className="flex items-start gap-3">
        {/* Status indicator strip */}
        <div className={cn(
          "mt-1 h-8 w-1 rounded-full shrink-0 self-center transition-colors",
          stripColor
        )} />

        <div className="flex-1 min-w-0">
          {/* Row 1: name + local badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{ch.name}</span>
            {ch.isActive ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 text-xs px-1.5 py-0">
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                Inativo
              </Badge>
            )}
          </div>

          {/* Row 2: phone + user */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              {ch.displayPhone || ch.phoneNumberId || ch.evolutionInstanceName || "—"}
            </span>
            {ch.userId && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserCheck className="h-3 w-3" />
                  {userMap[ch.userId] ?? ch.userId}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Evolution QR / Meta status */}
          {ch.provider === "evolution" ? (
            <div className="mt-2">
              <EvolutionChannelConnect channel={ch} onStatusChange={setEvoStatus} />
            </div>
          ) : (
            showStatus && (
              <div className="mt-2">
                {isFetching && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Consultando Meta...
                  </div>
                )}
                {statusError && !isFetching && (
                  <p className="text-xs text-destructive">
                    Erro ao buscar status. Verifique o token do canal.
                  </p>
                )}
                {metaStatus && !isFetching && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <QualityDot rating={metaStatus.quality_rating} />
                    <VerificationBadge status={metaStatus.code_verification_status} />
                    <ConnectionBadge status={metaStatus.status} />
                    {metaStatus.code_verification_status !== "VERIFIED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                        onClick={onVerify}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Verificar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center gap-0.5 shrink-0">
            <TooltipProvider delayDuration={400}>
              {ch.provider !== "evolution" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 transition-colors",
                        showStatus
                          ? "text-primary hover:text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={handleRefresh}
                    >
                      {isFetching
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Consultar status no Meta</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Editar canal</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Remover canal</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton de carregamento ──────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
      <div className="space-y-6 pb-10 max-w-2xl">
        <div className="h-14 bg-muted rounded-xl animate-pulse" />
        {[120, 200, 96].map((h, i) => (
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

// ── Dialog: criar canal Evolution (QR Code) ───────────────────────────────────

function EvolutionChannelDialog({
  open,
  onOpenChange,
  users,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: User[];
  onSave: (data: { name: string; userId?: string; displayPhone?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("none");
  const [displayPhone, setDisplayPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      userId: userId === "none" ? undefined : userId,
      displayPhone: displayPhone.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Novo canal via QR Code
          </DialogTitle>
          <DialogDescription>
            Cria um canal conectado ao número do vendedor por QR Code (Evolution API / Baileys).
            O vendedor mantém o WhatsApp funcionando no celular.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="evo-name">Nome do canal *</Label>
            <Input
              id="evo-name"
              placeholder="Ex: Vendas - João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evo-phone">Número de exibição</Label>
            <Input
              id="evo-phone"
              placeholder="(11) 99999-9999"
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Opcional — apenas para exibição. O número real é definido ao escanear o QR.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evo-user">Vendedor responsável</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="evo-user">
                <SelectValue placeholder="Selecionar vendedor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ Conexão não-oficial. Use números dedicados ao negócio. Não envie campanhas em massa por este canal.
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()} className="w-full sm:w-auto">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Criar canal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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

// ── Página principal ──────────────────────────────────────────────────────────

export default function WhatsAppSettings() {
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  const { data: settings, isLoading } = useWhatsappSettings();
  const { data: status } = useWhatsappStatus();
  const updateMutation = useUpdateWhatsappSettings();

  const { data: channels = [], isLoading: channelsLoading } = useWhatsappChannels();
  const createChannel = useCreateWhatsappChannel();
  const updateChannel = useUpdateWhatsappChannel();
  const deleteChannel = useDeleteWhatsappChannel();
  const createEvolutionChannel = useCreateEvolutionChannel();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Erro ao buscar usuários");
      return res.json();
    },
  });

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

  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [evolutionDialogOpen, setEvolutionDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<WhatsappChannel | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<number | null>(null);
  const [verifyingChannelId, setVerifyingChannelId] = useState<number | null>(null);

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

  const handleSaveChannel = (data: CreateWhatsappChannelPayload) => {
    if (editingChannel) {
      updateChannel.mutate(
        { id: editingChannel.id, data },
        { onSuccess: () => setChannelDialogOpen(false) },
      );
    } else {
      createChannel.mutate(data, { onSuccess: () => setChannelDialogOpen(false) });
    }
  };

  const handleImportChannel = (data: CreateWhatsappChannelPayload) => {
    createChannel.mutate(data, { onSuccess: () => setImportDialogOpen(false) });
  };

  const handleConfirmDelete = () => {
    if (deletingChannelId == null) return;
    deleteChannel.mutate(deletingChannelId, {
      onSuccess: () => setDeletingChannelId(null),
    });
  };

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const existingPhoneIds = new Set(channels.map((c) => c.phoneNumberId).filter((id): id is string => id !== null));

  const myChannels = isVendedor && user
    ? channels.filter((c) => c.userId === user.id)
    : channels;

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

  if (isVendedor) {
    return (
      <div className="overflow-y-auto h-full p-4 sm:p-5 lg:p-6">
        <div className="pb-10 max-w-2xl">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <QrCode className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Meu WhatsApp</CardTitle>
                  <CardDescription className="mt-0.5">
                    Reconecte seu canal escaneando o QR Code quando necessário.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {channelsLoading ? (
                <div className="space-y-2 pt-2">
                  <div className="h-[72px] bg-muted rounded-xl animate-pulse" />
                </div>
              ) : myChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-xl border-2 border-dashed border-border">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Phone className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum canal vinculado</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Solicite ao administrador que vincule um canal à sua conta.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {myChannels.map((ch) => (
                    <ChannelItem
                      key={ch.id}
                      ch={ch}
                      userMap={userMap}
                      readOnly
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onVerify={() => {}}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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

        {/* Channels card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">Canais de atendimento</CardTitle>
                  <CardDescription className="mt-0.5">
                    Um canal por número de telefone. Vincule vendedores para filtrar conversas por responsável.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setImportDialogOpen(true)}
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Importar da WABA</span>
                        <span className="sm:hidden">Importar</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Buscar números cadastrados na sua conta Meta</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEvolutionDialogOpen(true)}
                        className="gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Canal via QR</span>
                        <span className="sm:hidden">QR</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Conectar número do vendedor via QR Code (Evolution API)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  size="sm"
                  onClick={() => { setEditingChannel(null); setChannelDialogOpen(true); }}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Novo canal</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {channelsLoading ? (
              <div className="space-y-2 pt-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-[72px] bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-xl border-2 border-dashed border-border">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum canal configurado</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Importe da sua WABA ou adicione manualmente
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Importar da WABA
                  </Button>
                  <Button size="sm" onClick={() => { setEditingChannel(null); setChannelDialogOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo canal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {channels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    ch={ch}
                    userMap={userMap}
                    onEdit={() => { setEditingChannel(ch); setChannelDialogOpen(true); }}
                    onDelete={() => setDeletingChannelId(ch.id)}
                    onVerify={() => setVerifyingChannelId(ch.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bot shortcuts card */}
        <BotShortcutsCard />
      </div>

      {/* Dialogs */}
      <ChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channel={editingChannel}
        users={users}
        onSave={handleSaveChannel}
        isPending={createChannel.isPending || updateChannel.isPending}
      />

      <ImportWabaDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        users={users}
        existingPhoneIds={existingPhoneIds}
        onCreate={handleImportChannel}
        isPending={createChannel.isPending}
      />

      <VerifyDialog
        channelId={verifyingChannelId}
        open={verifyingChannelId !== null}
        onOpenChange={(v) => { if (!v) setVerifyingChannelId(null); }}
      />

      <EvolutionChannelDialog
        open={evolutionDialogOpen}
        onOpenChange={setEvolutionDialogOpen}
        users={users}
        onSave={({ name, userId, displayPhone }) =>
          createEvolutionChannel.mutate({ name, userId, displayPhone }, {
            onSuccess: () => setEvolutionDialogOpen(false),
          })
        }
        isPending={createEvolutionChannel.isPending}
      />

      <AlertDialog
        open={deletingChannelId !== null}
        onOpenChange={(v) => { if (!v) setDeletingChannelId(null); }}
      >
        <AlertDialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover canal?</AlertDialogTitle>
            <AlertDialogDescription>
              As conversas associadas serão mantidas, mas o canal não poderá mais receber ou enviar
              mensagens. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleteChannel.isPending}
            >
              {deleteChannel.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removendo...</>
                : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
