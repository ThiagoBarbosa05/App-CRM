import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Eye, MessageSquare, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  useMessageTemplates,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
  useTestSendMessageTemplate,
} from "@/hooks/use-automations";
import type { MessageTemplate } from "@shared/schema";

const USE_CASE_LABELS: Record<string, string> = {
  cashback_earned: "Cashback recebido",
  cashback_expiring: "Cashback vencendo",
  inactivity_reengagement: "Reengajamento por inatividade",
  custom: "Personalizado",
};

const SAMPLE_VARIABLES: Record<string, string | number> = {
  nome: "Maria Silva",
  valor: "R$ 50,00",
  data: "15/07/2026",
  dias: "30",
  data_ultima_compra: "10/06/2026",
};

interface TemplateVariable {
  key: string;
  label: string;
}

const VARIABLES_BY_USE_CASE: Record<string, TemplateVariable[]> = {
  cashback_earned: [
    { key: "nome", label: "Primeiro nome" },
    { key: "valor", label: "Valor" },
  ],
  cashback_expiring: [
    { key: "nome", label: "Primeiro nome" },
    { key: "valor", label: "Valor" },
    { key: "data", label: "Data" },
  ],
  inactivity_reengagement: [
    { key: "nome", label: "Primeiro nome" },
    { key: "dias", label: "Dias inativo" },
    { key: "data_ultima_compra", label: "Data da última compra" },
  ],
  custom: [
    { key: "nome", label: "Primeiro nome" },
    { key: "valor", label: "Valor" },
    { key: "data", label: "Data" },
  ],
};

function renderPreview(content: string) {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = SAMPLE_VARIABLES[key];
    return value === undefined ? match : String(value);
  });
}

interface FormState {
  name: string;
  channel: "sms" | "email";
  useCase: MessageTemplate["useCase"];
  subject: string;
  body: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  channel: "sms",
  useCase: "custom",
  subject: "",
  body: "",
  isActive: true,
};

