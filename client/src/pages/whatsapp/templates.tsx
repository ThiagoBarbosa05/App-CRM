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
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useWhatsappTemplates,
  useWhatsappMetaTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type WhatsappTemplate,
  type MetaTemplate,
} from "@/hooks/use-whatsapp";
import { useAuth } from "@/hooks/useAuth";
import { MetaTemplateFormDialog } from "./meta-template-dialog";

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
  isActive: boolean;
};

const EMPTY_FORM: TemplateForm = {
  name: "",
  useCase: "campaign",
  languageCode: "pt_BR",
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
  const [search, setSearch] = useState(initial?.name ?? "");

  const { data: metaTemplates = [], isLoading: loadingMeta } = useWhatsappMetaTemplates();

  const filtered = metaTemplates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedMeta = metaTemplates.find((t) => t.name === form.name);

  const set = (key: keyof TemplateForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectTemplate = (t: MetaTemplate) => {
    setForm((prev) => ({ ...prev, name: t.name, languageCode: t.language }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar vínculo" : "Vincular template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Meta template picker */}
          <div className="space-y-1.5">
            <Label>Template aprovado no Meta</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8"
                placeholder="Buscar pelo nome do template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-52 border rounded-md">
              {loadingMeta ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {metaTemplates.length === 0
                    ? "Nenhum template aprovado encontrado. Atualize a lista na aba Meta."
                    : "Nenhum template corresponde à busca."}
                </div>
              ) : (
                <div className="p-1">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-sm text-sm hover:bg-accent transition-colors",
                        form.name === t.name && "bg-accent",
                      )}
                    >
                      <div className="font-mono font-medium">{t.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs py-0 h-4">
                          {t.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Globe className="h-3 w-3" />
                          {t.language}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {form.name && !selectedMeta && !loadingMeta && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Template <span className="font-mono">"{form.name}"</span> não está na lista de aprovados — pode não estar mais disponível.
              </p>
            )}
          </div>

          {/* Use case */}
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

          {/* Active */}
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
          <Button disabled={!form.name || isPending} onClick={() => onSubmit(form)}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { user } = useAuth();
  const canManageMeta = user?.role === "admin" || user?.role === "gerente";

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
          {canManageMeta && (
            <Button variant="outline" onClick={() => setMetaDialogOpen(true)} className="gap-2">
              <Globe className="h-4 w-4" />
              Criar no Meta
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Vincular template
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      <Tabs defaultValue="local">
        <TabsList>
          <TabsTrigger value="local">Vínculos locais ({localTemplates.length})</TabsTrigger>
          <TabsTrigger value="meta">Meta — aprovados</TabsTrigger>
        </TabsList>

        {/* Local templates */}
        <TabsContent value="local">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template (Meta)</TableHead>
                    <TableHead>Caso de uso</TableHead>
                    <TableHead className="hidden md:table-cell">Idioma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLocal &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  {!loadingLocal && localTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Nenhum vínculo criado. Use "Vincular template" para associar um template aprovado a um caso de uso.
                      </TableCell>
                    </TableRow>
                  )}
                  {localTemplates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono font-medium text-sm">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{USE_CASE_LABELS[t.useCase]}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {t.languageCode}
                        </div>
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
                      <TableCell className="font-mono font-medium text-sm">{t.name}</TableCell>
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

      {/* Create Meta template dialog */}
      <MetaTemplateFormDialog open={metaDialogOpen} onClose={() => setMetaDialogOpen(false)} />

      {/* Link / Edit dialog */}
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
            <AlertDialogTitle>Excluir vínculo</AlertDialogTitle>
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
