import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, MessageSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  useAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useToggleAutomationRule,
  useDeleteAutomationRule,
  useMessageTemplates,
} from "@/hooks/use-automations";
import type { AutomationRule } from "@shared/schema";

const TRIGGER_LABELS: Record<string, string> = {
  cashback_earned: "Cashback recebido na compra",
  cashback_expiring: "Cashback prestes a vencer",
  inactivity_reengagement: "Reengajamento por inatividade",
};

interface FormState {
  name: string;
  trigger: AutomationRule["trigger"];
  daysBeforeExpiry: string;
  attemptNumber: string;
  inactivityDays: string;
  smsEnabled: boolean;
  smsTemplateId: string;
  emailEnabled: boolean;
  emailTemplateId: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  trigger: "cashback_earned",
  daysBeforeExpiry: "7",
  attemptNumber: "1",
  inactivityDays: "15",
  smsEnabled: false,
  smsTemplateId: "",
  emailEnabled: false,
  emailTemplateId: "",
  isActive: true,
};

export function AutomationRulesTab() {
  const { data: rules = [], isLoading } = useAutomationRules();
  const { data: templates = [] } = useMessageTemplates();
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const toggleMutation = useToggleAutomationRule();
  const deleteMutation = useDeleteAutomationRule();
  const { user } = useAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const smsTemplates = useMemo(
    () => templates.filter((t) => t.channel === "sms" && t.isActive),
    [templates],
  );
  const emailTemplates = useMemo(
    () => templates.filter((t) => t.channel === "email" && t.isActive),
    [templates],
  );

  const templateName = (id: string | null) =>
    templates.find((t) => t.id === id)?.name ?? "—";

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingId(rule.id);
    const triggerParams = (rule.triggerParams ?? {}) as Record<string, unknown>;
    setForm({
      name: rule.name,
      trigger: rule.trigger,
      daysBeforeExpiry:
        triggerParams.daysBeforeExpiry !== undefined
          ? String(triggerParams.daysBeforeExpiry)
          : "7",
      attemptNumber:
        triggerParams.attemptNumber !== undefined
          ? String(triggerParams.attemptNumber)
          : "1",
      inactivityDays:
        triggerParams.inactivityDays !== undefined
          ? String(triggerParams.inactivityDays)
          : "15",
      smsEnabled: rule.smsEnabled,
      smsTemplateId: rule.smsTemplateId ?? "",
      emailEnabled: rule.emailEnabled,
      emailTemplateId: rule.emailTemplateId ?? "",
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        title: "Informe um nome para a regra",
        variant: "destructive",
      });
      return;
    }
    if (!form.smsEnabled && !form.emailEnabled) {
      toast({
        title: "Selecione ao menos um canal",
        description: "Habilite SMS e/ou e-mail para esta regra.",
        variant: "destructive",
      });
      return;
    }
    if (form.smsEnabled && !form.smsTemplateId) {
      toast({
        title: "Selecione um modelo de SMS",
        variant: "destructive",
      });
      return;
    }
    if (form.emailEnabled && !form.emailTemplateId) {
      toast({
        title: "Selecione um modelo de e-mail",
        variant: "destructive",
      });
      return;
    }
    if (
      form.trigger === "cashback_expiring" &&
      (!form.daysBeforeExpiry.trim() || Number(form.daysBeforeExpiry) < 0)
    ) {
      toast({
        title: "Informe quantos dias antes do vencimento enviar o lembrete",
        variant: "destructive",
      });
      return;
    }
    if (
      form.trigger === "inactivity_reengagement" &&
      (!form.attemptNumber.trim() || Number(form.attemptNumber) < 1)
    ) {
      toast({
        title: "Informe o número da tentativa (1, 2, 3...)",
        variant: "destructive",
      });
      return;
    }
    if (
      form.trigger === "inactivity_reengagement" &&
      (!form.inactivityDays.trim() || Number(form.inactivityDays) < 0)
    ) {
      toast({
        title: "Informe quantos dias sem comprar disparam esta tentativa",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: form.name.trim(),
      trigger: form.trigger,
      triggerParams:
        form.trigger === "cashback_expiring"
          ? { daysBeforeExpiry: Number(form.daysBeforeExpiry) }
          : form.trigger === "inactivity_reengagement"
            ? {
                attemptNumber: Number(form.attemptNumber),
                inactivityDays: Number(form.inactivityDays),
              }
            : {},
      smsEnabled: form.smsEnabled,
      smsTemplateId: form.smsEnabled ? form.smsTemplateId : null,
      emailEnabled: form.emailEnabled,
      emailTemplateId: form.emailEnabled ? form.emailTemplateId : null,
      isActive: form.isActive,
      createdBy: user?.id,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Regra atualizada com sucesso" });
      } else {
        await createMutation.mutateAsync(payload as any);
        toast({ title: "Regra criada com sucesso" });
      }
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar regra",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast({ title: "Regra excluída com sucesso" });
    } catch {
      toast({ title: "Erro ao excluir regra", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova regra
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando regras...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma regra de automação cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                    {rule.trigger === "cashback_expiring" &&
                      (rule.triggerParams as Record<string, unknown> | null)
                        ?.daysBeforeExpiry !== undefined && (
                        <span className="text-muted-foreground text-sm">
                          {" "}
                          (
                          {String(
                            (rule.triggerParams as Record<string, unknown>)
                              .daysBeforeExpiry,
                          )}{" "}
                          dia(s) antes)
                        </span>
                      )}
                    {rule.trigger === "inactivity_reengagement" &&
                      (() => {
                        const params = (rule.triggerParams ?? {}) as Record<
                          string,
                          unknown
                        >;
                        if (
                          params.attemptNumber === undefined ||
                          params.inactivityDays === undefined
                        )
                          return null;
                        return (
                          <span className="text-muted-foreground text-sm">
                            {" "}
                            (tentativa {String(params.attemptNumber)} —{" "}
                            {String(params.inactivityDays)} dia(s) sem
                            comprar)
                          </span>
                        );
                      })()}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {rule.smsEnabled && (
                      <Badge variant="outline" className="gap-1" title={templateName(rule.smsTemplateId)}>
                        <MessageSquare className="h-3 w-3" />
                        SMS
                      </Badge>
                    )}
                    {rule.emailEnabled && (
                      <Badge variant="outline" className="gap-1" title={templateName(rule.emailTemplateId)}>
                        <Mail className="h-3 w-3" />
                        E-mail
                      </Badge>
                    )}
                    {!rule.smsEnabled && !rule.emailEnabled && (
                      <span className="text-muted-foreground text-sm">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rule.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(rule.id)}
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
              {editingId ? "Editar regra de automação" : "Nova regra de automação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Aviso de cashback vencendo - 7 dias"
              />
            </div>
            <div>
              <Label>Gatilho</Label>
              <Select
                value={form.trigger}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, trigger: value as AutomationRule["trigger"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.trigger === "cashback_expiring" && (
              <div>
                <Label>Dias antes do vencimento</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.daysBeforeExpiry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, daysBeforeExpiry: e.target.value }))
                  }
                  placeholder="Ex.: 7"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O lembrete é enviado quando faltarem esse número de dias
                  para o cashback vencer. Crie uma regra para cada etapa da
                  régua (ex.: 21, 14, 7 e 1 dia antes), cada uma com seu
                  próprio texto.
                </p>
              </div>
            )}

            {form.trigger === "inactivity_reengagement" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Número da tentativa</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.attemptNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, attemptNumber: e.target.value }))
                    }
                    placeholder="Ex.: 1"
                  />
                </div>
                <div>
                  <Label>Dias sem comprar</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.inactivityDays}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, inactivityDays: e.target.value }))
                    }
                    placeholder="Ex.: 15"
                  />
                </div>
                <p className="text-xs text-muted-foreground col-span-2">
                  Crie uma regra para cada tentativa da régua (ex.: tentativa
                  1 aos 15 dias, tentativa 2 aos 30 dias, tentativa 3 aos 45
                  dias), cada uma com seu próprio texto. O disparo para
                  automaticamente quando o cliente volta a comprar ou quando
                  não houver mais tentativa configurada.
                </p>
              </div>
            )}

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">SMS</span>
                </div>
                <Switch
                  checked={form.smsEnabled}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, smsEnabled: checked }))
                  }
                />
              </div>
              {form.smsEnabled && (
                <Select
                  value={form.smsTemplateId}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, smsTemplateId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo de SMS" />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium">E-mail</span>
                </div>
                <Switch
                  checked={form.emailEnabled}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, emailEnabled: checked }))
                  }
                />
              </div>
              {form.emailEnabled && (
                <Select
                  value={form.emailTemplateId}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, emailTemplateId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo de e-mail" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label>Regra ativa</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked }))
                }
              />
            </div>
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

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra de automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A regra deixará de disparar
              mensagens imediatamente.
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
