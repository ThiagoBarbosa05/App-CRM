import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  Settings,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhatsappSettings, useUpdateWhatsappSettings } from "@/hooks/use-whatsapp-settings";
import {
  useWhatsappTemplates,
  useMetaTemplates,
  useCreateWhatsappTemplate,
  useUpdateWhatsappTemplate,
  useDeleteWhatsappTemplate,
  type WhatsappTemplate,
  type MetaTemplate,
} from "@/hooks/use-whatsapp-templates";
import { queryClient } from "@/lib/queryClient";

const MASK = "••••••••";

const USE_CASE_LABELS: Record<WhatsappTemplate["useCase"], string> = {
  birthday_today: "Aniversário (no dia)",
  birthday_days_before: "Aniversário (dias antes)",
  post_call: "Pós-chamada",
  campaign: "Campanha",
  custom: "Personalizado",
};

// ─── Aba: Credenciais ──────────────────────────────────────────────────────────

function CredentialsTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useWhatsappSettings();
  const updateMutation = useUpdateWhatsappSettings();

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

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
        toast({ title: "Configurações salvas", description: "Credenciais do WhatsApp atualizadas." });
      },
      onError: () =>
        toast({ title: "Erro ao salvar", variant: "destructive" }),
    });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await queryClient.fetchQuery({ queryKey: ["/api/whatsapp/templates/meta"] });
      toast({ title: "Conexão estabelecida", description: "Credenciais válidas e API acessível." });
    } catch {
      toast({
        title: "Falha na conexão",
        description: "Verifique o Access Token e o WABA ID.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const enabledValue = currentValue("wa_enabled") || "false";

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
          Configure as credenciais da WhatsApp Business Cloud API (Meta). Os campos sensíveis são
          mascarados e nunca retornam o valor real após serem salvos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-slate-50 dark:bg-slate-900">
          <Switch
            id="wa_enabled"
            checked={enabledValue === "true"}
            onCheckedChange={(checked) => onChange("wa_enabled", checked ? "true" : "false")}
          />
          <div>
            <Label htmlFor="wa_enabled" className="cursor-pointer font-medium">
              Integração WhatsApp ativa
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando desativado, nenhuma mensagem é enviada pelo WhatsApp
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sensitiveField("wa_phone_number_id", "Phone Number ID", "106540352242922")}
          {sensitiveField("wa_access_token", "Access Token", "EAAxxxxxx...")}
          <div className="space-y-2">
            <Label htmlFor="wa_waba_id">WABA ID (Business Account ID)</Label>
            <Input
              id="wa_waba_id"
              placeholder="102290129340398"
              value={currentValue("wa_waba_id")}
              onChange={(e) => onChange("wa_waba_id", e.target.value)}
            />
          </div>
          {sensitiveField("wa_webhook_verify_token", "Webhook Verify Token", "meu_token_secreto")}
          <div className="space-y-2">
            <Label htmlFor="wa_api_version">Versão da API</Label>
            <Input
              id="wa_api_version"
              placeholder="v21.0"
              value={currentValue("wa_api_version") || "v21.0"}
              onChange={(e) => onChange("wa_api_version", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa_message_delay_ms">Delay entre mensagens (ms)</Label>
            <Input
              id="wa_message_delay_ms"
              type="number"
              min="200"
              step="100"
              placeholder="1000"
              value={currentValue("wa_message_delay_ms") || "1000"}
              onChange={(e) => onChange("wa_message_delay_ms", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Intervalo mínimo entre envios em campanhas para evitar bloqueio
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configurações
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Testar conexão
          </Button>
        </div>

        <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Onde obter estas credenciais
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 mt-2 space-y-1 list-disc list-inside">
            <li>Acesse developers.facebook.com → Seu App → WhatsApp → Configuração</li>
            <li>Phone Number ID e WABA ID estão na seção "Enviar e receber mensagens"</li>
            <li>Access Token permanente: Meta Business Suite → Usuários do sistema</li>
            <li>Webhook Verify Token: valor que você escolhe e configura nos dois lugares</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Aba: Templates ────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  languageCode: z.string().min(1, "Idioma é obrigatório"),
  category: z.string().optional(),
  useCase: z.enum(["birthday_today", "birthday_days_before", "post_call", "campaign", "custom"]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type TemplateFormData = z.infer<typeof templateSchema>;

function TemplateDialog({
  template,
  metaTemplates,
  onClose,
}: {
  template?: WhatsappTemplate;
  metaTemplates: MetaTemplate[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createMutation = useCreateWhatsappTemplate();
  const updateMutation = useUpdateWhatsappTemplate();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: template
      ? {
          name: template.name,
          languageCode: template.languageCode,
          category: template.category ?? "",
          useCase: template.useCase,
          description: template.description ?? "",
          isActive: template.isActive,
        }
      : { languageCode: "pt_BR", isActive: true },
  });

  const onSubmit = (data: TemplateFormData) => {
    const mutation = template
      ? updateMutation.mutateAsync({ id: template.id, ...data })
      : createMutation.mutateAsync(data);

    mutation
      .then(() => {
        toast({
          title: template ? "Template atualizado" : "Template criado",
          description: `Template "${data.name}" salvo com sucesso.`,
        });
        onClose();
      })
      .catch(() => toast({ title: "Erro ao salvar template", variant: "destructive" }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do template (exato como no Meta)</Label>
        {metaTemplates.length > 0 ? (
          <Select onValueChange={(v) => setValue("name", v)} defaultValue={template?.name}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar template aprovado do Meta..." />
            </SelectTrigger>
            <SelectContent>
              {metaTemplates.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name}{" "}
                  <span className="text-muted-foreground text-xs ml-1">({t.language})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input placeholder="ex: aniversario_cliente" {...register("name")} />
        )}
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Código de idioma</Label>
          <Input placeholder="pt_BR" {...register("languageCode")} />
          {errors.languageCode && (
            <p className="text-xs text-red-500">{errors.languageCode.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input placeholder="MARKETING / UTILITY / AUTHENTICATION" {...register("category")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Caso de uso</Label>
        <Controller
          name="useCase"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o caso de uso..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(USE_CASE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.useCase && <p className="text-xs text-red-500">{errors.useCase.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          placeholder="Descreva quando este template é usado..."
          {...register("description")}
          rows={2}
        />
      </div>

      <div className="flex items-center gap-3">
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} id="isActive" />
          )}
        />
        <Label htmlFor="isActive">Template ativo</Label>
      </div>

      <div className="flex gap-2 pt-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {template ? "Atualizar" : "Criar template"}
        </Button>
      </div>
    </form>
  );
}

function TemplatesTab() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useWhatsappTemplates();
  const deleteMutation = useDeleteWhatsappTemplate();
  const toggleMutation = useUpdateWhatsappTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsappTemplate | undefined>();
  const [syncOpen, setSyncOpen] = useState(false);

  const { data: metaTemplates = [], isFetching: syncLoading, refetch: syncMeta } = useMetaTemplates(syncOpen);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: "Template removido" }),
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    });
  };

  const handleToggle = (t: WhatsappTemplate) => {
    toggleMutation.mutate(
      { id: t.id, isActive: !t.isActive },
      {
        onSuccess: () =>
          toast({ title: t.isActive ? "Template desativado" : "Template ativado" }),
      },
    );
  };

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (t: WhatsappTemplate) => {
    setEditing(t);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Templates de Mensagem
            </CardTitle>
            <CardDescription>
              Gerencie os templates aprovados no Meta mapeados a casos de uso do CRM.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSyncOpen(true);
                syncMeta();
              }}
            >
              {syncLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar do Meta
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo template
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum template cadastrado</p>
            <p className="text-xs mt-1">
              Clique em "Sincronizar do Meta" para importar templates aprovados
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Caso de uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.name}</TableCell>
                  <TableCell>{t.languageCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{USE_CASE_LABELS[t.useCase]}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 text-sm">
                        <XCircle className="h-4 w-4" /> Inativo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(t)}
                        title={t.isActive ? "Desativar" : "Ativar"}
                      >
                        {t.isActive ? (
                          <XCircle className="h-4 w-4 text-slate-400" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover o template{" "}
                              <strong>{t.name}</strong>? Automações que dependem dele precisarão
                              ser reconfiguradas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(t.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog: criar / editar template */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          <TemplateDialog
            template={editing}
            metaTemplates={metaTemplates}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: lista de templates do Meta para seleção */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Templates aprovados no Meta</DialogTitle>
          </DialogHeader>
          {syncLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : metaTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum template aprovado encontrado. Verifique as credenciais.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metaTemplates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-sm">{t.name}</TableCell>
                    <TableCell>{t.language}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSyncOpen(false);
                          setEditing(undefined);
                          setDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Cadastrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Aba: Automações ───────────────────────────────────────────────────────────

function AutomationsTab() {
  const { toast } = useToast();
  const { data: templates = [] } = useWhatsappTemplates();
  const { data: settings, isLoading } = useWhatsappSettings();
  const updateMutation = useUpdateWhatsappSettings();

  const [form, setForm] = useState<Record<string, string>>({});

  const activeTemplates = templates.filter((t) => t.isActive);
  const birthdayTodayTemplates = activeTemplates.filter((t) => t.useCase === "birthday_today");
  const birthdayBeforeTemplates = activeTemplates.filter(
    (t) => t.useCase === "birthday_days_before",
  );
  const postCallTemplates = activeTemplates.filter((t) => t.useCase === "post_call");

  const val = (key: string) => form[key] ?? settings?.[key] ?? "";
  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    updateMutation.mutate({ ...settings, ...form } as Record<string, string>, {
      onSuccess: () => {
        setForm({});
        toast({ title: "Automações salvas" });
      },
      onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aniversário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagem de Aniversário</CardTitle>
          <CardDescription>
            Configure quais templates são enviados no dia do aniversário e nos dias anteriores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="wa_birthday_enabled"
              checked={val("wa_birthday_enabled") === "true"}
              onCheckedChange={(c) => set("wa_birthday_enabled", c ? "true" : "false")}
            />
            <Label htmlFor="wa_birthday_enabled" className="cursor-pointer">
              Envio automático de aniversário ativo
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template — Aniversário no dia</Label>
              <Select
                value={val("wa_birthday_today_template_id")}
                onValueChange={(v) => set("wa_birthday_today_template_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {birthdayTodayTemplates.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Nenhum template de aniversário cadastrado
                    </SelectItem>
                  ) : (
                    birthdayTodayTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Template — Dias antes do aniversário</Label>
              <Select
                value={val("wa_birthday_before_template_id")}
                onValueChange={(v) => set("wa_birthday_before_template_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {birthdayBeforeTemplates.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Nenhum template cadastrado
                    </SelectItem>
                  ) : (
                    birthdayBeforeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias antes do aniversário</Label>
              <Input
                type="number"
                min="0"
                placeholder="1"
                value={val("wa_birthday_days_before")}
                onChange={(e) => set("wa_birthday_days_before", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Horário de envio</Label>
              <Input
                type="time"
                value={val("wa_birthday_send_time") || "09:00"}
                onChange={(e) => set("wa_birthday_send_time", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pós-chamada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagem Pós-Chamada</CardTitle>
          <CardDescription>
            Envie automaticamente um template ao cliente após o encerramento de uma chamada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="wa_post_call_enabled"
              checked={val("wa_post_call_enabled") === "true"}
              onCheckedChange={(c) => set("wa_post_call_enabled", c ? "true" : "false")}
            />
            <Label htmlFor="wa_post_call_enabled" className="cursor-pointer">
              Mensagem pós-chamada ativa
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={val("wa_post_call_template_id")}
                onValueChange={(v) => set("wa_post_call_template_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {postCallTemplates.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Nenhum template de pós-chamada cadastrado
                    </SelectItem>
                  ) : (
                    postCallTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Disparar quando</Label>
              <Select
                value={val("wa_post_call_trigger")}
                onValueChange={(v) => set("wa_post_call_trigger", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar condição..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Sempre (qualquer resultado)</SelectItem>
                  <SelectItem value="sim">Apenas se decisão = SIM</SelectItem>
                  <SelectItem value="nao">Apenas se decisão = NÃO</SelectItem>
                  <SelectItem value="sem_resposta">Apenas se sem resposta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar automações
        </Button>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

import { UmblerTagImport } from "@/components/umbler-tag-import";

export function WhatsappSettingsManagement() {
  return (
    <Tabs defaultValue="credentials" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="credentials">Credenciais</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="automations">Automações</TabsTrigger>
        <TabsTrigger value="tag-import">Etiquetas</TabsTrigger>
      </TabsList>

      <TabsContent value="credentials">
        <CredentialsTab />
      </TabsContent>

      <TabsContent value="templates">
        <TemplatesTab />
      </TabsContent>

      <TabsContent value="automations">
        <AutomationsTab />
      </TabsContent>

      <TabsContent value="tag-import">
        <UmblerTagImport />
      </TabsContent>
    </Tabs>
  );
}
