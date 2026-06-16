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
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useWhatsappTemplates, useWhatsappBots, useWhatsappMetaTemplates, useCreateCampaignWithDispatch, type WhatsappTemplate, type WhatsappBot } from "@/hooks/use-whatsapp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, AlertTriangle, PhoneOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getTemplateBodyText, getTemplateHeaderText, renderTemplateText } from "@/lib/whatsapp-template";

type Marker = { id: string; name: string; color?: string; type?: string };
type Client = { id: string; name: string; phone?: string | null };

const STEPS = [
  { id: 1, label: "Informações", icon: Info },
  { id: 2, label: "Clientes", icon: Users },
  { id: 3, label: "Template", icon: FileText },
  { id: 4, label: "Confirmação", icon: Send },
];

const USE_CASE_LABELS: Record<WhatsappTemplate["useCase"], string> = {
  birthday_today: "Aniversário (hoje)",
  birthday_days_before: "Aniversário (antecipado)",
  post_call: "Pós-chamada",
  campaign: "Campanha",
  custom: "Personalizado",
};

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                  done
                    ? "bg-primary border-primary text-primary-foreground"
                    : active
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted text-muted-foreground bg-background",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-12 sm:w-20 mx-1 mb-5 transition-all",
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

// Step 1
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
        <Label>Título da campanha *</Label>
        <Input
          value={title}
          onChange={(e) => onChange(e.target.value, description)}
          placeholder="Ex.: Promoção de aniversário junho"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => onChange(title, e.target.value)}
          placeholder="Descreva o objetivo da campanha"
          rows={3}
        />
      </div>
    </div>
  );
}

