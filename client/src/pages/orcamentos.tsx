import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  FileText,
  Plus,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  Copy,
  BarChart3,
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

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "converted" | "cancelled" | "expired";

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
  globalDiscountType: string;
  subtotal: string;
  total: string;
  convertedSaleId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function effectiveStatus(q: Quote): QuoteStatus {
  if (q.status === "draft" || q.status === "sent") {
    if (q.validUntil && new Date(q.validUntil + "T23:59:59") < new Date()) return "expired";
  }
  return q.status as QuoteStatus;
}

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: "Rascunho",  color: "text-slate-600 dark:text-slate-400",  bg: "bg-slate-100 dark:bg-slate-800",   border: "border-slate-200 dark:border-slate-700" },
  sent:      { label: "Enviado",   color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20",   border: "border-blue-200 dark:border-blue-800" },
  accepted:  { label: "Aceito",    color: "text-green-700 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800" },
  rejected:  { label: "Recusado",  color: "text-red-700 dark:text-red-400",      bg: "bg-red-50 dark:bg-red-900/20",     border: "border-red-200 dark:border-red-800" },
  converted: { label: "Convertido",color: "text-purple-700 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-900/20",border: "border-purple-200 dark:border-purple-800" },
  cancelled: { label: "Cancelado", color: "text-slate-400",                      bg: "bg-slate-50 dark:bg-slate-800/50", border: "border-slate-200 dark:border-slate-700" },
  expired:   { label: "Expirado",  color: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800" },
};

function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        cfg.color, cfg.bg, cfg.border,
      )}
    >
      {cfg.label}
    </span>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  deposito: "Depósito Bancário",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  "a-combinar": "A Combinar",
  // legado
  avista: "À Vista",
  "30d": "30 dias",
  "60d": "60 dias",
  "30-60d": "30/60 dias",
  "30-60-90d": "30/60/90 dias",
};

const STATUS_TABS = [
  { key: "all",       label: "Todos" },
  { key: "draft",     label: "Rascunho" },
  { key: "sent",      label: "Enviado" },
  { key: "accepted",  label: "Aceito" },
  { key: "rejected",  label: "Recusado" },
  { key: "expired",   label: "Expirado" },
  { key: "converted", label: "Convertido" },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl shrink-0", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const { data: allQuotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["quotes"],
    queryFn: () => apiFetch<Quote[]>("/api/quotes"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/quotes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Orçamento cancelado" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const openQuotes = allQuotes.filter(
      (q) => q.status === "draft" || q.status === "sent",
    );
    const openValue = openQuotes.reduce((s, q) => s + parseFloat(q.total), 0);

    const thisMonthAccepted = allQuotes.filter((q) => {
      const d = new Date(q.updatedAt);
      return q.status === "accepted" && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const thisMonthDecided = allQuotes.filter((q) => {
      const d = new Date(q.updatedAt);
      return (q.status === "accepted" || q.status === "rejected") && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const conversionRate =
      thisMonthDecided.length > 0
        ? Math.round((thisMonthAccepted.length / thisMonthDecided.length) * 100)
        : 0;

    const allTotals = allQuotes.map((q) => parseFloat(q.total)).filter((v) => v > 0);
    const avgTicket = allTotals.length > 0 ? allTotals.reduce((s, v) => s + v, 0) / allTotals.length : 0;

    return { openValue, openCount: openQuotes.length, thisMonthAccepted: thisMonthAccepted.length, conversionRate, avgTicket };
  }, [allQuotes]);

  // ── Filter ────────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allQuotes
      .map((q) => ({ ...q, _effective: effectiveStatus(q) }))
      .filter((q) => {
        if (activeTab === "all") return q._effective !== "cancelled";
        return q._effective === activeTab;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allQuotes, activeTab]);

  // ── Tab counts ────────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allQuotes.forEach((q) => {
      const s = effectiveStatus(q);
      counts[s] = (counts[s] ?? 0) + 1;
      counts["all"] = (counts["all"] ?? 0) + (s !== "cancelled" ? 1 : 0);
    });
    return counts;
  }, [allQuotes]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={FileText} color="text-primary" bgColor="bg-accent" />
          <PageHeader.Text>
            <PageHeader.Title>Orçamentos</PageHeader.Title>
            <PageHeader.Description>Propostas comerciais com produtos e descontos</PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button onClick={() => navigate("/orcamentos/novo")} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Orçamento
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Em Aberto"
          value={fmtBRL(kpis.openValue)}
          sub={`${kpis.openCount} orçamento${kpis.openCount !== 1 ? "s" : ""}`}
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-900/20"
        />
        <KpiCard
          title="Aceitos no Mês"
          value={String(kpis.thisMonthAccepted)}
          sub="orçamentos aprovados"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50 dark:bg-green-900/20"
        />
        <KpiCard
          title="Taxa de Conversão"
          value={`${kpis.conversionRate}%`}
          sub="aceitos vs. decididos"
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50 dark:bg-purple-900/20"
        />
        <KpiCard
          title="Ticket Médio"
          value={fmtBRL(kpis.avgTicket)}
          sub="todos os orçamentos"
          icon={BarChart3}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* Status Tabs + Table */}
      <Card>
        {/* Tabs */}
        <div className="border-b px-4 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {STATUS_TABS.map((tab) => {
              const count = tabCounts[tab.key] ?? 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                        activeTab === tab.key
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Clock className="h-6 w-6 animate-spin mr-2 opacity-50" />
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <FileText className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">Nenhum orçamento encontrado</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/orcamentos/novo")}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Criar primeiro orçamento
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Nº</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Pagamento</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Validade</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q) => (
                    <tr
                      key={q.id}
                      className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/orcamentos/${q.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {q.quoteNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
                          {q.clientName || <span className="text-slate-400 italic">Sem cliente</span>}
                        </div>
                        {q.clientPhone && (
                          <div className="text-xs text-slate-400 mt-0.5">{q.clientPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs hidden md:table-cell">
                        {PAYMENT_LABELS[q.paymentConditions] ?? q.paymentConditions}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                          {fmtBRL(parseFloat(q.total))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell">
                        {fmtDate(q.validUntil)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={q._effective} />
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/orcamentos/${q.id}`)}
                            className="p-1.5 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Abrir"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {q.status !== "converted" && q.status !== "cancelled" && (
                            <button
                              onClick={() => {
                                if (confirm(`Cancelar o orçamento ${q.quoteNumber}?`)) {
                                  cancelMutation.mutate(q.id);
                                }
                              }}
                              className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Cancelar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