export function MessageTemplatesTab() {
  const { data: templates = [], isLoading } = useMessageTemplates();
  const createMutation = useCreateMessageTemplate();
  const updateMutation = useUpdateMessageTemplate();
  const deleteMutation = useDeleteMessageTemplate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const testSendMutation = useTestSendMessageTemplate();
  const [testSendTemplate, setTestSendTemplate] = useState<MessageTemplate | null>(
    null,
  );
  const [testSendTo, setTestSendTo] = useState("");

  const filteredTemplates = useMemo(() => {
    if (channelFilter === "all") return templates;
    return templates.filter((t) => t.channel === channelFilter);
  }, [templates, channelFilter]);

  const availableVariables =
    VARIABLES_BY_USE_CASE[form.useCase] ?? VARIABLES_BY_USE_CASE.custom;

  const insertVariable = (
    field: "body" | "subject",
    variableKey: string,
  ) => {
    const placeholder = `{{${variableKey}}}`;
    const element = field === "body" ? bodyRef.current : subjectRef.current;
    const currentValue = form[field];

    if (!element) {
      setForm((f) => ({ ...f, [field]: `${currentValue}${placeholder}` }));
      return;
    }

    const start = element.selectionStart ?? currentValue.length;
    const end = element.selectionEnd ?? currentValue.length;
    const newValue =
      currentValue.slice(0, start) + placeholder + currentValue.slice(end);

    setForm((f) => ({ ...f, [field]: newValue }));

    requestAnimationFrame(() => {
      element.focus();
      const cursorPos = start + placeholder.length;
      element.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      channel: template.channel as "sms" | "email",
      useCase: template.useCase,
      subject: template.subject ?? "",
      body: template.body,
      isActive: template.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome e corpo da mensagem são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (form.channel === "email" && !form.subject.trim()) {
      toast({
        title: "Assunto obrigatório",
        description: "Templates de e-mail precisam de um assunto.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: form.name.trim(),
      channel: form.channel,
      useCase: form.useCase,
      subject: form.channel === "email" ? form.subject.trim() : null,
      body: form.body.trim(),
      isActive: form.isActive,
      createdBy: user?.id,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Modelo atualizado com sucesso" });
      } else {
        await createMutation.mutateAsync(payload as any);
        toast({ title: "Modelo criado com sucesso" });
      }
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar modelo",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast({ title: "Modelo excluído com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao excluir modelo",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const openTestSend = (template: MessageTemplate) => {
    setTestSendTemplate(template);
    setTestSendTo("");
  };

  const handleTestSend = async () => {
    if (!testSendTemplate || !testSendTo.trim()) {
      toast({
        title:
          testSendTemplate?.channel === "sms"
            ? "Informe um telefone para o teste"
            : "Informe um e-mail para o teste",
        variant: "destructive",
      });
      return;
    }

    try {
      await testSendMutation.mutateAsync({
        id: testSendTemplate.id,
        to: testSendTo.trim(),
      });
      toast({
        title: "Mensagem de teste enviada",
        description:
          testSendTemplate.channel === "sms"
            ? `SMS enviado para ${testSendTo.trim()}`
            : `E-mail enviado para ${testSendTo.trim()}`,
      });
      setTestSendTemplate(null);
    } catch (error) {
      toast({
        title: "Falha ao enviar mensagem de teste",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo modelo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Caso de uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando modelos...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredTemplates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum modelo de mensagem cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {template.channel === "sms" ? (
                        <MessageSquare className="h-3 w-3" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      {template.channel === "sms" ? "SMS" : "E-mail"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {USE_CASE_LABELS[template.useCase] ?? template.useCase}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        template.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }
                    >
                      {template.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Testar envio"
                      onClick={() => openTestSend(template)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar modelo de mensagem" : "Novo modelo de mensagem"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Lembrete de vencimento - etapa 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, channel: value as "sms" | "email" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Caso de uso</Label>
                <Select
                  value={form.useCase}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      useCase: value as MessageTemplate["useCase"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(USE_CASE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.channel === "email" && (
              <div>
                <Label>Assunto</Label>
                <Input
                  ref={subjectRef}
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Assunto do e-mail"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {availableVariables.map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs font-medium"
                      onClick={() => insertVariable("subject", variable.key)}
                    >
                      + {variable.label.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Corpo da mensagem</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {availableVariables.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs font-medium"
                    onClick={() => insertVariable("body", variable.key)}
                  >
                    + {variable.label.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Textarea
                ref={bodyRef}
                rows={5}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Use variáveis como {{nome}} e {{valor}}"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Clique em uma variável acima para inserir no texto, ou digite
                manualmente no formato {"{{nome}}"}.
              </p>
            </div>
            {form.body && (
              <div className="rounded-md border p-3 bg-muted/40 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Pré-visualização
                </p>
                {form.channel === "email" && form.subject && (
                  <p className="font-medium mb-1">{renderPreview(form.subject)}</p>
                )}
                <p className="whitespace-pre-wrap">{renderPreview(form.body)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="rounded-md border p-3 bg-muted/40 text-sm">
              {previewTemplate.channel === "email" && previewTemplate.subject && (
                <p className="font-medium mb-1">
                  {renderPreview(previewTemplate.subject)}
                </p>
              )}
              <p className="whitespace-pre-wrap">
                {renderPreview(previewTemplate.body)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!testSendTemplate}
        onOpenChange={(open) => !open && setTestSendTemplate(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Testar envio</DialogTitle>
          </DialogHeader>
          {testSendTemplate && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envia o modelo "{testSendTemplate.name}" com dados de exemplo
                para o {testSendTemplate.channel === "sms" ? "telefone" : "e-mail"}{" "}
                informado abaixo.
              </p>
              <div>
                <Label>
                  {testSendTemplate.channel === "sms"
                    ? "Telefone (com DDD)"
                    : "E-mail"}
                </Label>
                <Input
                  value={testSendTo}
                  onChange={(e) => setTestSendTo(e.target.value)}
                  placeholder={
                    testSendTemplate.channel === "sms"
                      ? "(11) 99999-9999"
                      : "voce@exemplo.com"
                  }
                  type={testSendTemplate.channel === "sms" ? "tel" : "email"}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestSendTemplate(null)}>
              Cancelar
            </Button>
            <Button onClick={handleTestSend} disabled={testSendMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {testSendMutation.isPending ? "Enviando..." : "Enviar teste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo de mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Regras de automação que usam esse
              modelo deixarão de enviar mensagens até que outro modelo seja
              selecionado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
