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
import { MessageSquare, Plus, Send, Trash2, Calendar, Users, Zap, CheckCircle2, Search, Phone, X, ChevronDown, Clock, Target, RefreshCw, BarChart2, XCircle, CheckCheck, User } from "lucide-react";
import { formatDate } from "@/lib/utils";

const SMS_VARIABLES = [
  { label: "Primeiro nome", tag: "{{primeiro_nome}}", resolve: (name: string) => name.split(" ")[0] },
  { label: "Nome completo", tag: "{{nome_completo}}", resolve: (name: string) => name },
];

function resolveMessage(message: string, clientName: string): string {
  let resolved = message;
  for (const v of SMS_VARIABLES) {
    resolved = resolved.replaceAll(v.tag, v.resolve(clientName));
  }
  return resolved;
}

interface SmsCampaign {
  id: string;
  name: string;
  message: string;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  targetType: string;
  targetCriteria: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  creator: { name: string } | null;
}

interface IndividualMessage {
  id: string;
  phone: string;
  message: string;
  status: "sent" | "delivered" | "failed";
  twilioSid: string | null;
  errorMessage: string | null;
  createdAt: string;
  clientName: string | null;
  sentByName: string | null;
}

interface ListCampaignsResult {
  data: SmsCampaign[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

const CAMPAIGNS_PAGE_SIZE = 10;

const STATUS_CONFIG: Record<SmsCampaign["status"], { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Enviando", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  sent: { label: "Enviada", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const TARGET_TYPE_LABEL: Record<string, string> = {
  all: "Todos os clientes",
  category: "Categoria",
  origin: "Origem",
  markers: "Marcador",
  custom: "Personalizado",
};

function describeTarget(targetType: string, targetCriteria: string | null): string {
  if (targetType === "all") return "Todos os clientes";
  const label = TARGET_TYPE_LABEL[targetType] ?? "Público";
  return targetCriteria ? `${label}: ${targetCriteria}` : label;
}

interface ClientResult {
  id: string;
  name: string;
  phone: string | null;
}

interface Tag {
  id: string;
  name: string;
}

const TARGET_TYPE_ENDPOINT: Record<string, string> = {
  category: "/api/tags/categories",
  origin: "/api/tags/origins",
  markers: "/api/tags/markers",
};

function ClientSearchField({
  onSelect,
}: {
  onSelect: (client: ClientResult) => void;
}) {
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
    queryKey: ["/api/clients", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/clients?search=${encodeURIComponent(debouncedSearch)}&pageSize=8`,
        { credentials: "include" }
      );
      return res.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  const results = (data?.data ?? []).filter((c) => c.phone);

  const handleSelect = (client: ClientResult) => {
    setSelected(client);
    setOpen(false);
    setSearch("");
    onSelect(client);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    onSelect({ id: "", name: "", phone: null });
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
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />{selected.phone}
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
          placeholder="Buscar cliente pelo nome ou telefone..."
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
              Nenhum cliente com telefone encontrado.
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />{client.phone}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = { name: "", message: "", targetType: "all", targetCriteria: "" };
const EMPTY_INDIVIDUAL = { to: "", clientId: "", clientName: "", message: "" };
const SMS_MAX_LENGTH = 320;

interface MarketingSmsTabProps {
  prefilledSegment?: { segmentLabel: string; targetType: string; targetCriteria: string } | null;
  onSegmentConsumed?: () => void;
}

export function MarketingSmsTab({ prefilledSegment, onSegmentConsumed }: MarketingSmsTabProps = {}) {
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
      message: "",
      targetType: mappedType,
      targetCriteria: mappedType !== "all" ? targetCriteria : "",
    });
    setIsCreateOpen(true);
    onSegmentConsumed?.();
  }, [prefilledSegment]);
  const [scheduleTarget, setScheduleTarget] = useState<SmsCampaign | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [reportTarget, setReportTarget] = useState<SmsCampaign | null>(null);

  interface SmsRecipientDetail {
    id: string; clientId: string; phone: string; status: string;
    sentAt: string | null; errorMessage: string | null;
    twilioSid: string | null; clientName: string | null;
  }
  interface SmsCampaignDetail extends SmsCampaign { recipients: SmsRecipientDetail[]; }

  const { data: smsReportDetail, isLoading: smsReportLoading } = useQuery<SmsCampaignDetail>({
    queryKey: ["/api/sms-campaigns", reportTarget?.id],
    enabled: !!reportTarget?.id,
  });
  const [individualData, setIndividualData] = useState(EMPTY_INDIVIDUAL);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showVarsMenu, setShowVarsMenu] = useState(false);
  const [showCampaignVarsMenu, setShowCampaignVarsMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const campaignTextareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(tag: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newValue = (before + tag + after).slice(0, SMS_MAX_LENGTH);
    setIndividualData((p) => ({ ...p, message: newValue }));
    setShowVarsMenu(false);
    setTimeout(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  function insertCampaignVariable(tag: string) {
    const el = campaignTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newValue = (before + tag + after).slice(0, SMS_MAX_LENGTH);
    setFormData((p) => ({ ...p, message: newValue }));
    setShowCampaignVarsMenu(false);
    setTimeout(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  const [campaignsPage, setCampaignsPage] = useState(1);
  const [allCampaigns, setAllCampaigns] = useState<SmsCampaign[]>([]);

  const { data: campaignsResult, isLoading, isFetching: isFetchingCampaigns } = useQuery<ListCampaignsResult>({
    queryKey: ["/api/sms-campaigns", campaignsPage],
    queryFn: async () => {
      const res = await fetch(`/api/sms-campaigns?page=${campaignsPage}&pageSize=${CAMPAIGNS_PAGE_SIZE}`, {
        credentials: "include",
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (!campaignsResult) return;
    setAllCampaigns((prev) =>
      campaignsResult.page === 1 ? campaignsResult.data : [...prev, ...campaignsResult.data],
    );
  }, [campaignsResult]);

  const hasMoreCampaigns = !!campaignsResult && campaignsResult.page < campaignsResult.totalPages;

  function reloadCampaigns() {
    setCampaignsPage(1);
    queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
  }

  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<{ balance: string; currency: string }>({
    queryKey: ["/api/sms-campaigns/balance"],
    staleTime: 60_000,
  });

  const targetTagsEndpoint = TARGET_TYPE_ENDPOINT[formData.targetType];
  const { data: targetTags = [], isLoading: targetTagsLoading } = useQuery<Tag[]>({
    queryKey: [targetTagsEndpoint],
    enabled: !!targetTagsEndpoint,
  });

  const previewEnabled =
    formData.targetType === "all" ||
    (formData.targetType !== "all" && !!formData.targetCriteria);
  const { data: previewCount, isLoading: previewLoading } = useQuery<{ total: number; withPhone: number }>({
    queryKey: [
      "/api/sms-campaigns/preview-count",
      formData.targetType,
      formData.targetCriteria,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ targetType: formData.targetType });
      if (formData.targetCriteria) params.set("targetCriteria", formData.targetCriteria);
      const res = await fetch(`/api/sms-campaigns/preview-count?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: previewEnabled,
    staleTime: 30_000,
  });

  const { data: individualHistory, refetch: refetchHistory } = useQuery<{
    data: IndividualMessage[];
    totalItems: number;
    totalPages: number;
  }>({
    queryKey: ["/api/sms-campaigns/individual-history"],
    staleTime: 30_000,
  });

  const individualMutation = useMutation({
    mutationFn: async (data: typeof individualData) => {
      const resolvedMessage = data.clientName
        ? resolveMessage(data.message, data.clientName)
        : data.message;
      const res = await apiRequest("POST", "/api/sms-campaigns/send-individual", {
        to: data.to,
        message: resolvedMessage,
        clientId: data.clientId || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setSendError(null);
      setSentSuccess(true);
      refetchHistory();
      setTimeout(() => {
        setSentSuccess(false);
        setIsIndividualOpen(false);
        setIndividualData(EMPTY_INDIVIDUAL);
      }, 1800);
      toast({ title: "SMS enviado!", description: "Mensagem entregue com sucesso." });
    },
    onError: (error: Error) => {
      console.error("[SMS individual] erro:", error.message);
      setSendError(error.message);
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/sms-campaigns", {
        ...data,
        targetCriteria: data.targetType === "all" ? null : data.targetCriteria,
      });
      return res.json();
    },
    onSuccess: () => {
      reloadCampaigns();
      setIsCreateOpen(false);
      setFormData(EMPTY_FORM);
      toast({ title: "Campanha criada", description: "Use os botões no card para enviar agora ou agendar." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const res = await apiRequest("POST", `/api/sms-campaigns/${id}/schedule`, { scheduledAt });
      return res.json();
    },
    onSuccess: (result: any) => {
      reloadCampaigns();
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

  const syncStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sms-campaigns/${id}/sync-status`);
      return res.json();
    },
    onSuccess: (result: any, id: string) => {
      reloadCampaigns();
      toast({
        title: "Status atualizado",
        description: `${result.delivered} entregues · ${result.failed} com erro · ${result.unchanged} sem atualização`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao sincronizar", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sms-campaigns/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      reloadCampaigns();
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/summary"] });
      toast({ title: "Campanha enfileirada", description: "O envio será processado em background." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sms-campaigns/${id}`);
    },
    onSuccess: () => {
      reloadCampaigns();
      toast({ title: "Campanha excluída" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Campanhas de SMS via Twilio.</p>
          <button
            type="button"
            onClick={() => refetchBalance()}
            className="flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 font-medium transition-colors hover:bg-muted"
            title="Clique para atualizar"
          >
            <span className="text-muted-foreground">Saldo Twilio:</span>
            {balanceLoading ? (
              <span className="text-muted-foreground animate-pulse">…</span>
            ) : balanceData ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {Number(balanceData.balance).toLocaleString("en-US", { style: "currency", currency: balanceData.currency })}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">

          {/* Envio Individual */}
          <Dialog open={isIndividualOpen} onOpenChange={(v) => { setIsIndividualOpen(v); if (!v) { setIndividualData(EMPTY_INDIVIDUAL); setSentSuccess(false); setSendError(null); setIndDialogKey((k) => k + 1); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Zap className="h-3.5 w-3.5" />
                Envio individual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar SMS Individual</DialogTitle>
              </DialogHeader>

              {sentSuccess ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">SMS enviado com sucesso!</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); individualMutation.mutate(individualData); }}
                  className="space-y-4 pt-1"
                >
                  <div>
                    <Label className="mb-1.5 block">Destinatário</Label>
                    <ClientSearchField
                      key={indDialogKey}
                      onSelect={(client) => {
                        setIndividualData((p) => ({
                          ...p,
                          to: client.phone ?? "",
                          clientId: client.id,
                          clientName: client.name,
                        }));
                      }}
                    />
                    {!individualData.to && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Digite ao menos 2 letras para buscar um cliente.
                      </p>
                    )}
                    {individualData.to && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5">
                        Número: {individualData.to}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="ind-message">Mensagem</Label>
                      <Popover open={showVarsMenu} onOpenChange={setShowVarsMenu}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                            <span className="text-primary font-mono text-[10px]">{"{{}}"}</span>
                            Variável
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-0" align="end">
                          {SMS_VARIABLES.map((v) => (
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
                    </div>
                    <Textarea
                      ref={textareaRef}
                      id="ind-message"
                      placeholder="Ex: Olá {{primeiro_nome}}, temos uma oferta especial para você!"
                      value={individualData.message}
                      onChange={(e) => setIndividualData((p) => ({ ...p, message: e.target.value.slice(0, SMS_MAX_LENGTH) }))}
                      rows={4}
                      className="resize-none font-mono text-sm"
                      required
                    />
                    <div className="flex justify-between items-start mt-1.5 gap-2">
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Clique em <strong>Variável</strong> para inserir dados do cliente na mensagem.
                      </p>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {individualData.message.length}/{SMS_MAX_LENGTH}
                      </p>
                    </div>

                    {/* Prévia da mensagem resolvida */}
                    {individualData.message && individualData.clientName && individualData.message.includes("{{") && (
                      <div className="mt-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide mb-1">
                          Prévia — como o cliente receberá
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {resolveMessage(individualData.message, individualData.clientName)}
                        </p>
                      </div>
                    )}
                    {individualData.message && !individualData.clientName && individualData.message.includes("{{") && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                        ⚠️ Selecione um destinatário para ver a prévia com as variáveis resolvidas.
                      </p>
                    )}
                  </div>

                  {sendError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2.5">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">Erro ao enviar</p>
                      <p className="text-xs text-red-600 dark:text-red-300 break-words">{sendError}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsIndividualOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={individualMutation.isPending || !individualData.to || !individualData.message}
                      className="gap-2"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {individualMutation.isPending ? "Enviando..." : "Enviar SMS"}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Separator orientation="vertical" className="h-5" />

          {/* Nova Campanha */}
          <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if (!v) setFormData(EMPTY_FORM); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova campanha de SMS</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                <div>
                  <Label htmlFor="sms-name">Nome da campanha</Label>
                  <Input
                    id="sms-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Promoção de Verão"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sms-target-type">Público-alvo</Label>
                    <Select
                      value={formData.targetType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, targetType: value, targetCriteria: "" }))}
                    >
                      <SelectTrigger id="sms-target-type">
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
                      <Label htmlFor="sms-target-criteria">
                        {formData.targetType === "category" && "Categoria"}
                        {formData.targetType === "origin" && "Origem"}
                        {formData.targetType === "markers" && "Marcador"}
                      </Label>
                      <Select
                        value={formData.targetCriteria}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, targetCriteria: value }))}
                        disabled={targetTagsLoading}
                      >
                        <SelectTrigger id="sms-target-criteria">
                          <SelectValue placeholder={targetTagsLoading ? "Carregando..." : "Selecione"} />
                        </SelectTrigger>
                        <SelectContent>
                          {targetTags.length === 0 && !targetTagsLoading && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma opção cadastrada</div>
                          )}
                          {targetTags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.name}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {(previewEnabled && (previewLoading || !!previewCount)) && (
                  <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    previewLoading
                      ? "bg-muted text-muted-foreground"
                      : previewCount && previewCount.withPhone > 0
                        ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}>
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    {previewLoading ? (
                      <span>Calculando destinatários...</span>
                    ) : previewCount ? (
                      <span>
                        <strong>{previewCount.withPhone}</strong> cliente{previewCount.withPhone !== 1 ? "s" : ""} com telefone receberão este SMS
                        {previewCount.total !== previewCount.withPhone && (
                          <span className="text-xs ml-1 opacity-75">
                            ({previewCount.total - previewCount.withPhone} sem telefone cadastrado)
                          </span>
                        )}
                      </span>
                    ) : null}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="sms-message">Mensagem</Label>
                    <Popover open={showCampaignVarsMenu} onOpenChange={setShowCampaignVarsMenu}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                          <span className="text-primary font-mono text-[10px]">{"{{}}"}</span>
                          Variável
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-0" align="end">
                        {SMS_VARIABLES.map((v) => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => insertCampaignVariable(v.tag)}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                          >
                            <span className="block font-medium">{v.label}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">{v.tag}</span>
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Textarea
                    ref={campaignTextareaRef}
                    id="sms-message"
                    value={formData.message}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value.slice(0, SMS_MAX_LENGTH) }))}
                    placeholder="Ex: Olá {{primeiro_nome}}, temos uma oferta especial para você!"
                    rows={4}
                    className="resize-none font-mono text-sm"
                    required
                  />
                  <div className="flex justify-between items-start mt-1.5 gap-2">
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      As variáveis serão substituídas pelo dado real de cada cliente no envio.
                    </p>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {formData.message.length}/{SMS_MAX_LENGTH}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      (formData.targetType !== "all" && !formData.targetCriteria)
                    }
                  >
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

      {!isLoading && allCampaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha de SMS ainda</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar campanha
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {allCampaigns.map((campaign) => {
          const cfg = STATUS_CONFIG[campaign.status];
          return (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{campaign.message}</p>
                    <Badge variant="outline" className="mt-1.5 gap-1 text-xs font-normal max-w-full">
                      <Target className="h-3 w-3 shrink-0" />
                      <span className="truncate">{describeTarget(campaign.targetType, campaign.targetCriteria)}</span>
                    </Badge>
                  </div>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {campaign.totalRecipients} destinatários
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    {campaign.sentCount} enviados
                  </div>
                  {campaign.status !== "draft" && (
                    <>
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {campaign.deliveredCount ?? 0} entregues
                      </div>
                      {(campaign.failedCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                          <X className="h-3.5 w-3.5" />
                          {campaign.failedCount} com erro
                        </div>
                      )}
                    </>
                  )}
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
                  {campaign.status === "sent" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800"
                        onClick={() => syncStatusMutation.mutate(campaign.id)}
                        disabled={syncStatusMutation.isPending}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncStatusMutation.isPending ? "animate-spin" : ""}`} />
                        Sincronizar status
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

      {hasMoreCampaigns && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCampaignsPage((p) => p + 1)}
            disabled={isFetchingCampaigns}
          >
            {isFetchingCampaigns ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}

      {/* Histórico de envios avulsos */}
      {individualHistory && individualHistory.data.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Histórico de envios avulsos
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {individualHistory.data.map((msg) => {
                  const isDelivered = msg.status === "delivered";
                  const isFailed = msg.status === "failed";
                  return (
                    <div key={msg.id} className="flex items-start gap-3 px-4 py-3">
                      <div className={`mt-0.5 shrink-0 ${isDelivered ? "text-green-500" : isFailed ? "text-red-500" : "text-blue-400"}`}>
                        {isDelivered ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isFailed ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {msg.clientName ?? msg.phone}
                          </span>
                          {msg.clientName && (
                            <span className="text-xs text-muted-foreground">{msg.phone}</span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              isDelivered
                                ? "text-green-700 border-green-200 dark:text-green-400 dark:border-green-800"
                                : isFailed
                                  ? "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"
                                  : "text-blue-600 border-blue-200 dark:text-blue-400"
                            }`}
                          >
                            {isDelivered ? "Entregue" : isFailed ? "Falhou" : "Enviado"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{msg.message}</p>
                        {msg.errorMessage && (
                          <p className="text-xs text-red-500 mt-0.5">{msg.errorMessage}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {formatDate(msg.createdAt)}
                          {msg.sentByName && ` · ${msg.sentByName}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog de relatório da campanha de SMS */}
      <Dialog open={!!reportTarget} onOpenChange={(v) => { if (!v) setReportTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Relatório da campanha
            </DialogTitle>
            {reportTarget && (
              <p className="text-sm text-muted-foreground truncate">
                {reportTarget.name}
              </p>
            )}
          </DialogHeader>

          {smsReportLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Carregando relatório...
            </div>
          ) : smsReportDetail ? (() => {
            const recps = smsReportDetail.recipients;
            const total = smsReportDetail.totalRecipients ?? recps.length;
            const sent = recps.filter(r => ["sent","delivered"].includes(r.status)).length;
            const delivered = recps.filter(r => r.status === "delivered").length;
            const failed = recps.filter(r => r.status === "failed").length;
            const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
            const deliveryPct = sent > 0 ? Math.round((delivered / sent) * 100) : 0;

            function statusLabel(s: string) {
              switch (s) {
                case "sent": return { label: "Enviado", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
                case "delivered": return { label: "Entregue", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" };
                case "failed": return { label: "Falhou", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
                default: return { label: "Pendente", color: "bg-muted text-muted-foreground" };
              }
            }

            return (
              <div className="flex flex-col gap-4 overflow-hidden min-h-0">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 shrink-0">
                  {[
                    { label: "Total", value: total, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
                    { label: "Enviados", value: sent, icon: <Send className="h-4 w-4 text-blue-500" /> },
                    { label: "Entregues", value: delivered, icon: <CheckCheck className="h-4 w-4 text-green-500" /> },
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
                      <span>Taxa de entrega (dos enviados)</span><span>{deliveryPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${deliveryPct}%` }} />
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
                              <p className="text-xs text-muted-foreground truncate">{r.phone}</p>
                            </div>
                            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                            {r.sentAt && (
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
                <Label htmlFor="schedule-datetime">Data e hora do envio</Label>
                <Input
                  id="schedule-datetime"
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
