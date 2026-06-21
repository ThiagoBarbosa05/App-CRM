import { useState, useMemo } from "react";
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
    <Badge className={cn("border-0 gap-1", style.className)}>
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

// ── Dialog de detalhes ──────────────────────────────────────────────────────────

function TemplateDetailsDialog({
  template,
  onClose,
}: {
  template: MetaTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;
  const { header, body, footer, buttons } = readComponents(template.components);

  return (
    <Dialog open={!!template} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{template.name}</DialogTitle>
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
        </div>
      </DialogContent>
    </Dialog>
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
              <PageHeader.Description>
                Templates de mensagem da sua conta WhatsApp na Meta
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            <Button
              variant="outline"
              className="gap-2"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Atualizar
            </Button>
            {canManageMeta && (
              <Button onClick={() => setMetaDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar template
              </Button>
            )}
          </PageHeader.Actions>
        </PageHeader>

        {/* Resumo de status */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-semibold leading-none">{counts.approved}</p>
                <p className="text-xs text-muted-foreground mt-1">Aprovados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-semibold leading-none">{counts.pending}</p>
                <p className="text-xs text-muted-foreground mt-1">Em análise</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-semibold leading-none">{counts.rejected}</p>
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

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
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
                {isLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      {metaTemplates.length === 0
                        ? 'Nenhum template encontrado na sua conta Meta. Use "Criar template" para enviar o primeiro.'
                        : "Nenhum template corresponde aos filtros."}
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  filtered.map((t) => (
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
          </CardContent>
        </Card>
      </div>

      {/* Criar template no Meta */}
      <MetaTemplateFormDialog open={metaDialogOpen} onClose={() => setMetaDialogOpen(false)} />

      {/* Detalhes */}
      <TemplateDetailsDialog template={details} onClose={() => setDetails(null)} />

      {/* Excluir */}
      <AlertDialog open={!!deletingName} onOpenChange={(v) => !v && setDeletingName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template da Meta</AlertDialogTitle>
            <AlertDialogDescription>
              O template <span className="font-mono font-medium">{deletingName}</span> será removido
              permanentemente da sua conta Meta (todos os idiomas). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
