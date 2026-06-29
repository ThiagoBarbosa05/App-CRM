import { useState, useMemo, useRef } from "react";
import {
  Plus,
  FileText,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Globe,
  Search,
  Eye,
  AlertTriangle,
  ChevronRight,
  Upload,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  useWhatsappMetaTemplates,
  useDeleteMetaTemplate,
  useSetTemplateDefaultMedia,
  type MetaTemplate,
} from "@/hooks/use-whatsapp";
import { useAuth } from "@/hooks/useAuth";
import { MetaTemplateFormDialog } from "./meta-template-dialog";

// ── Status helpers ──────────────────────────────────────────────────────────────

type StatusStyle = { label: string; className: string; icon: typeof CheckCircle };

const STATUS_STYLES: Record<string, StatusStyle> = {
  APPROVED: {
    label: "Aprovado",
    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: CheckCircle,
  },
  PENDING: {
    label: "Em análise",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: Clock,
  },
  IN_APPEAL: {
    label: "Em recurso",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: Clock,
  },
  REJECTED: {
    label: "Rejeitado",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: XCircle,
  },
  PAUSED: {
    label: "Pausado",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    icon: Ban,
  },
  DISABLED: {
    label: "Desativado",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: Ban,
  },
  FLAGGED: {
    label: "Sinalizado",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: AlertTriangle,
  },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    icon: Clock,
  };
  const Icon = style.icon;
  return (
    <Badge className={cn("border-0 gap-1 shrink-0", style.className)}>
      <Icon className="h-3 w-3" />
      {style.label}
    </Badge>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

function QualityBadge({ score }: { score?: { score?: string } | null }) {
  const value = score?.score?.toUpperCase();
  if (!value || value === "UNKNOWN") return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    GREEN: "bg-green-500",
    YELLOW: "bg-yellow-400",
    RED: "bg-red-500",
  };
  const labels: Record<string, string> = { GREEN: "Alta", YELLOW: "Média", RED: "Baixa" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("h-2.5 w-2.5 rounded-full", map[value] ?? "bg-slate-400")} />
      {labels[value] ?? value}
    </span>
  );
}

// ── Extração de texto legível dos componentes Meta ──────────────────────────────

type MetaComponent = {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text?: string }[];
};

function readComponents(components: unknown[]) {
  const list = (components ?? []) as MetaComponent[];
  const header = list.find((c) => c.type?.toUpperCase() === "HEADER");
  const body = list.find((c) => c.type?.toUpperCase() === "BODY");
  const footer = list.find((c) => c.type?.toUpperCase() === "FOOTER");
  const buttons = list.find((c) => c.type?.toUpperCase() === "BUTTONS")?.buttons ?? [];
  return { header, body, footer, buttons };
}

// ── Configuração da mídia padrão de cabeçalho ───────────────────────────────────

const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

