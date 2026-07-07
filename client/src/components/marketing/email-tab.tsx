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
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Send, Trash2, Calendar, Users, Clock, User, Search, X, Eye, Pencil } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

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

/**
 * Campo de conteúdo HTML do email com alternância Editar / Visualizar.
 * A prévia renderiza o HTML num iframe isolado (sandbox sem scripts), do jeito
 * que o cliente receberá, sem afetar o layout da aplicação.
 */
function HtmlContentField({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const canPreview = value.trim() !== "";
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:16px;color:#111;background:#fff;word-break:break-word}img{max-width:100%}</style></head><body>${value}</body></html>`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label htmlFor={id}>Conteúdo (HTML)</Label>
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
      {mode === "edit" ? (
        <Textarea
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
            style={{ height: `${rows * 28}px` }}
          />
        </div>
      )}
      {mode === "preview" && (
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Eye className="h-3 w-3" /> Prévia de como o cliente receberá o email.
        </p>
      )}
    </div>
  );
}

export function MarketingEmailTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isIndividualOpen, setIsIndividualOpen] = useState(false);
  const [indDialogKey, setIndDialogKey] = useState(0);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [individualData, setIndividualData] = useState(EMPTY_INDIVIDUAL);
  const [scheduleTarget, setScheduleTarget] = useState<EmailCampaign | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/email-campaigns"],
  });

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
                  placeholder="Digite o conteúdo do email..."
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
                      <Input
                        id="email-target-criteria"
                        value={formData.targetCriteria}
                        onChange={(e) => setFormData((prev) => ({ ...prev, targetCriteria: e.target.value }))}
                        placeholder="Valor exato cadastrado no cliente"
                        required
                      />
                    </div>
                  )}
                </div>

                <HtmlContentField
                  id="email-content"
                  value={formData.content}
                  onChange={(v) => setFormData((prev) => ({ ...prev, content: v }))}
                  placeholder="Digite o conteúdo do email..."
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
