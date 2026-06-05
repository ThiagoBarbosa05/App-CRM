import { useState } from "react";
import {
  Plus,
  FileText,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useWhatsappTemplates,
  useWhatsappMetaTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type WhatsappTemplate,
} from "@/hooks/use-whatsapp";

const USE_CASE_LABELS: Record<WhatsappTemplate["useCase"], string> = {
  birthday_today: "Aniversário (hoje)",
  birthday_days_before: "Aniversário (antecipado)",
  post_call: "Pós-chamada",
  campaign: "Campanha",
  custom: "Personalizado",
};

type TemplateForm = {
  name: string;
  useCase: WhatsappTemplate["useCase"];
  languageCode: string;
  category: string;
  description: string;
  isActive: boolean;
};

const EMPTY_FORM: TemplateForm = {
  name: "",
  useCase: "campaign",
  languageCode: "pt_BR",
  category: "",
  description: "",
  isActive: true,
};

function TemplateFormDialog({
  open,
  onClose,
  initial,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TemplateForm;
  onSubmit: (data: TemplateForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<TemplateForm>(initial ?? EMPTY_FORM);

  const set = (key: keyof TemplateForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="meu_template"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Caso de uso</Label>
            <Select value={form.useCase} onValueChange={(v) => set("useCase", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(USE_CASE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Input
                value={form.languageCode}
                onChange={(e) => set("languageCode", e.target.value)}
                placeholder="pt_BR"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="MARKETING"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descrição opcional"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              id="template-active"
            />
            <Label htmlFor="template-active">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.name || isPending}
            onClick={() => onSubmit(form)}
          >
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: localTemplates = [], isLoading: loadingLocal } = useWhatsappTemplates();
  const {
    data: metaTemplates = [],
    isLoading: loadingMeta,
    refetch: refetchMeta,
    isFetching: fetchingMeta,
  } = useWhatsappMetaTemplates();

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const handleSubmit = (form: TemplateForm) => {
    if (editingTemplate) {
      updateMutation.mutate(
        { id: editingTemplate.id, data: form },
        { onSuccess: closeDialog },
      );
    } else {
      createMutation.mutate(form, { onSuccess: closeDialog });
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const openEdit = (t: WhatsappTemplate) => {
    setEditingTemplate(t);
    setDialogOpen(true);
  };

  return (
    <div className="overflow-y-auto h-full p-5 lg:p-6">
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={FileText}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Templates</PageHeader.Title>
            <PageHeader.Description>Gerencie os templates de mensagem</PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      <Tabs defaultValue="local">
        <TabsList>
          <TabsTrigger value="local">Locais ({localTemplates.length})</TabsTrigger>
          <TabsTrigger value="meta">Meta — aprovados</TabsTrigger>
        </TabsList>

        {/* Local templates */}
        <TabsContent value="local">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Caso de uso</TableHead>
                    <TableHead className="hidden md:table-cell">Idioma</TableHead>
                    <TableHead className="hidden md:table-cell">Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLocal &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  {!loadingLocal && localTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhum template local criado ainda
                      </TableCell>
                    </TableRow>
                  )}
                  {localTemplates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{USE_CASE_LABELS[t.useCase]}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {t.languageCode}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {t.category || "—"}
                      </TableCell>
                      <TableCell>
                        {t.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0 gap-1">
                            <XCircle className="h-3 w-3" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(t)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setDeletingId(t.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meta templates */}
        <TabsContent value="meta">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Templates aprovados pela Meta</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={fetchingMeta}
                onClick={() => refetchMeta()}
              >
                <RefreshCw className={`h-4 w-4 ${fetchingMeta ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMeta &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  {!loadingMeta && metaTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        Nenhum template aprovado encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {metaTemplates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.category}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {t.language}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">
                          {t.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <TemplateFormDialog
          open={dialogOpen}
          onClose={closeDialog}
          initial={
            editingTemplate
              ? {
                  name: editingTemplate.name,
                  useCase: editingTemplate.useCase,
                  languageCode: editingTemplate.languageCode,
                  category: editingTemplate.category ?? "",
                  description: editingTemplate.description ?? "",
                  isActive: editingTemplate.isActive,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deletingId) deleteMutation.mutate(deletingId);
                setDeletingId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
