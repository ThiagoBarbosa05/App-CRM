import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Send, Trash2, Calendar, Users, Clock, User, Search, X, Eye, Pencil, CheckCircle2, MailOpen, AlertCircle, ChevronDown, BarChart2, XCircle, CheckCheck } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

const EMAIL_VARIABLES = [
  { label: "Primeiro nome", tag: "{{primeiro_nome}}", resolve: (name: string) => name.trim().split(/\s+/)[0] },
  { label: "Nome completo", tag: "{{nome_completo}}", resolve: (name: string) => name.trim() },
];

function resolveEmailContent(content: string, clientName: string): string {
  let resolved = content;
  for (const v of EMAIL_VARIABLES) {
    resolved = resolved.replaceAll(v.tag, v.resolve(clientName));
  }
  return resolved;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  targetType: string;
  targetCriteria: string | null;
  totalRecipients: number;
  sentCount: number;
  scheduledAt: string | null;
  createdAt: string;
  creator: { name: string } | null;
  deliveredCount?: number;
  openedCount?: number;
  failedCount?: number;
  bouncedCount?: number;
}

const STATUS_CONFIG: Record<EmailCampaign["status"], { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Agendada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  sent: { label: "Enviada", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const EMPTY_FORM = {
  name: "",
  subject: "",
  content: "",
  templateType: "custom",
  targetType: "all",
  targetCriteria: "",
};

const EMPTY_INDIVIDUAL = {
  clientId: "",
  clientName: "",
  clientEmail: "",
  subject: "",
  content: "",
};

interface ClientResult {
  id: string;
  name: string;
  email: string | null;
}

/** Busca de cliente que só oferece clientes com e-mail cadastrado. */
function EmailClientSearchField({ onSelect }: { onSelect: (client: ClientResult) => void }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClientResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching } = useQuery<{ data: ClientResult[] }>({
    queryKey: ["/api/clients", "email-search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/clients?search=${encodeURIComponent(debouncedSearch)}&pageSize=8`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  const results = (data?.data ?? []).filter((c) => c.email && c.email.trim() !== "");

  const handleSelect = (client: ClientResult) => {
    setSelected(client);
    setOpen(false);
    setSearch("");
    onSelect(client);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    onSelect({ id: "", name: "", email: null });
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/40">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-primary">
            {selected.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{selected.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{selected.email}</span>
          </p>
        </div>
        <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente pelo nome ou e-mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => search.length >= 2 && setOpen(true)}
          className="pl-9"
        />
      </div>
      {open && debouncedSearch.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          {isFetching && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
          )}
          {!isFetching && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum cliente com e-mail encontrado.
            </div>
          )}
          {results.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelect(client)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-2.5 border-b last:border-0"
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{client.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Monta o documento isolado usado para pré-visualizar o HTML do email. */
function buildEmailSrcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:16px;color:#111;background:#fff;word-break:break-word}img{max-width:100%}</style></head><body>${html}</body></html>`;
}

/**
 * Campo de conteúdo HTML do email com alternância Editar / Visualizar
 * e botão de inserção de variáveis (primeiro nome, nome completo).
 */
function HtmlContentField({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  clientName,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  clientName?: string;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showVarsMenu, setShowVarsMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canPreview = value.trim() !== "";

  const previewContent = clientName
    ? resolveEmailContent(value, clientName)
    : value
        .replace(/\{\{primeiro_nome\}\}/g, "[primeiro nome]")
        .replace(/\{\{nome_completo\}\}/g, "[nome completo]");
  const srcDoc = buildEmailSrcDoc(previewContent);

  const insertVariable = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + tag);
      setShowVarsMenu(false);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const newVal = value.slice(0, start) + tag + value.slice(end);
    onChange(newVal);
    setShowVarsMenu(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label htmlFor={id}>Conteúdo (HTML)</Label>
        <div className="flex items-center gap-2">
          <Popover open={showVarsMenu} onOpenChange={setShowVarsMenu}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <span className="text-primary font-mono text-[10px]">{"{{}}"}</span>
                Variável
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-0" align="end">
              {EMAIL_VARIABLES.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                >
                  <span className="block font-medium">{v.label}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{v.tag}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="inline-flex rounded-md border p-0.5 bg-background">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors",
                mode === "edit" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              type="button"
              onClick={() => canPreview && setMode("preview")}
              disabled={!canPreview}
              title={canPreview ? undefined : "Digite o conteúdo para visualizar"}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors",
                mode === "preview" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
                !canPreview && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
              )}
            >
              <Eye className="h-3 w-3" /> Visualizar
            </button>
          </div>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          required
        />
      ) : (
        <div className="rounded-md border overflow-hidden bg-white">
          <iframe
            title="Prévia do email"
            sandbox=""
            srcDoc={srcDoc}
            className="w-full block"
            style={{ height: "420px" }}
          />
        </div>
      )}
      {mode === "edit" && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Use <strong>Variável</strong> para inserir dados do cliente automaticamente no email.
        </p>
      )}
      {mode === "preview" && (
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Eye className="h-3 w-3" /> Prévia de como o cliente receberá o email{clientName ? ` (${clientName.trim().split(/\s+/)[0]})` : ""}.
        </p>
      )}
    </div>
  );
}

interface MarketingEmailTabProps {
  prefilledSegment?: { segmentLabel: string; targetType: string; targetCriteria: string } | null;
  onSegmentConsumed?: () => void;
}

export function MarketingEmailTab({ prefilledSegment, onSegmentConsumed }: MarketingEmailTabProps = {}) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isIndividualOpen, setIsIndividualOpen] = useState(false);
  const [indDialogKey, setIndDialogKey] = useState(0);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!prefilledSegment) return;
    const { targetType, targetCriteria, segmentLabel } = prefilledSegment;
    const mappedType = ["markers", "category", "origin"].includes(targetType) ? targetType : "all";
    setFormData({
      name: `Campanha — ${segmentLabel}`,
      subject: "",
      content: "",
      templateType: "custom",
      targetType: mappedType,
      targetCriteria: mappedType !== "all" ? targetCriteria : "",
    });
    setIsCreateOpen(true);
    onSegmentConsumed?.();
  }, [prefilledSegment]);
  const [individualData, setIndividualData] = useState(EMPTY_INDIVIDUAL);
  const [scheduleTarget, setScheduleTarget] = useState<EmailCampaign | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [viewTarget, setViewTarget] = useState<EmailCampaign | null>(null);
  const [reportTarget, setReportTarget] = useState<EmailCampaign | null>(null);

  interface EmailRecipientDetail {
    id: string; clientId: string; status: string; sentAt: string | null;
    openedAt: string | null; errorMessage: string | null;
    clientName: string | null; clientEmail: string | null;
  }
  interface EmailCampaignDetail extends EmailCampaign { recipients: EmailRecipientDetail[]; }

  const { data: reportDetail, isLoading: reportLoading } = useQuery<EmailCampaignDetail>({
    queryKey: ["/api/email-campaigns", reportTarget?.id],
    enabled: !!reportTarget?.id,
  });

  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/email-campaigns"],
  });

  interface TagOption { id: string; name: string; type: string; }

  const { data: categories = [] } = useQuery<TagOption[]>({
    queryKey: ["/api/tags/categories"],
    enabled: isCreateOpen,
  });
  const { data: origins = [] } = useQuery<TagOption[]>({
    queryKey: ["/api/tags/origins"],
    enabled: isCreateOpen,
  });
  const { data: markers = [] } = useQuery<TagOption[]>({
    queryKey: ["/api/tags/markers"],
    enabled: isCreateOpen,
  });

  const criteriaOptions = (() => {
    if (formData.targetType === "category") return categories;
    if (formData.targetType === "origin") return origins;
    if (formData.targetType === "markers") return markers;
    return [];
  })();

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/email-campaigns", {
        ...data,
        targetCriteria: data.targetType === "all" ? null : data.targetCriteria,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setIsCreateOpen(false);
      setFormData(EMPTY_FORM);
      toast({ title: "Campanha criada", description: "Campanha de email salva como rascunho." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const individualMutation = useMutation({
    mutationFn: async (data: typeof individualData) => {
      const res = await apiRequest("POST", "/api/email-campaigns", {
        name: `Email individual — ${data.clientName}`,
        subject: data.subject,
        content: data.content,
        templateType: "custom",
        targetType: "custom",
        targetCriteria: data.clientId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setIsIndividualOpen(false);
      setIndividualData(EMPTY_INDIVIDUAL);
      setIndDialogKey((k) => k + 1);
      toast({
        title: "Rascunho criado",
        description: "Use os botões no card para enviar agora ou agendar.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar rascunho", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/email-campaigns/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/summary"] });
      toast({ title: "Campanha enfileirada", description: "O envio será processado em background." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const res = await apiRequest("POST", `/api/email-campaigns/${id}/schedule`, { scheduledAt });
      return res.json();
    },
    onSuccess: (result: { scheduledAt: string; totalRecipients: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/summary"] });
      setScheduleTarget(null);
      setScheduleDate("");
      const d = new Date(result.scheduledAt);
      toast({
        title: "Campanha agendada!",
        description: `${result.totalRecipients} destinatário(s) · Envio em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/email-campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast({ title: "Campanha excluída" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Campanhas de email marketing via SendGrid.</p>
        <div className="flex items-center gap-2">
          {/* Envio Individual */}
          <Dialog
            open={isIndividualOpen}
            onOpenChange={(v) => {
              setIsIndividualOpen(v);
              if (!v) { setIndividualData(EMPTY_INDIVIDUAL); setIndDialogKey((k) => k + 1); }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <User className="h-3.5 w-3.5" />
                Email individual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo email individual</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); individualMutation.mutate(individualData); }}
                className="space-y-4"
              >
                <div>
                  <Label className="mb-1.5 block">Destinatário</Label>
                  <EmailClientSearchField
                    key={indDialogKey}
                    onSelect={(client) =>
                      setIndividualData((p) => ({
                        ...p,
                        clientId: client.id,
                        clientName: client.name,
                        clientEmail: client.email ?? "",
                      }))
                    }
                  />
                  {!individualData.clientId && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Digite ao menos 2 letras para buscar um cliente com e-mail.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="ind-subject">Assunto</Label>
                  <Input
                    id="ind-subject"
                    value={individualData.subject}
                    onChange={(e) => setIndividualData((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Assunto do email"
                    required
                  />
                </div>

                <HtmlContentField
                  id="ind-content"
                  value={individualData.content}
                  onChange={(v) => setIndividualData((p) => ({ ...p, content: v }))}
                  placeholder="Olá {{primeiro_nome}}, temos uma novidade especial para você!"
                  clientName={individualData.clientName || undefined}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsIndividualOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={individualMutation.isPending || !individualData.clientId}
                  >
                    {individualMutation.isPending ? "Criando..." : "Criar rascunho"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Separator orientation="vertical" className="h-5" />

          {/* Nova campanha */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova campanha de email</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email-name">Nome da campanha</Label>
                    <Input
                      id="email-name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Promoção de Verão"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Assunto</Label>
                    <Input
                      id="email-subject"
                      value={formData.subject}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="Assunto do email"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email-target-type">Público-alvo</Label>
                    <Select
                      value={formData.targetType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, targetType: value, targetCriteria: "" }))}
                    >
                      <SelectTrigger id="email-target-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clientes</SelectItem>
                        <SelectItem value="category">Por categoria</SelectItem>
                        <SelectItem value="origin">Por origem</SelectItem>
                        <SelectItem value="markers">Por marcador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.targetType !== "all" && (
                    <div>
                      <Label htmlFor="email-target-criteria">
                        {formData.targetType === "category" && "Categoria"}
                        {formData.targetType === "origin" && "Origem"}
                        {formData.targetType === "markers" && "Marcador"}
                      </Label>
                      <Select
                        value={formData.targetCriteria}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, targetCriteria: v }))}
                      >
                        <SelectTrigger id="email-target-criteria">
                          <SelectValue placeholder={criteriaOptions.length === 0 ? "Nenhuma opção cadastrada" : "Selecione..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {criteriaOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.name}>
                              {opt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <HtmlContentField
                  id="email-content"
                  value={formData.content}
                  onChange={(v) => setFormData((prev) => ({ ...prev, content: v }))}
                  placeholder="Olá {{primeiro_nome}}, temos uma novidade especial para você!"
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar campanha"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha de email ainda</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar campanha
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {campaigns.map((campaign) => {
          const cfg = STATUS_CONFIG[campaign.status];
          const isIndividual = campaign.targetType === "custom";
          return (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{campaign.subject}</p>
                    {isIndividual && (
                      <Badge variant="outline" className="mt-1.5 gap-1 text-xs font-normal">
                        <User className="h-3 w-3 shrink-0" />
                        Individual
                      </Badge>
                    )}
                  </div>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {campaign.totalRecipients} destinatários
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    {campaign.sentCount} enviados
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(campaign.createdAt)}
                  </div>
                  {campaign.status === "sent" && (
                    <>
                      {(campaign.deliveredCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {campaign.deliveredCount} entregues
                        </div>
                      )}
                      {(campaign.openedCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                          <MailOpen className="h-3.5 w-3.5" />
                          {campaign.openedCount} abertos
                        </div>
                      )}
                      {(campaign.failedCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {campaign.failedCount} com erro
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Criada por {campaign.creator?.name ?? "—"}
                  </span>
                  {campaign.status === "draft" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800"
                        onClick={() => sendMutation.mutate(campaign.id)}
                        disabled={sendMutation.isPending || scheduleMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Enviar agora
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800"
                        onClick={() => { setScheduleTarget(campaign); setScheduleDate(""); }}
                        disabled={sendMutation.isPending || scheduleMutation.isPending}
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        Agendar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(campaign.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Excluir
                      </Button>
                    </div>
                  )}
                  {campaign.status === "sent" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => setViewTarget(campaign)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Visualizar email
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReportTarget(campaign)}>
                        <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                        Relatório
                      </Button>
                    </div>
                  )}
                  {(campaign.status === "scheduled" || campaign.status === "sending") && (
                    <Button variant="outline" size="sm" onClick={() => setReportTarget(campaign)}>
                      <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                      Relatório
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog de relatório da campanha de email */}
      <Dialog open={!!reportTarget} onOpenChange={(v) => { if (!v) setReportTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Relatório da campanha
            </DialogTitle>
            {reportTarget && (
              <p className="text-sm text-muted-foreground truncate">
                {reportTarget.name} — <span className="font-medium text-foreground">{reportTarget.subject}</span>
              </p>
            )}
          </DialogHeader>

          {reportLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Carregando relatório...
            </div>
          ) : reportDetail ? (() => {
            const recps = reportDetail.recipients;
            const total = reportDetail.totalRecipients ?? recps.length;
            const sent = recps.filter(r => ["sent","delivered","opened"].includes(r.status)).length;
            const delivered = recps.filter(r => ["delivered","opened"].includes(r.status)).length;
            const opened = recps.filter(r => r.status === "opened").length;
            const failed = recps.filter(r => ["failed","bounced"].includes(r.status)).length;
            const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
            const openPct = sent > 0 ? Math.round((opened / sent) * 100) : 0;

            function statusLabel(s: string) {
              switch (s) {
                case "sent": return { label: "Enviado", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
                case "delivered": return { label: "Entregue", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" };
                case "opened": return { label: "Aberto", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
                case "failed": return { label: "Falhou", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
                case "bounced": return { label: "Devolvido", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" };
                default: return { label: "Pendente", color: "bg-muted text-muted-foreground" };
              }
            }

            return (
              <div className="flex flex-col gap-4 overflow-hidden min-h-0">
                {/* Stats */}
                <div className="grid grid-cols-5 gap-2 shrink-0">
                  {[
                    { label: "Total", value: total, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
                    { label: "Enviados", value: sent, icon: <Send className="h-4 w-4 text-blue-500" /> },
                    { label: "Entregues", value: delivered, icon: <CheckCheck className="h-4 w-4 text-green-500" /> },
                    { label: "Abertos", value: opened, icon: <MailOpen className="h-4 w-4 text-emerald-500" /> },
                    { label: "Com erro", value: failed, icon: <XCircle className="h-4 w-4 text-red-500" /> },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="rounded-lg border bg-card p-3 text-center">
                      <div className="flex justify-center mb-1">{icon}</div>
                      <div className="text-xl font-bold">{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bars */}
                <div className="space-y-2 shrink-0">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Taxa de envio</span><span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Taxa de abertura (dos enviados)</span><span>{openPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${openPct}%` }} />
                    </div>
                  </div>
                </div>

                <Separator className="shrink-0" />

                {/* Recipients list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {recps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum destinatário encontrado.</p>
                  ) : (
                    <div className="space-y-1">
                      {recps.map((r) => {
                        const st = statusLabel(r.status);
                        return (
                          <div key={r.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{r.clientName ?? "—"}</p>
                              <p className="text-xs text-muted-foreground truncate">{r.clientEmail ?? r.clientId}</p>
                            </div>
                            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                            {r.openedAt && (
                              <span className="shrink-0 text-xs text-muted-foreground">Aberto {formatDate(r.openedAt)}</span>
                            )}
                            {r.sentAt && !r.openedAt && (
                              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.sentAt)}</span>
                            )}
                            {r.errorMessage && (
                              <span className="shrink-0 text-xs text-red-500 max-w-[180px] truncate" title={r.errorMessage}>{r.errorMessage}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização do email enviado */}
      <Dialog open={!!viewTarget} onOpenChange={(v) => { if (!v) setViewTarget(null); }}>
        <DialogContent className="max-w-none w-[98vw] h-[97vh] max-h-[97vh] overflow-hidden flex flex-col p-4">
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle className="truncate">{viewTarget?.name}</DialogTitle>
            {viewTarget && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{viewTarget.subject}</span>
              </p>
            )}
          </DialogHeader>
          {viewTarget && (
            <div className="rounded-md border overflow-hidden bg-white flex-1 min-h-0">
              <iframe
                title="Email enviado"
                sandbox=""
                srcDoc={buildEmailSrcDoc(viewTarget.content)}
                className="w-full h-full block"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de agendamento */}
      <Dialog open={!!scheduleTarget} onOpenChange={(v) => { if (!v) { setScheduleTarget(null); setScheduleDate(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agendar envio</DialogTitle>
          </DialogHeader>
          {scheduleTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Campanha: <span className="font-medium text-foreground">{scheduleTarget.name}</span>
              </p>
              <div>
                <Label htmlFor="email-schedule-datetime">Data e hora do envio</Label>
                <Input
                  id="email-schedule-datetime"
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O envio será iniciado automaticamente na data/hora selecionada.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setScheduleTarget(null); setScheduleDate(""); }}>
                  Cancelar
                </Button>
                <Button
                  disabled={!scheduleDate || scheduleMutation.isPending}
                  onClick={() => scheduleMutation.mutate({ id: scheduleTarget.id, scheduledAt: scheduleDate })}
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {scheduleMutation.isPending ? "Agendando..." : "Confirmar agendamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
