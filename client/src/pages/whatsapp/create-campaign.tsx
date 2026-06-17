import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  FileText,
  Info,
  Send,
  Search,
  X,
  MessageCircle,
  Loader2,
  Bot,
  AlertTriangle,
  PhoneOff,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import {
  useWhatsappTemplates,
  useWhatsappBots,
  useWhatsappMetaTemplates,
  useCreateCampaignWithDispatch,
  type WhatsappTemplate,
  type WhatsappBot,
} from "@/hooks/use-whatsapp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getTemplateBodyText, getTemplateHeaderText, renderTemplateText } from "@/lib/whatsapp-template";

type Marker = { id: string; name: string; color?: string; type?: string };
type Client = { id: string; name: string; phone?: string | null };

const STEPS = [
  { id: 1, label: "Informações", icon: Info },
  { id: 2, label: "Clientes", icon: Users },
  { id: 3, label: "Template", icon: FileText },
  { id: 4, label: "Confirmar", icon: Send },
];

const USE_CASE_LABELS: Record<WhatsappTemplate["useCase"], string> = {
  birthday_today: "Aniversário (hoje)",
  birthday_days_before: "Aniversário (antecipado)",
  post_call: "Pós-chamada",
  campaign: "Campanha",
  custom: "Personalizado",
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto">
      {STEPS.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                  done
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : active
                    ? "border-primary text-primary bg-primary/10 shadow-sm"
                    : "border-muted-foreground/30 text-muted-foreground bg-background",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium hidden sm:block whitespace-nowrap",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-10 sm:w-16 mx-1 mb-4 sm:mb-5 rounded-full transition-all duration-300",
                  current > step.id ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Informações ───────────────────────────────────────────────────────

function StepInfo({
  title,
  description,
  onChange,
}: {
  title: string;
  description: string;
  onChange: (title: string, description: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="campaign-title">
          Título da campanha <span className="text-destructive">*</span>
        </Label>
        <Input
          id="campaign-title"
          value={title}
          onChange={(e) => onChange(e.target.value, description)}
          placeholder="Ex.: Promoção de aniversário junho"
          autoFocus
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">
          Usado internamente para identificar o disparo.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-desc">
          Descrição{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="campaign-desc"
          value={description}
          onChange={(e) => onChange(title, e.target.value)}
          placeholder="Descreva o objetivo da campanha"
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}

// ── Step 2: Clientes ──────────────────────────────────────────────────────────

function StepClients({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: markers = [] } = useQuery<Marker[]>({
    queryKey: ["/api/tags/markers"],
    queryFn: async () => {
      const res = await fetch("/api/tags/markers");
      if (!res.ok) throw new Error("Erro ao buscar marcadores");
      return res.json();
    },
  });

  const marcadores = useMemo(
    () => (markers as Marker[]).filter((m) => m.type === "marcador" || !m.type),
    [markers],
  );

  const { data: clientsResponse, isFetching } = useQuery({
    queryKey: ["/api/clients", "campaign-select", search, selectedMarkers, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedMarkers.length > 0) params.set("markers", selectedMarkers.join(","));
      params.set("page", String(currentPage));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar clientes");
      return res.json();
    },
  });

  const clients: Client[] = useMemo(() => clientsResponse?.data ?? [], [clientsResponse]);
  const hasNextPage = clientsResponse?.hasNextPage ?? false;
  const hasPhone = (c: Client) => Boolean(c.phone?.trim());

  const toggleMarker = (name: string) => {
    setSelectedMarkers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
    setCurrentPage(1);
  };

  const toggleClient = (client: Client) => {
    if (!hasPhone(client)) return;
    onChange(
      selectedIds.includes(client.id)
        ? selectedIds.filter((s) => s !== client.id)
        : [...selectedIds, client.id],
    );
  };

  const selectableIds = useMemo(() => clients.filter(hasPhone).map((c) => c.id), [clients]);

  const togglePageAll = () => {
    const allSelected =
      selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !selectableIds.includes(id)));
    } else {
      const newIds = [...selectedIds];
      selectableIds.forEach((id) => { if (!newIds.includes(id)) newIds.push(id); });
      onChange(newIds);
    }
  };

  const allOnPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Buscar por nome ou telefone"
          className="pl-9"
        />
      </div>

      {/* Marker filters */}
      {marcadores.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {marcadores.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMarker(m.name)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                selectedMarkers.includes(m.name)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/50",
              )}
            >
              {m.color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
              )}
              {m.name}
              {selectedMarkers.includes(m.name) && <X className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}

      {/* Selected count bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/8 border border-primary/20 rounded-xl">
          <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary flex-1">
            {selectedIds.length} cliente{selectedIds.length !== 1 ? "s" : ""} selecionado{selectedIds.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={() => onChange([])}
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePageAll}
                  disabled={selectableIds.length === 0}
                />
              </TableHead>
              <TableHead className="font-semibold">Nome</TableHead>
              <TableHead className="hidden sm:table-cell font-semibold">Telefone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isFetching && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            )}
            {!isFetching && clients.map((client) => {
              const selectable = hasPhone(client);
              const selected = selectedIds.includes(client.id);
              return (
                <TableRow
                  key={client.id}
                  className={cn(
                    "transition-colors",
                    selectable ? "cursor-pointer" : "opacity-50",
                    selected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-muted/40",
                  )}
                  onClick={() => toggleClient(client)}
                >
                  <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleClient(client)}
                      disabled={!selectable}
                      aria-label={`Selecionar ${client.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm", selected ? "font-semibold" : "font-medium")}>
                      {client.name}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {selectable ? (
                      <span className="text-sm text-muted-foreground font-mono">{client.phone}</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 text-muted-foreground border-dashed font-normal text-xs"
                      >
                        <PhoneOff className="h-3 w-3" />
                        Sem telefone
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {(currentPage > 1 || hasNextPage) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Próxima <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

const TRIGGER_LABELS: Record<WhatsappBot["triggerType"], string> = {
  keyword: "Palavra-chave",
  new_conversation: "Nova conversa",
};

// Pré-visualização estilo bolha WhatsApp
function TemplatePreview({ template }: { template: WhatsappTemplate }) {
  const { data: metaTemplates = [], isLoading } = useWhatsappMetaTemplates();
  const meta = metaTemplates.find((m) => m.name === template.name);

  if (isLoading) {
    return <div className="h-20 bg-muted rounded-xl animate-pulse mt-3" />;
  }

  if (!meta) {
    return (
      <div className="mt-3 flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          O template <strong>{template.name}</strong> não foi encontrado entre os aprovados pela Meta.
          Verifique em WhatsApp → Templates.
        </p>
      </div>
    );
  }

  const replacements: Record<string, string> = { nome: "[primeiro nome]" };
  const fallback = (v: string) => `[${v}]`;
  const header = renderTemplateText(getTemplateHeaderText(meta), replacements, fallback);
  const body = renderTemplateText(getTemplateBodyText(meta), replacements, fallback);

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Pré-visualização</p>
      <div className="rounded-xl bg-[#e7ffdb] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 p-3.5 max-w-sm shadow-sm">
        {header && (
          <p className="text-sm font-semibold text-foreground whitespace-pre-wrap mb-1">{header}</p>
        )}
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {body || "(Sem corpo de texto neste template.)"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Campos entre colchetes são substituídos por dados do contato no envio.
      </p>
    </div>
  );
}

// ── Step 3: Template / Bot ────────────────────────────────────────────────────

function StepTemplateOrBot({
  selectedTemplateId,
  selectedBotId,
  onSelectTemplate,
  onSelectBot,
}: {
  selectedTemplateId: string;
  selectedBotId: string;
  onSelectTemplate: (id: string) => void;
  onSelectBot: (id: string) => void;
}) {
  const { data: templates = [], isLoading: templatesLoading } = useWhatsappTemplates();
  const { data: bots = [], isLoading: botsLoading } = useWhatsappBots();
  const activeTemplates = templates.filter((t) => t.isActive);
  const activeBots = bots.filter((b) => b.isActive);
  const selectedTemplate = activeTemplates.find((t) => t.id === selectedTemplateId);
  const defaultTab = selectedBotId ? "bot" : "template";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full mb-4 h-10">
        <TabsTrigger value="template" className="flex-1 gap-1.5 text-sm">
          <FileText className="h-3.5 w-3.5" />
          Template
        </TabsTrigger>
        <TabsTrigger value="bot" className="flex-1 gap-1.5 text-sm">
          <Bot className="h-3.5 w-3.5" />
          Bot
        </TabsTrigger>
      </TabsList>

      <TabsContent value="template">
        {templatesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeTemplates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border-2 border-dashed border-border">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum template ativo</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Crie um template em{" "}
                <a href="/whatsapp/templates" className="text-primary underline underline-offset-2">
                  WhatsApp → Templates
                </a>{" "}
                antes de criar uma campanha.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelectTemplate(t.id); onSelectBot(""); }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  selectedTemplateId === t.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{t.name}</p>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs">{USE_CASE_LABELS[t.useCase]}</Badge>
                    <Badge variant="outline" className="text-xs font-mono">{t.languageCode}</Badge>
                  </div>
                </div>
                {selectedTemplateId === t.id && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-primary/10 text-primary text-sm font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    Selecionado
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
        {selectedTemplate && <TemplatePreview template={selectedTemplate} />}
      </TabsContent>

      <TabsContent value="bot">
        <div className="flex items-start gap-2.5 p-3.5 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Para contatos fora da janela de 24h, a Meta exige que a primeira mensagem do bot seja
            um <strong>template aprovado</strong>.
          </p>
        </div>
        {botsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeBots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border-2 border-dashed border-border">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum bot ativo</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Crie um bot em{" "}
                <a href="/whatsapp/bots" className="text-primary underline underline-offset-2">
                  WhatsApp → Bots
                </a>{" "}
                antes de criar uma campanha.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeBots.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { onSelectBot(b.id); onSelectTemplate(""); }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  selectedBotId === b.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{b.name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {TRIGGER_LABELS[b.triggerType]}
                    {b.triggerKeyword ? `: "${b.triggerKeyword}"` : ""}
                  </Badge>
                </div>
                {selectedBotId === b.id && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-primary/10 text-primary text-sm font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    Selecionado
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Step 4: Confirmação ───────────────────────────────────────────────────────

function StepConfirm({
  title,
  description,
  clientCount,
  templateId,
  botId,
  scheduledAt,
  onScheduleChange,
}: {
  title: string;
  description: string;
  clientCount: number;
  templateId: string;
  botId: string;
  scheduledAt: string;
  onScheduleChange: (value: string) => void;
}) {
  const { data: templates = [] } = useWhatsappTemplates();
  const { data: bots = [] } = useWhatsappBots();
  const template = templates.find((t) => t.id === templateId);
  const bot = bots.find((b) => b.id === botId);

  const mode = scheduledAt ? "schedule" : "now";
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const summaryRows = [
    { label: "Título", value: title },
    description ? { label: "Descrição", value: description } : null,
    { label: "Destinatários", value: `${clientCount} cliente${clientCount !== 1 ? "s" : ""}` },
    template ? { label: "Template", value: template.name } : null,
    bot ? { label: "Bot", value: bot.name } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="p-0">
          {summaryRows.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "flex items-start justify-between gap-4 px-5 py-3.5 text-sm",
                i < summaryRows.length - 1 && "border-b border-border"
              )}
            >
              <span className="text-muted-foreground shrink-0">{row.label}</span>
              <span className="font-semibold text-right break-words max-w-[60%]">{row.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold">Quando disparar?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "now", label: "Agora", icon: Send, action: () => onScheduleChange("") },
              { value: "schedule", label: "Agendar", icon: Clock, action: () => onScheduleChange(scheduledAt || minDateTime) },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={opt.action}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                  mode === opt.value
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>
          {mode === "schedule" && (
            <Input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => onScheduleChange(e.target.value)}
              className="font-mono"
            />
          )}
        </CardContent>
      </Card>

      {/* Info notice */}
      <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl">
        <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {mode === "schedule"
            ? `A campanha ficará agendada e ${clientCount} mensagem${clientCount !== 1 ? "ns" : ""} ${clientCount !== 1 ? "serão disparadas" : "será disparada"} automaticamente no horário escolhido.`
            : `${clientCount} mensagem${clientCount !== 1 ? "ns entrarão" : " entrará"} na fila de disparo imediatamente. O envio ocorre em segundo plano — acompanhe o progresso na tela da campanha.`}
        </p>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function WhatsAppCreateCampaign() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const createMutation = useCreateCampaignWithDispatch();

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return selectedClientIds.length > 0;
    if (step === 3) return selectedTemplateId.length > 0 || selectedBotId.length > 0;
    return true;
  }, [step, title, selectedClientIds, selectedTemplateId, selectedBotId]);

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigate("/whatsapp/campanhas");
  };

  const handleSubmit = useCallback(() => {
    const scheduledIso =
      scheduledAt && new Date(scheduledAt).getTime() > Date.now()
        ? new Date(scheduledAt).toISOString()
        : undefined;

    createMutation.mutate(
      {
        name: title,
        description,
        waTemplateId: selectedTemplateId || undefined,
        waBotId: selectedBotId || undefined,
        clientIds: selectedClientIds,
        scheduledAt: scheduledIso,
      },
      {
        onSuccess: (data) => {
          toast({
            title: scheduledIso ? "Campanha agendada!" : "Campanha enfileirada!",
            description: scheduledIso
              ? "Será disparada automaticamente no horário escolhido."
              : "O disparo será processado em segundo plano.",
          });
          navigate(`/whatsapp/campanhas/${data.campaignId}`);
        },
      },
    );
  }, [createMutation, title, description, selectedTemplateId, selectedBotId, selectedClientIds, scheduledAt, toast, navigate]);

  // Progress percentage for the top bar
  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top progress bar */}
      <div className="h-0.5 bg-muted shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="space-y-6 pb-6">

            {/* Header */}
            <PageHeader>
              <PageHeader.Info>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="shrink-0 h-9 w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <PageHeader.Icon
                  icon={MessageCircle}
                  color="text-green-600 dark:text-green-400"
                  bgColor="bg-green-50 dark:bg-green-900/30"
                />
                <PageHeader.Text>
                  <PageHeader.Title>Nova campanha</PageHeader.Title>
                  <PageHeader.Description>
                    Passo {step} de {STEPS.length} · {STEPS[step - 1].label}
                  </PageHeader.Description>
                </PageHeader.Text>
              </PageHeader.Info>
            </PageHeader>

            {/* Step indicator */}
            <StepIndicator current={step} />

            {/* Step content */}
            <div>
              {step === 1 && (
                <StepInfo
                  title={title}
                  description={description}
                  onChange={(t, d) => { setTitle(t); setDescription(d); }}
                />
              )}
              {step === 2 && (
                <StepClients
                  selectedIds={selectedClientIds}
                  onChange={setSelectedClientIds}
                />
              )}
              {step === 3 && (
                <StepTemplateOrBot
                  selectedTemplateId={selectedTemplateId}
                  selectedBotId={selectedBotId}
                  onSelectTemplate={setSelectedTemplateId}
                  onSelectBot={setSelectedBotId}
                />
              )}
              {step === 4 && (
                <StepConfirm
                  title={title}
                  description={description}
                  clientCount={selectedClientIds.length}
                  templateId={selectedTemplateId}
                  botId={selectedBotId}
                  scheduledAt={scheduledAt}
                  onScheduleChange={setScheduledAt}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom navigation */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 lg:px-6 py-3">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>

          <div className="flex items-center gap-2">
            {/* Dot progress indicator (mobile) */}
            <div className="flex items-center gap-1 sm:hidden mr-1">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-full transition-all",
                    step === s.id ? "w-4 h-1.5 bg-primary" : step > s.id ? "w-1.5 h-1.5 bg-primary/50" : "w-1.5 h-1.5 bg-muted"
                  )}
                />
              ))}
            </div>

            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-2 min-w-28">
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="gap-2 min-w-40"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {scheduledAt ? "Agendando..." : "Enfileirando..."}
                  </>
                ) : (
                  <>
                    {scheduledAt ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {scheduledAt ? "Agendar campanha" : "Disparar agora"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