function TemplateMediaConfig({ template }: { template: MetaTemplate }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setMedia = useSetTemplateDefaultMedia();
  const { header } = readComponents(template.components);
  const format = header?.format?.toUpperCase();
  const accept =
    format === "IMAGE" ? "image/*" : format === "VIDEO" ? "video/*" : "application/pdf";

  const handleFile = (file?: File) => {
    if (!file) return;
    setMedia.mutate({ name: template.name, language: template.language, file });
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5" />
        Mídia padrão do cabeçalho
      </p>
      <p className="text-xs text-muted-foreground">
        Esta mídia será enviada no cabeçalho sempre que o template for enviado a um contato.
      </p>
      {template.headerMedia ? (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5" />
          Mídia configurada ({template.headerMedia.mediaType}).
        </p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Nenhuma mídia configurada — o envio ficará bloqueado até configurar.
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={setMedia.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        {setMedia.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {template.headerMedia ? "Substituir mídia" : "Configurar mídia"}
      </Button>
    </div>
  );
}

// ── Dialog de detalhes ──────────────────────────────────────────────────────────

function TemplateDetailsDialog({
  template,
  canManageMeta,
  onClose,
}: {
  template: MetaTemplate | null;
  canManageMeta: boolean;
  onClose: () => void;
}) {
  if (!template) return null;
  const { header, body, footer, buttons } = readComponents(template.components);
  const isMediaHeader = MEDIA_HEADER_FORMATS.includes((header?.format ?? "").toUpperCase());

  return (
    <Dialog open={!!template} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle className="font-mono text-base break-all">{template.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={template.status} />
            <Badge variant="outline">{CATEGORY_LABELS[template.category] ?? template.category}</Badge>
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              {template.language}
            </Badge>
          </div>

          {template.status === "REJECTED" && template.rejected_reason && (
            <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/15 px-3 py-2">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Motivo da rejeição
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {template.rejected_reason}
              </p>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            {header?.text && <p className="font-semibold">{header.text}</p>}
            {header && !header.text && header.format && header.format !== "TEXT" && (
              <p className="text-xs text-muted-foreground italic">[{header.format}]</p>
            )}
            {body?.text ? (
              <p className="whitespace-pre-wrap">{body.text}</p>
            ) : (
              <p className="text-muted-foreground italic">Sem corpo</p>
            )}
            {footer?.text && <p className="text-xs text-muted-foreground">{footer.text}</p>}
          </div>

          {buttons.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Botões</p>
              <div className="flex flex-wrap gap-1.5">
                {buttons.map((b, i) => (
                  <Badge key={i} variant="outline" className="font-normal">
                    {b.text || b.type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {canManageMeta && template.status === "APPROVED" && isMediaHeader && (
            <TemplateMediaConfig template={template} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Mobile card ──────────────────────────────────────────────────────────────────

function TemplateMobileCard({
  template,
  canDelete,
  onView,
  onDelete,
}: {
  template: MetaTemplate;
  canDelete: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const { body } = readComponents(template.components);

  return (
    <div className="p-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        <button type="button" className="flex-1 min-w-0 text-left space-y-2" onClick={onView}>
          <p className="text-sm font-mono font-medium truncate">{template.name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={template.status} />
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />{template.language}
            </span>
          </div>
          {body?.text && (
            <p className="text-xs text-muted-foreground line-clamp-2">{body.text}</p>
          )}
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-0.5" />
        </div>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "PENDING", label: "Em análise" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "OTHER", label: "Outros" },
] as const;

export default function WhatsAppTemplates() {
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [details, setDetails] = useState<MetaTemplate | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const { user } = useAuth();
  const canManageMeta = user?.role === "admin" || user?.role === "gerente";

  const {
    data: metaTemplates = [],
    isLoading,
    refetch,
    isFetching,
  } = useWhatsappMetaTemplates();

  const deleteMutation = useDeleteMetaTemplate();

  const filtered = useMemo(() => {
    return metaTemplates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "ALL") return true;
      if (statusFilter === "OTHER") {
        return !["APPROVED", "PENDING", "REJECTED"].includes(t.status);
      }
      return t.status === statusFilter;
    });
  }, [metaTemplates, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      approved: metaTemplates.filter((t) => t.status === "APPROVED").length,
      pending: metaTemplates.filter((t) => t.status === "PENDING").length,
      rejected: metaTemplates.filter((t) => t.status === "REJECTED").length,
    };
  }, [metaTemplates]);

  return (
    <div className="overflow-y-auto h-full p-3 sm:p-5 lg:p-6">
      <div className="space-y-4 sm:space-y-6 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={FileText}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-50 dark:bg-blue-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Templates</PageHeader.Title>
              <PageHeader.Description>
                Templates de mensagem da sua conta WhatsApp na Meta
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            {canManageMeta && (
              <Button onClick={() => setMetaDialogOpen(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Criar template
              </Button>
            )}
          </PageHeader.Actions>
        </PageHeader>

        {/* Resumo de status */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xl sm:text-2xl font-semibold leading-none">{counts.approved}</p>
                <p className="text-xs text-muted-foreground mt-1">Aprovados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-xl sm:text-2xl font-semibold leading-none">{counts.pending}</p>
                <p className="text-xs text-muted-foreground mt-1">Em análise</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xl sm:text-2xl font-semibold leading-none">{counts.rejected}</p>
                <p className="text-xs text-muted-foreground mt-1">Rejeitados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8"
              placeholder="Buscar pelo nome do template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista / Tabela */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center px-4">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {metaTemplates.length === 0
                    ? 'Nenhum template encontrado na sua conta Meta. Use "Criar template" para enviar o primeiro.'
                    : "Nenhum template corresponde aos filtros."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="md:hidden">
                  {filtered.map((t) => (
                    <TemplateMobileCard
                      key={`${t.id}-${t.language}`}
                      template={t}
                      canDelete={canManageMeta}
                      onView={() => setDetails(t)}
                      onDelete={() => setDeletingName(t.name)}
                    />
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="hidden md:table-cell">Idioma</TableHead>
                        <TableHead className="hidden lg:table-cell">Qualidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => (
                        <TableRow key={`${t.id}-${t.language}`}>
                          <TableCell className="font-mono font-medium text-sm">{t.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {CATEGORY_LABELS[t.category] ?? t.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {t.language}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <QualityBadge score={t.quality_score} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={t.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDetails(t)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canManageMeta && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => setDeletingName(t.name)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Criar template no Meta */}
      <MetaTemplateFormDialog open={metaDialogOpen} onClose={() => setMetaDialogOpen(false)} />

      {/* Detalhes */}
      <TemplateDetailsDialog
        template={details}
        canManageMeta={canManageMeta}
        onClose={() => setDetails(null)}
      />

      {/* Excluir */}
      <AlertDialog open={!!deletingName} onOpenChange={(v) => !v && setDeletingName(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template da Meta</AlertDialogTitle>
            <AlertDialogDescription>
              O template <span className="font-mono font-medium">{deletingName}</span> será removido
              permanentemente da sua conta Meta (todos os idiomas). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingName) {
                  deleteMutation.mutate(deletingName, {
                    onSuccess: () => setDeletingName(null),
                  });
                }
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
