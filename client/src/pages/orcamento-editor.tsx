import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Search,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  User,
  MessageCircle,
  Loader2,
  Percent,
  DollarSign,
  Download,
} from "lucide-react";

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Erro desconhecido");
  }
  return res.json() as Promise<T>;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id?: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: "percent" | "fixed";
  lineTotal: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  assignedToId: string | null;
  status: string;
  validUntil: string | null;
  paymentConditions: string;
  notes: string | null;
  globalDiscount: string;
  globalDiscountType: "percent" | "fixed";
  subtotal: string;
  total: string;
  convertedSaleId: string | null;
  items: QuoteItemRaw[];
  createdAt: string;
  updatedAt: string;
}

interface QuoteItemRaw {
  id: string;
  quoteId: string;
  productId: string | null;
  productName: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  discountType: "percent" | "fixed";
  lineTotal: string;
  sortOrder: number;
}

interface ClientResult {
  id: string;
  name: string;
  phone: string | null;
}

interface Product {
  id: string;
  name: string;
  negotiatedPrice: string;
  category: string;
  winery: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeLineTotal(qty: number, price: number, disc: number, discType: "percent" | "fixed"): number {
  const base = qty * price;
  const discAmt = discType === "percent" ? base * (disc / 100) : disc;
  return Math.max(0, base - discAmt);
}

function computeTotals(items: QuoteItem[], gDisc: number, gDiscType: "percent" | "fixed") {
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const gDiscAmt = gDiscType === "percent" ? subtotal * (gDisc / 100) : gDisc;
  const total = Math.max(0, subtotal - gDiscAmt);
  return { subtotal, gDiscAmt, total };
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  accepted: "Aceito",
  rejected: "Recusado",
  converted: "Convertido em Venda",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-500 bg-slate-100 dark:bg-slate-800",
  sent: "text-blue-700 bg-blue-50 dark:bg-blue-900/20",
  accepted: "text-green-700 bg-green-50 dark:bg-green-900/20",
  rejected: "text-red-700 bg-red-50 dark:bg-red-900/20",
  converted: "text-purple-700 bg-purple-50 dark:bg-purple-900/20",
  cancelled: "text-slate-400 bg-slate-50 dark:bg-slate-800/50",
};

const PAYMENT_OPTIONS = [
  { value: "avista", label: "À Vista" },
  { value: "30d", label: "30 dias" },
  { value: "60d", label: "60 dias" },
  { value: "30-60d", label: "30/60 dias" },
  { value: "30-60-90d", label: "30/60/90 dias" },
  { value: "custom", label: "Personalizado" },
];

// Default validity: today + 15 days
function defaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

// ─── Product search row ───────────────────────────────────────────────────────

function ProductSearchCell({
  value,
  products,
  onSelect,
  onChange,
}: {
  value: string;
  products: Product[];
  onSelect: (p: Product) => void;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => p.name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 8),
    [products, value],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        placeholder="Produto..."
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full text-xs border rounded px-2 py-1.5 bg-white dark:bg-slate-800 outline-none focus:border-primary dark:border-slate-600"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border rounded-lg shadow-lg overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b last:border-0"
            >
              <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</div>
              <div className="text-slate-400 mt-0.5">
                {p.winery && `${p.winery} · `}
                {fmtBRL(parseFloat(p.negotiatedPrice))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Client search ────────────────────────────────────────────────────────────

function ClientSearch({
  clientName,
  clientPhone,
  onSelect,
  onClear,
}: {
  clientName: string | null;
  clientPhone: string | null;
  onSelect: (c: ClientResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results = [] } = useQuery<{ data: ClientResult[] }>({
    queryKey: ["clients-search", query],
    queryFn: () => apiFetch(`/api/clients?search=${encodeURIComponent(query)}&pageSize=10`),
    enabled: query.length >= 2,
    staleTime: 30_000,
    select: (r) => r.data ?? [],
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (clientName) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{clientName}</div>
          {clientPhone && <div className="text-xs text-slate-400">{clientPhone}</div>}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-slate-400 hover:text-red-500 transition-colors p-1"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          placeholder="Buscar cliente por nome ou telefone..."
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 outline-none focus:border-primary dark:border-slate-700"
        />
      </div>
      {open && query.length >= 2 && (results as unknown as ClientResult[]).length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border rounded-lg shadow-lg overflow-hidden">
          {(results as unknown as ClientResult[]).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b last:border-0"
            >
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.name}</div>
              {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Discount toggle input ────────────────────────────────────────────────────

function DiscountInput({
  value,
  type,
  onValueChange,
  onTypeToggle,
  size = "md",
}: {
  value: number;
  type: "percent" | "fixed";
  onValueChange: (v: number) => void;
  onTypeToggle: () => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex items-center border rounded overflow-hidden", size === "sm" ? "text-xs h-7" : "text-sm h-9")}>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value || ""}
        onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
        placeholder="0"
        className={cn(
          "flex-1 min-w-0 bg-white dark:bg-slate-800 outline-none px-2",
          size === "sm" ? "w-14 text-xs" : "w-20",
        )}
      />
      <button
        type="button"
        onClick={onTypeToggle}
        className="px-2 bg-slate-50 dark:bg-slate-700 border-l h-full flex items-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
        title={type === "percent" ? "Mudar para valor fixo" : "Mudar para percentual"}
      >
        {type === "percent" ? (
          <Percent className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        ) : (
          <span className={cn("font-semibold", size === "sm" ? "text-[10px]" : "text-xs")}>R$</span>
        )}
      </button>
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function OrcamentoEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isNew = !params.id || params.id === "novo";
  const quoteId = isNew ? null : params.id;

  // ── Form state ────────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [paymentConditions, setPaymentConditions] = useState("avista");
  const [notes, setNotes] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [globalDiscountType, setGlobalDiscountType] = useState<"percent" | "fixed">("percent");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteStatus, setQuoteStatus] = useState("draft");
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(isNew);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // ── PDF download ──────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!quoteId) return;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erro ao gerar PDF" }));
        throw new Error((err as { message?: string }).message ?? "Erro ao gerar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quoteNumber ?? "orcamento"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ── Load existing quote ───────────────────────────────────────────────────
  const { data: existingQuote, isLoading: loadingQuote } = useQuery<Quote>({
    queryKey: ["quote", quoteId],
    queryFn: () => apiFetch<Quote>(`/api/quotes/${quoteId}`),
    enabled: !!quoteId,
  });

  // ── Load products ─────────────────────────────────────────────────────────
  const { data: productsRaw = [] } = useQuery<Product[]>({
    queryKey: ["products-all"],
    queryFn: () =>
      apiFetch<{ data: Product[] }>("/api/products?pageSize=500").then((r) => r.data ?? []),
    staleTime: 5 * 60_000,
  });

  // ── Hydrate form from existing quote ────────────────────────────────────
  useEffect(() => {
    if (!existingQuote || initialized) return;
    setClientId(existingQuote.clientId);
    setClientName(existingQuote.clientName);
    setClientPhone(existingQuote.clientPhone);
    setValidUntil(existingQuote.validUntil ?? defaultValidUntil());
    setPaymentConditions(existingQuote.paymentConditions);
    setNotes(existingQuote.notes ?? "");
    setGlobalDiscount(parseFloat(existingQuote.globalDiscount) || 0);
    setGlobalDiscountType(existingQuote.globalDiscountType);
    setQuoteStatus(existingQuote.status);
    setQuoteNumber(existingQuote.quoteNumber);
    setItems(
      (existingQuote.items ?? []).map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        quantity: parseFloat(i.quantity),
        unitPrice: parseFloat(i.unitPrice),
        discount: parseFloat(i.discount),
        discountType: i.discountType,
        lineTotal: parseFloat(i.lineTotal),
      })),
    );
    setInitialized(true);
  }, [existingQuote, initialized]);

  // ── Computed totals ───────────────────────────────────────────────────────
  const totals = useMemo(
    () => computeTotals(items, globalDiscount, globalDiscountType),
    [items, globalDiscount, globalDiscountType],
  );

  // ── Item helpers ──────────────────────────────────────────────────────────
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { productId: null, productName: "", quantity: 1, unitPrice: 0, discount: 0, discountType: "percent", lineTotal: 0 },
    ]);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = useCallback((idx: number, patch: Partial<QuoteItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        next.lineTotal = computeLineTotal(next.quantity, next.unitPrice, next.discount, next.discountType);
        return next;
      }),
    );
  }, []);

  // ── Payload builder ───────────────────────────────────────────────────────
  const buildPayload = () => ({
    clientId,
    clientName,
    clientPhone,
    validUntil: validUntil || null,
    paymentConditions,
    notes: notes || null,
    globalDiscount,
    globalDiscountType,
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      discountType: i.discountType,
    })),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiFetch<Quote>("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (q) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Orçamento criado!", description: q.quoteNumber });
      navigate(`/orcamentos/${q.id}`);
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiFetch<Quote>(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      toast({ title: "Orçamento salvo!" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ action }: { action: string }) =>
      apiFetch(`/api/quotes/${quoteId}/${action}`, { method: "POST" }),
    onSuccess: (data: any) => {
      const newStatus = data.status ?? data.quote?.status;
      if (newStatus) setQuoteStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const whatsappMutation = useMutation({
    mutationFn: () => apiFetch(`/api/quotes/${quoteId}/whatsapp`, { method: "POST" }),
    onSuccess: () => {
      setQuoteStatus("sent");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      toast({ title: "Mensagem enviada!", description: "Orçamento enviado via WhatsApp." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao enviar WhatsApp", description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => apiFetch(`/api/quotes/${quoteId}/convert`, { method: "POST" }),
    onSuccess: () => {
      setQuoteStatus("converted");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      toast({ title: "Convertido em venda!", description: "A venda foi registrada automaticamente." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao converter", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (isNew) createMutation.mutate(buildPayload());
    else updateMutation.mutate(buildPayload());
  };

  const isReadOnly = quoteStatus === "converted" || quoteStatus === "cancelled";
  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && loadingQuote) {
    return (
      <div className="flex items-center justify-center min-h-[300px] gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando orçamento...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader>
        <PageHeader.Info>
          <button
            onClick={() => navigate("/orcamentos")}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <PageHeader.Icon icon={FileText} color="text-primary" bgColor="bg-accent" />
          <PageHeader.Text>
            <PageHeader.Title>
              {isNew ? "Novo Orçamento" : quoteNumber ?? "Orçamento"}
            </PageHeader.Title>
            <PageHeader.Description>
              {isNew
                ? "Preencha os dados e adicione os produtos"
                : `Status: ${STATUS_LABELS[quoteStatus] ?? quoteStatus}`}
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Rascunho
            </Button>
          )}
        </PageHeader.Actions>
      </PageHeader>

      {/* Status badge (existing quotes) */}
      {!isNew && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
              STATUS_COLORS[quoteStatus] ?? "text-slate-500 bg-slate-100",
            )}
          >
            {STATUS_LABELS[quoteStatus] ?? quoteStatus}
          </span>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── LEFT: Client + Items ─────────────────────────────────────── */}
        <div className="xl:col-span-2 flex flex-col gap-5">
          {/* Client */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClientSearch
                clientName={clientName}
                clientPhone={clientPhone}
                onSelect={(c) => {
                  setClientId(c.id);
                  setClientName(c.name);
                  setClientPhone(c.phone);
                }}
                onClear={() => {
                  setClientId(null);
                  setClientName(null);
                  setClientPhone(null);
                }}
              />
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                  Itens do Orçamento
                  <span className="text-xs font-normal text-slate-400 ml-1">({items.length})</span>
                </CardTitle>
                {!isReadOnly && (
                  <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar Item
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <ShoppingCart className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Nenhum item adicionado</p>
                  {!isReadOnly && (
                    <Button size="sm" variant="outline" onClick={addItem}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar produto
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-500">
                          <th className="text-left px-4 py-2.5">Produto</th>
                          <th className="text-right px-3 py-2.5 w-20">Qtd</th>
                          <th className="text-right px-3 py-2.5 w-28">Preço Unit.</th>
                          <th className="text-right px-3 py-2.5 w-32">Desconto</th>
                          <th className="text-right px-3 py-2.5 w-28">Total</th>
                          {!isReadOnly && <th className="px-2 py-2.5 w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            {/* Product */}
                            <td className="px-4 py-2.5">
                              {isReadOnly ? (
                                <span className="text-sm text-slate-800 dark:text-slate-100">{item.productName}</span>
                              ) : (
                                <ProductSearchCell
                                  value={item.productName}
                                  products={productsRaw}
                                  onSelect={(p) =>
                                    updateItem(idx, {
                                      productId: p.id,
                                      productName: p.name,
                                      unitPrice: parseFloat(p.negotiatedPrice) || 0,
                                    })
                                  }
                                  onChange={(v) => updateItem(idx, { productName: v, productId: null })}
                                />
                              )}
                            </td>
                            {/* Qty */}
                            <td className="px-3 py-2.5">
                              {isReadOnly ? (
                                <span className="text-right block text-xs">{item.quantity}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0.001}
                                  step={1}
                                  value={item.quantity || ""}
                                  onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                                  className="w-full text-xs border rounded px-2 py-1.5 text-right bg-white dark:bg-slate-800 outline-none focus:border-primary dark:border-slate-600"
                                />
                              )}
                            </td>
                            {/* Unit price */}
                            <td className="px-3 py-2.5">
                              {isReadOnly ? (
                                <span className="text-right block text-xs font-mono">{fmtBRL(item.unitPrice)}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={item.unitPrice || ""}
                                  onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full text-xs border rounded px-2 py-1.5 text-right bg-white dark:bg-slate-800 outline-none focus:border-primary dark:border-slate-600"
                                />
                              )}
                            </td>
                            {/* Discount */}
                            <td className="px-3 py-2.5">
                              {isReadOnly ? (
                                <span className="text-right block text-xs">
                                  {item.discount > 0
                                    ? item.discountType === "percent"
                                      ? `${item.discount}%`
                                      : fmtBRL(item.discount)
                                    : "—"}
                                </span>
                              ) : (
                                <div className="flex justify-end">
                                  <DiscountInput
                                    size="sm"
                                    value={item.discount}
                                    type={item.discountType}
                                    onValueChange={(v) => updateItem(idx, { discount: v })}
                                    onTypeToggle={() =>
                                      updateItem(idx, {
                                        discountType: item.discountType === "percent" ? "fixed" : "percent",
                                      })
                                    }
                                  />
                                </div>
                              )}
                            </td>
                            {/* Line total */}
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-100">
                              <span className="text-xs">{fmtBRL(item.lineTotal)}</span>
                            </td>
                            {/* Remove */}
                            {!isReadOnly && (
                              <td className="px-2 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {isReadOnly ? (
                              <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{item.productName || "—"}</p>
                            ) : (
                              <ProductSearchCell
                                value={item.productName}
                                products={productsRaw}
                                onSelect={(p) =>
                                  updateItem(idx, {
                                    productId: p.id,
                                    productName: p.name,
                                    unitPrice: parseFloat(p.negotiatedPrice) || 0,
                                  })
                                }
                                onChange={(v) => updateItem(idx, { productName: v, productId: null })}
                              />
                            )}
                          </div>
                          {!isReadOnly && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Qtd</p>
                            {isReadOnly ? (
                              <p className="text-xs">{item.quantity}</p>
                            ) : (
                              <input
                                type="number"
                                min={0.001}
                                value={item.quantity || ""}
                                onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full text-xs border rounded px-2 py-1 bg-white dark:bg-slate-800 outline-none focus:border-primary"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Preço unit.</p>
                            {isReadOnly ? (
                              <p className="text-xs font-mono">{fmtBRL(item.unitPrice)}</p>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitPrice || ""}
                                onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                                className="w-full text-xs border rounded px-2 py-1 bg-white dark:bg-slate-800 outline-none focus:border-primary"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Subtotal</p>
                            <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100">{fmtBRL(item.lineTotal)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!isReadOnly && items.length > 0 && (
                <div className="px-4 py-3 border-t">
                  <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar outro item
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Condições e Observações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de Validade</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  disabled={isReadOnly}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condições de Pagamento</Label>
                <Select value={paymentConditions} onValueChange={setPaymentConditions} disabled={isReadOnly}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Informações adicionais para o cliente..."
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Summary + Actions ─────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Summary */}
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-400" />
                Resumo do Orçamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subtotal */}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-100">
                  {fmtBRL(totals.subtotal)}
                </span>
              </div>

              {/* Global discount */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Desconto Global</span>
                  {totals.gDiscAmt > 0 && (
                    <span className="font-mono text-red-600 dark:text-red-400">
                      − {fmtBRL(totals.gDiscAmt)}
                    </span>
                  )}
                </div>
                {!isReadOnly && (
                  <DiscountInput
                    value={globalDiscount}
                    type={globalDiscountType}
                    onValueChange={setGlobalDiscount}
                    onTypeToggle={() =>
                      setGlobalDiscountType((t) => (t === "percent" ? "fixed" : "percent"))
                    }
                  />
                )}
                {isReadOnly && globalDiscount > 0 && (
                  <p className="text-xs text-slate-400">
                    {globalDiscountType === "percent" ? `${globalDiscount}%` : fmtBRL(globalDiscount)}
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100">Total</span>
                  <span className="text-2xl font-bold text-primary font-mono">
                    {fmtBRL(totals.total)}
                  </span>
                </div>
              </div>

              {/* Save button (also shown in summary on mobile) */}
              {!isReadOnly && (
                <Button
                  className="w-full gap-2"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Rascunho
                </Button>
              )}

              {/* Status actions (existing quotes only) */}
              {!isNew && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Ações
                  </p>

                  {/* Download PDF */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-slate-700 dark:text-slate-200"
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Baixar PDF
                  </Button>

                  {/* Draft → send / whatsapp */}
                  {quoteStatus === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => statusMutation.mutate({ action: "send" })}
                        disabled={statusMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Marcar como Enviado
                      </Button>
                      {clientPhone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => whatsappMutation.mutate()}
                          disabled={whatsappMutation.isPending}
                        >
                          {whatsappMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                          Enviar via WhatsApp
                        </Button>
                      )}
                    </>
                  )}

                  {/* Sent → accept / reject / whatsapp */}
                  {quoteStatus === "sent" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() => statusMutation.mutate({ action: "accept" })}
                        disabled={statusMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Marcar como Aceito
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => statusMutation.mutate({ action: "reject" })}
                        disabled={statusMutation.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Marcar como Recusado
                      </Button>
                      {clientPhone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => whatsappMutation.mutate()}
                          disabled={whatsappMutation.isPending}
                        >
                          {whatsappMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                          Reenviar via WhatsApp
                        </Button>
                      )}
                    </>
                  )}

                  {/* Accepted → convert */}
                  {quoteStatus === "accepted" && (
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => {
                        if (!clientId) {
                          toast({ title: "Adicione um cliente antes de converter", variant: "destructive" });
                          return;
                        }
                        if (confirm("Converter este orçamento em uma venda?")) convertMutation.mutate();
                      }}
                      disabled={convertMutation.isPending}
                    >
                      {convertMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-3.5 w-3.5" />
                      )}
                      Converter em Venda
                    </Button>
                  )}

                  {quoteStatus === "converted" && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 text-center font-medium">
                      ✓ Venda registrada com sucesso
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