// Step 2
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

  const clients: Client[] = useMemo(
    () => clientsResponse?.data ?? [],
    [clientsResponse],
  );
  const hasNextPage = clientsResponse?.hasNextPage ?? false;

  const hasPhone = (c: Client) => Boolean(c.phone?.trim());

  const toggleMarker = (name: string) => {
    setSelectedMarkers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
    setCurrentPage(1);
  };

  const toggleClient = (client: Client) => {
    if (!hasPhone(client)) return; // não permite selecionar contatos sem telefone
    onChange(
      selectedIds.includes(client.id)
        ? selectedIds.filter((s) => s !== client.id)
        : [...selectedIds, client.id],
    );
  };

  // Apenas contatos com telefone são selecionáveis (a API do WhatsApp exige número).
  const selectableIds = useMemo(
    () => clients.filter(hasPhone).map((c) => c.id),
    [clients],
  );

  const togglePageAll = () => {
    const allSelected =
      selectableIds.length > 0 &&
      selectableIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !selectableIds.includes(id)));
    } else {
      const newIds = [...selectedIds];
      selectableIds.forEach((id) => { if (!newIds.includes(id)) newIds.push(id); });
      onChange(newIds);
    }
  };

  const allOnPageSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Buscar por nome ou telefone"
          className="pl-9"
        />
      </div>

      {/* Marker filters */}
      {marcadores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {marcadores.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMarker(m.name)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                selectedMarkers.includes(m.name)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground",
              )}
            >
              {m.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
              )}
              {m.name}
              {selectedMarkers.includes(m.name) && <X className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}

      {/* Selected count */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            {selectedIds.length} cliente(s) selecionado(s)
          </span>
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange([])}
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePageAll}
                  disabled={selectableIds.length === 0}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Telefone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isFetching && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            )}
            {!isFetching &&
              clients.map((client) => {
                const selectable = hasPhone(client);
                return (
                  <TableRow
                    key={client.id}
                    className={cn(
                      selectable ? "cursor-pointer" : "opacity-60",
                      selectedIds.includes(client.id) && "bg-primary/5",
                    )}
                    onClick={() => toggleClient(client)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(client.id)}
                        onCheckedChange={() => toggleClient(client)}
                        disabled={!selectable}
                        aria-label={`Selecionar ${client.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {selectable ? (
                        <span className="text-muted-foreground">{client.phone}</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-muted-foreground border-dashed font-normal"
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
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Próxima
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

// Pré-visualização do template aprovado (corpo + variáveis) — estilo bolha do WhatsApp.
function TemplatePreview({ template }: { template: WhatsappTemplate }) {
  const { data: metaTemplates = [], isLoading } = useWhatsappMetaTemplates();
  const meta = metaTemplates.find((m) => m.name === template.name);

  if (isLoading) {
    return (
      <div className="mt-4 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
    );
  }

  if (!meta) {
    return (
      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          O template <strong>{template.name}</strong> não foi encontrado entre os
          aprovados pela Meta. Verifique em WhatsApp → Templates.
        </p>
      </div>
    );
  }

  // {{nome}} é preenchido automaticamente no disparo com o primeiro nome do contato.
  const replacements: Record<string, string> = { nome: "[primeiro nome]" };
  const fallback = (v: string) => `[${v}]`;
  const header = renderTemplateText(getTemplateHeaderText(meta), replacements, fallback);
  const body = renderTemplateText(getTemplateBodyText(meta), replacements, fallback);

  return (
    <div className="mt-4 space-y-2">
      <Label className="text-xs text-muted-foreground">Pré-visualização da mensagem</Label>
      <div className="rounded-xl bg-[#e7ffdb] dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 max-w-md">
        {header && (
          <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">{header}</p>
        )}
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {body || "(Sem corpo de texto neste template.)"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Campos entre colchetes são substituídos por dados do contato no momento do disparo.
      </p>
    </div>
  );
}

// Step 3
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
      <TabsList className="w-full mb-4">
        <TabsTrigger value="template" className="flex-1 gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Template
        </TabsTrigger>
        <TabsTrigger value="bot" className="flex-1 gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          Bot
        </TabsTrigger>
      </TabsList>

      <TabsContent value="template">
        {templatesLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeTemplates.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <FileText className="h-7 w-7 text-slate-400" />
            </div>
            <p className="mt-4 font-medium text-foreground">Nenhum template ativo</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie um template em{" "}
              <a href="/whatsapp/templates" className="text-primary underline">
                WhatsApp → Templates
              </a>{" "}
              antes de criar uma campanha.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelectTemplate(t.id); onSelectBot(""); }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  selectedTemplateId === t.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{t.name}</p>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {USE_CASE_LABELS[t.useCase]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {t.languageCode}
                    </Badge>
                  </div>
                </div>
                {selectedTemplateId === t.id && (
                  <div className="flex items-center gap-1.5 mt-2 text-primary text-sm font-medium">
                    <Check className="h-4 w-4" />
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
        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Para iniciar uma conversa com contatos fora da janela de 24h, a Meta
            exige que a primeira mensagem do bot seja um <strong>template aprovado</strong>.
            Garanta que o fluxo do bot comece por um nó de mensagem do tipo template.
          </p>
        </div>
        {botsLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeBots.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <Bot className="h-7 w-7 text-slate-400" />
            </div>
            <p className="mt-4 font-medium text-foreground">Nenhum bot ativo</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie um bot em{" "}
              <a href="/whatsapp/bots" className="text-primary underline">
                WhatsApp → Bots
              </a>{" "}
              antes de criar uma campanha.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeBots.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { onSelectBot(b.id); onSelectTemplate(""); }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  selectedBotId === b.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{b.name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {TRIGGER_LABELS[b.triggerType]}
                    {b.triggerKeyword ? `: "${b.triggerKeyword}"` : ""}
                  </Badge>
                </div>
                {selectedBotId === b.id && (
                  <div className="flex items-center gap-1.5 mt-2 text-primary text-sm font-medium">
                    <Check className="h-4 w-4" />
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

// Step 4
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
  // valor mínimo do seletor = agora (em horário local, formato datetime-local)
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Título</span>
            <span className="font-medium text-right max-w-[60%] truncate">{title}</span>
          </div>
          {description && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Descrição</span>
              <span className="font-medium text-right max-w-[60%] line-clamp-2">{description}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Clientes selecionados</span>
            <span className="font-medium">{clientCount}</span>
          </div>
          {template && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium text-right max-w-[60%] truncate">{template.name}</span>
            </div>
          )}
          {bot && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bot</span>
              <span className="font-medium text-right max-w-[60%] truncate">{bot.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Agendamento */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Label className="text-sm font-medium">Quando disparar?</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onScheduleChange("")}
              className={cn(
                "flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                mode === "now"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground",
              )}
            >
              <Send className="h-4 w-4" />
              Agora
            </button>
            <button
              type="button"
              onClick={() => onScheduleChange(scheduledAt || minDateTime)}
              className={cn(
                "flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                mode === "schedule"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground",
              )}
            >
              <Clock className="h-4 w-4" />
              Agendar
            </button>
          </div>
          {mode === "schedule" && (
            <Input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => onScheduleChange(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <MessageCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          {mode === "schedule"
            ? `A campanha ficará agendada e ${clientCount} mensagem(ns) serão disparadas automaticamente no horário escolhido.`
            : `A campanha será criada e ${clientCount} mensagem(ns) entrarão na fila de disparo. O envio acontece em segundo plano — acompanhe o progresso na tela da campanha.`}
        </p>
      </div>
    </div>
  );
}

export default function WhatsAppCreateCampaign() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""); // "" = disparar agora

  const createMutation = useCreateCampaignWithDispatch();

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return selectedClientIds.length > 0;
    if (step === 3) return selectedTemplateId.length > 0 || selectedBotId.length > 0;
    return true;
  }, [step, title, selectedClientIds, selectedTemplateId, selectedBotId]);

  const handleNext = () => {
    if (step < 4) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigate("/whatsapp/campanhas");
  };

  const handleSubmit = useCallback(() => {
    // datetime-local → ISO; só envia se estiver no futuro.
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
            title: scheduledIso
              ? "Campanha agendada com sucesso!"
              : "Campanha enfileirada com sucesso!",
            description: scheduledIso
              ? "Será disparada automaticamente no horário escolhido."
              : "O disparo será processado em segundo plano.",
          });
          navigate(`/whatsapp/campanhas/${data.campaignId}`);
        },
      },
    );
  }, [createMutation, title, description, selectedTemplateId, selectedBotId, selectedClientIds, scheduledAt, toast, navigate]);

  return (
    <div className="overflow-y-auto h-full p-5 lg:p-6">
    <div className="space-y-8 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader.Icon
            icon={MessageCircle}
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Nova Campanha</PageHeader.Title>
            <PageHeader.Description>Disparo via WhatsApp Business API</PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      {/* Steps */}
      <div className="flex justify-center">
        <StepIndicator current={step} />
      </div>

      {/* Step content */}
      <div className="min-h-64">
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

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>
        {step < 4 ? (
          <Button onClick={handleNext} disabled={!canNext}>
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {scheduledAt ? "Agendando..." : "Enfileirando..."}
              </>
            ) : (
              <>
                {scheduledAt ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {scheduledAt ? "Agendar campanha" : "Disparar campanha"}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
    </div>
  );
}
