import { useState, useEffect } from "react";
import { Settings2, CheckCircle, AlertCircle, Eye, EyeOff, Plus, Pencil, Trash2, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  useWhatsappSettings,
  useWhatsappStatus,
  useUpdateWhatsappSettings,
  useWhatsappChannels,
  useCreateWhatsappChannel,
  useUpdateWhatsappChannel,
  useDeleteWhatsappChannel,
  type WhatsappChannel,
  type CreateWhatsappChannelPayload,
} from "@/hooks/use-whatsapp";
import { useQuery } from "@tanstack/react-query";

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
          phoneNumberId: channel.phoneNumberId,
          accessToken: "",
          wabaId: channel.wabaId,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar canal" : "Novo canal de atendimento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do canal</Label>
            <Input
              placeholder="Ex: João – Vendas SP"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Phone Number ID</Label>
            <Input
              placeholder="1234567890"
              value={form.phoneNumberId}
              onChange={(e) => setForm((p) => ({ ...p, phoneNumberId: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              ID do número na Meta — encontrado no Meta Business Suite → WhatsApp → Números.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>
              Access Token{" "}
              {isEditing && (
                <span className="text-muted-foreground font-normal">(deixe em branco para não alterar)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder={isEditing ? "••••••••" : "EAAxxxxx..."}
                value={form.accessToken}
                onChange={(e) => setForm((p) => ({ ...p, accessToken: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>WABA ID</Label>
            <Input
              placeholder="987654321"
              value={form.wabaId}
              onChange={(e) => setForm((p) => ({ ...p, wabaId: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Número exibido <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              placeholder="+55 11 99999-0001"
              value={form.displayPhone}
              onChange={(e) => setForm((p) => ({ ...p, displayPhone: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vendedor responsável <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select
              value={form.userId || "none"}
              onValueChange={(v) => setForm((p) => ({ ...p, userId: v === "none" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável (compartilhado)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável (compartilhado)</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-1">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppSettings() {
  const { data: settings, isLoading } = useWhatsappSettings();
  const { data: status } = useWhatsappStatus();
  const updateMutation = useUpdateWhatsappSettings();

  const { data: channels = [], isLoading: channelsLoading } = useWhatsappChannels();
  const createChannel = useCreateWhatsappChannel();
  const updateChannel = useUpdateWhatsappChannel();
  const deleteChannel = useDeleteWhatsappChannel();

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
  const [editingChannel, setEditingChannel] = useState<WhatsappChannel | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<number | null>(null);

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

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setChannelDialogOpen(true);
  };

  const handleOpenEdit = (channel: WhatsappChannel) => {
    setEditingChannel(channel);
    setChannelDialogOpen(true);
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

  const handleConfirmDelete = () => {
    if (deletingChannelId == null) return;
    deleteChannel.mutate(deletingChannelId, {
      onSuccess: () => setDeletingChannelId(null),
    });
  };

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

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

        {/* Channels card */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Canais de atendimento</CardTitle>
              <CardDescription className="mt-1">
                Cada canal corresponde a um número de telefone na mesma WABA. Associe um vendedor
                para que ele receba apenas as conversas do seu número.
              </CardDescription>
            </div>
            <Button size="sm" className="shrink-0" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo canal
            </Button>
          </CardHeader>
          <CardContent>
            {channelsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <Phone className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum canal configurado ainda.</p>
                <p className="text-xs text-muted-foreground">
                  Adicione números de telefone para atribuir a vendedores específicos.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{ch.name}</span>
                        {ch.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 text-xs px-1.5 py-0.5">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          {ch.displayPhone || ch.phoneNumberId}
                        </span>
                        {ch.userId && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {userMap[ch.userId] ?? ch.userId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(ch)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingChannelId(ch.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channel={editingChannel}
        users={users}
        onSave={handleSaveChannel}
        isPending={createChannel.isPending || updateChannel.isPending}
      />

      <AlertDialog
        open={deletingChannelId !== null}
        onOpenChange={(v) => { if (!v) setDeletingChannelId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover canal?</AlertDialogTitle>
            <AlertDialogDescription>
              As conversas associadas a este canal serão mantidas, mas o canal não poderá mais
              receber ou enviar mensagens. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleteChannel.isPending}
            >
              {deleteChannel.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
